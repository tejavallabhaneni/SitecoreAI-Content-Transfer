"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/hooks/use-api"
import type { ContentItem, Environment } from "@/lib/types"

type PreflightResponse = {
  itemPath: string
  sourceHost: string
  destinationHost: string
  executionEnabled: boolean
  report: {
    sourceItem: { itemId: string; path: string }
    targetItem: { itemId: string; path: string } | null
    parentChecks: Array<{ path: string; sourceId: string; destinationId: string }>
    checkedAt: string
  }
}
type StreamProgress = {
  stage: string
  completedChunks?: number
  totalChunks?: number
  message?: string
  operationId?: string
}

export function NewJobForm() {
  const router = useRouter()
  const [parentInput, setParentInput] = useState("/sitecore/content")
  const [parent, setParent] = useState("/sitecore/content")
  const { data: envData, error: envError, loading: envLoading, reload: reloadEnvs } =
    useApi<{ environments: Environment[] }>("/api/environments")
  const { data: itemData, error: itemError, loading: itemLoading, reload: reloadItems } =
    useApi<{ items: ContentItem[] }>(`/api/items?parent=${encodeURIComponent(parent)}`)

  const [sourceEnvId, setSourceEnvId] = useState<string | null>("source")
  const [targetEnvId, setTargetEnvId] = useState<string | null>("destination")
  const [selected, setSelected] = useState<string[]>([])
  const [itemQuery, setItemQuery] = useState("")
  const [scope, setScope] = useState("SingleItem")
  const [mergeStrategy, setMergeStrategy] = useState("KeepExistingItem")
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null)
  const [progress, setProgress] = useState<StreamProgress | null>(null)

  const environments = envData?.environments ?? []
  const items = useMemo(() => {
    const catalog = itemData?.items ?? []
    const q = itemQuery.trim().toLowerCase()
    return q ? catalog.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q) ||
      item.template.toLowerCase().includes(q)) : catalog
  }, [itemData, itemQuery])

  const selectedItem = (itemData?.items ?? []).find(item => selected.includes(item.id))
  const invalidatePreflight = () => { setPreflight(null); setProgress(null) }
  const setOneItem = (id: string, checked: boolean) => {
    setSelected(checked ? [id] : [])
    invalidatePreflight()
  }

  async function onPreflight(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    invalidatePreflight()
    if (sourceEnvId !== "source" || targetEnvId !== "destination") {
      setFormError("Select the configured source and destination authoring environments.")
      return
    }
    if (!selectedItem) {
      setFormError("Select one source content item from the current folder.")
      return
    }
    if (!environments.find(x => x.id === "source")?.connected ||
        !environments.find(x => x.id === "destination")?.connected) {
      setFormError("Both SitecoreAI authoring environments must be connected.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemPath: selectedItem.path, scope, mergeStrategy }),
      })
      const value = (await response.json()) as PreflightResponse & { error?: string }
      if (!response.ok) throw new Error(value.error ?? "Preflight was rejected")
      setPreflight(value)
      toast.success("SitecoreAI preflight succeeded. Review the destination before transfer.")
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Preflight failed")
    } finally { setBusy(false) }
  }

  async function onExecute() {
    if (!preflight || !selectedItem || preflight.itemPath !== selectedItem.path) return
    if (!window.confirm(
      `Transfer ${preflight.itemPath} to ${preflight.destinationHost}? Content will be imported to master, not published.`
    )) return
    if (mergeStrategy === "OverrideExistingItem" && !window.confirm(
      "This will overwrite matching destination items. Confirm this replacement."
    )) return

    setBusy(true)
    setRunning(true)
    setFormError(null)
    setProgress({ stage: "Connecting" })
    let completed = false
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemPath: preflight.itemPath, scope, mergeStrategy,
          sourceItemId: preflight.report.sourceItem.itemId,
          confirmItemPath: preflight.itemPath,
          confirmDestinationHost: preflight.destinationHost,
          confirmOverwrite: mergeStrategy === "OverrideExistingItem",
        }),
      })
      if (!response.ok) {
        const value = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(value?.error ?? "SitecoreAI refused the transfer")
      }
      if (!response.body) throw new Error("Vercel did not return a progress stream")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let pos = buffer.indexOf("\n\n")
        while (pos >= 0) {
          const frame = buffer.slice(0, pos)
          buffer = buffer.slice(pos + 2)
          if (frame.startsWith("data: ")) {
            const event = JSON.parse(frame.slice(6)) as StreamProgress
            setProgress(event)
            if (event.stage === "complete") completed = true
            if (event.stage === "error") throw new Error(event.message ?? "Transfer failed")
          }
          pos = buffer.indexOf("\n\n")
        }
      }
      if (!completed) throw new Error(
        "The transfer connection ended without confirmation. Check SitecoreAI history before retrying."
      )
      toast.success("Content imported into destination master. Publishing is a separate step.")
      router.push("/")
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Transfer could not complete")
    } finally {
      setBusy(false)
      setRunning(false)
    }
  }

  const loadError = envError || itemError

  return <form onSubmit={event => void onPreflight(event)}
    className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <div>
      <h1 className="text-2xl font-semibold">New transfer</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose your authoring environments, browse live SitecoreAI content and review the preflight
        before importing. No content or transfer history is saved by this app.
      </p>
    </div>

    {loadError && <Alert><AlertCircle /><AlertTitle>SitecoreAI connection failed</AlertTitle>
      <AlertDescription>{loadError}{" "}
        <button type="button" className="underline" onClick={() => {
          void reloadEnvs(); void reloadItems()
        }}>Retry</button>
      </AlertDescription></Alert>}
    {formError && <Alert><AlertCircle /><AlertTitle>Transfer not completed</AlertTitle>
      <AlertDescription>{formError}</AlertDescription></Alert>}

    <Card><CardHeader><CardTitle>Route</CardTitle>
      <CardDescription>Source and destination authoring environments configured in Vercel.</CardDescription>
    </CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <EnvPicker label="Source" value={sourceEnvId} onChange={next => {
        setSourceEnvId(next); invalidatePreflight()
      }} environments={environments} loading={envLoading} />
      <EnvPicker label="Target" value={targetEnvId} onChange={next => {
        setTargetEnvId(next); invalidatePreflight()
      }} environments={environments} loading={envLoading} />
      <p className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
        {environments.find(x => x.id === "source")?.host ?? "Source not configured"}
        <ArrowRight className="size-4" />
        {environments.find(x => x.id === "destination")?.host ?? "Destination not configured"}
      </p>
    </CardContent></Card>

    <Card><CardHeader>
      <CardTitle>Items</CardTitle>
      <CardDescription>Select one item from the source authoring master database.</CardDescription>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Browse source path" className="min-w-48 flex-1" value={parentInput}
          onChange={event => setParentInput(event.target.value)} />
        <Button type="button" variant="outline" onClick={() => {
          setParent(parentInput); setSelected([]); invalidatePreflight()
        }}>Browse</Button>
      </div>
      <Input value={itemQuery} onChange={event => setItemQuery(event.target.value)}
        placeholder="Filter items by name, path, or template" aria-label="Filter items" />
    </CardHeader><CardContent>
      {itemLoading && !itemData ? <div className="space-y-2">
        <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
      </div> : null}
      {!itemLoading && items.length === 0 ? <p className="py-8 text-sm text-muted-foreground">
        No items returned. Browse another parent path or check the SitecoreAI connection.
      </p> : null}
      <ul className="divide-y rounded-lg border">
        {items.map(item => <li className="flex items-start gap-3 p-3" key={item.id}>
          <Checkbox checked={selected.includes(item.id)} onCheckedChange={value =>
            setOneItem(item.id, value === true)} aria-label={`Select ${item.name}`} />
          <div className="min-w-0">
            <p className="font-medium">{item.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{item.path}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.template}</p>
          </div>
        </li>)}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        To browse deeper, paste a child path above and choose Browse.
      </p>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Transfer options</CardTitle>
      <CardDescription>Use a non-destructive strategy when validating against your SitecoreAI instance.</CardDescription>
    </CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="scope">Scope</Label>
        <select id="scope" value={scope} onChange={event => {
          setScope(event.target.value); invalidatePreflight()
        }} className="w-full rounded-lg border bg-background p-2 text-sm">
          <option value="SingleItem">Single item</option>
          <option value="ItemAndDescendants">Item and descendants</option>
        </select>
      </div>
      <div className="space-y-2"><Label htmlFor="strategy">Existing items</Label>
        <select id="strategy" value={mergeStrategy} onChange={event => {
          setMergeStrategy(event.target.value); invalidatePreflight()
        }} className="w-full rounded-lg border bg-background p-2 text-sm">
          <option value="KeepExistingItem">Keep existing items</option>
          <option value="OverrideExistingItem">Overwrite matching items</option>
        </select>
      </div>
    </CardContent></Card>

    {preflight && <Card><CardHeader>
      <CardTitle>Preflight verified</CardTitle>
      <CardDescription>Rechecked again on the server before any real transfer begins.</CardDescription>
    </CardHeader><CardContent className="space-y-2 text-sm">
      <p><strong>Source:</strong> {preflight.itemPath}</p>
      <p><strong>Target:</strong> {preflight.destinationHost}</p>
      <p><strong>Source item ID:</strong> {preflight.report.sourceItem.itemId}</p>
      <p><strong>Destination item:</strong> {preflight.report.targetItem ? "Already exists" : "New item"}</p>
      <p><strong>Verified parent IDs:</strong> {preflight.report.parentChecks.length}</p>
      {!preflight.executionEnabled && <Alert><AlertCircle /><AlertTitle>Real transfers disabled</AlertTitle>
        <AlertDescription>Set ENABLE_LIVE_TRANSFERS=true only after testing credentials
          and choosing a disposable destination environment.</AlertDescription>
      </Alert>}
      <Button type="button" onClick={() => void onExecute()} disabled={busy || !preflight.executionEnabled}>
        {running ? "Transferring…" : "Confirm and transfer to master"}
      </Button>
    </CardContent></Card>}

    {progress && <Card><CardHeader><CardTitle>Transfer progress</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Stage: {progress.stage}</p>
        {progress.totalChunks !== undefined && <p>
          Chunks: {progress.completedChunks ?? 0} / {progress.totalChunks}
        </p>}
        <p className="text-muted-foreground">
          Keep this page open. If Vercel times out, inspect SitecoreAI before attempting a new run.
        </p>
      </CardContent></Card>}

    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => router.push("/")}>Cancel</Button>
      <Button type="submit" disabled={busy || !selectedItem}>
        {busy ? "Working…" : "Validate transfer"}
      </Button>
    </div>
  </form>
}

function EnvPicker({
  label, value, onChange, environments, loading,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  environments: Environment[]
  loading: boolean
}) {
  return <div className="grid gap-2">
    <Label>{label} environment</Label>
    {loading && !environments.length ? <Skeleton className="h-8 w-full" /> : (
      <Select value={value} onValueChange={next => onChange(next)}>
        <SelectTrigger className="w-full"><SelectValue placeholder={`Choose ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent className="w-(--anchor-width)" alignItemWithTrigger={false}>
          {environments.filter(env =>
            env.id === (label === "Source" ? "source" : "destination")
          ).map(env => <SelectItem key={env.id} value={env.id} disabled={!env.connected}>
            {env.name}{env.connected ? " · Connected" : " (disconnected)"}
          </SelectItem>)}
        </SelectContent>
      </Select>
    )}
  </div>
}
