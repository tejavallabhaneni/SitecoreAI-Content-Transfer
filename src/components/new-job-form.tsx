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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { postJson, useApi } from "@/hooks/use-api"
import { kindLabel } from "@/lib/format"
import type { ContentItem, Environment, HydratedJob } from "@/lib/types"

export function NewJobForm() {
  const router = useRouter()
  const { data: envData, error: envError, loading: envLoading, reload: reloadEnvs } =
    useApi<{ environments: Environment[] }>("/api/environments")
  const { data: itemData, error: itemError, loading: itemLoading, reload: reloadItems } =
    useApi<{ items: ContentItem[] }>("/api/items")

  const [name, setName] = useState("")
  const [sourceEnvId, setSourceEnvId] = useState<string | null>(null)
  const [targetEnvId, setTargetEnvId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [itemQuery, setItemQuery] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const environments = envData?.environments ?? []
  const items = useMemo(() => {
    const list = itemData?.items ?? []
    const q = itemQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.template.toLowerCase().includes(q),
    )
  }, [itemData, itemQuery])

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((entry) => entry !== id),
    )
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError("Give the transfer a name so the team can find it later.")
      return
    }
    if (!sourceEnvId || !targetEnvId) {
      setFormError("Choose a source environment and a different target.")
      return
    }
    if (selected.length === 0) {
      setFormError("Select at least one item from the catalog.")
      return
    }
    setSubmitting(true)
    try {
      const result = await postJson<{ job: HydratedJob }>("/api/jobs", {
        name,
        sourceEnvId,
        targetEnvId,
        itemIds: selected,
      })
      toast.success("Transfer created. Review the AI field mappings before you run it.")
      router.push(`/jobs/${result.job.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the transfer.")
    } finally {
      setSubmitting(false)
    }
  }

  const loadError = envError || itemError

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New transfer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick source and target environments, then choose which items to copy. SitecoreAI
          will draft field mappings for you to review.
        </p>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Catalog could not load</AlertTitle>
          <AlertDescription>
            {loadError}{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => {
                void reloadEnvs()
                void reloadItems()
              }}
            >
              Try again
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Fix this before creating</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Route</CardTitle>
          <CardDescription>
            Authoring is usually the source. Preview and Live are typical targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="job-name">Job name</Label>
            <Input
              id="job-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product pages to US Preview"
            />
          </div>
          <EnvPicker
            label="Source"
            value={sourceEnvId}
            onChange={setSourceEnvId}
            environments={environments}
            loading={envLoading}
          />
          <EnvPicker
            label="Target"
            value={targetEnvId}
            onChange={setTargetEnvId}
            environments={environments}
            loading={envLoading}
          />
          {sourceEnvId && targetEnvId ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
              {environments.find((env) => env.id === sourceEnvId)?.name ?? sourceEnvId}
              <ArrowRight className="size-4" />
              {environments.find((env) => env.id === targetEnvId)?.name ?? targetEnvId}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            {selected.length} selected. SitecoreAI maps fields across the templates in this set.
          </CardDescription>
          <Input
            value={itemQuery}
            onChange={(event) => setItemQuery(event.target.value)}
            placeholder="Filter by name, path, or template"
            aria-label="Filter items"
          />
        </CardHeader>
        <CardContent>
          {itemLoading && !itemData ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-2/3" />
            </div>
          ) : null}
          {!itemLoading && items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No items match “{itemQuery}”. Clear the filter to see the full tree.
            </p>
          ) : null}
          <ul className="divide-y rounded-lg border">
            {items.map((item) => {
              const checked = selected.includes(item.id)
              return (
                <li key={item.id} className="flex items-start gap-3 p-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggle(item.id, value === true)}
                    aria-label={`Select ${item.name}`}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{item.path}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.template} · {item.language} v{item.version}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create and review mappings"}
        </Button>
      </div>
    </form>
  )
}

function EnvPicker({
  label,
  value,
  onChange,
  environments,
  loading,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  environments: Environment[]
  loading: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label>{label} environment</Label>
      {loading && environments.length === 0 ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <Select value={value} onValueChange={(next) => onChange(next)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent className="w-(--anchor-width)" alignItemWithTrigger={false}>
            {environments.map((env) => (
              <SelectItem key={env.id} value={env.id} disabled={!env.connected}>
                {env.name}
                {!env.connected ? " (disconnected)" : ` · ${kindLabel(env.kind)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
