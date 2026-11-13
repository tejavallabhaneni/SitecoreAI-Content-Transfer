"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createDraft } from "@/lib/browser-session"
import { useApi } from "@/hooks/use-api"
import type { ContentItem, Environment } from "@/lib/types"
import type { Plan } from "@/lib/sitecore/public-transfer"

export function NewJobForm() {
  const router = useRouter()
  const { data: envData } = useApi<{ environments: Environment[] }>("/api/environments")
  const [path, setPath] = useState("/sitecore/content")
  const [browsePath, setBrowsePath] = useState("/sitecore/content")
  const { data, error, loading } = useApi<{ items: ContentItem[]; hasMore: boolean }>(`/api/items?path=${encodeURIComponent(browsePath)}`)
  const [selected, setSelected] = useState<Record<string, ContentItem>>({})
  const [name, setName] = useState("")
  const [scope, setScope] = useState<Plan["scope"]>("SingleItem")
  const [mergeStrategy, setMergeStrategy] = useState<Plan["mergeStrategy"]>("KeepExistingItem")
  const [formError, setFormError] = useState("")
  const envs = envData?.environments ?? []

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError("")
    const paths = Object.values(selected).map(item => item.path)
    if (!name.trim() || !paths.length) { setFormError("Enter a name and select at least one content root."); return }
    if (paths.length > 20) { setFormError("Select at most 20 content roots."); return }
    try {
      const job = createDraft({ name: name.trim(), itemPaths: paths, scope, mergeStrategy })
      toast.success("Plan prepared in this tab. Review it before starting the transfer.")
      router.push(`/jobs/${job.id}`)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Unable to prepare a plan.") }
  }

  return <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">New transfer</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose content roots, review parent IDs, and approve changes to the destination master database.</p></div>
    <Card><CardHeader><CardTitle>Route</CardTitle><CardDescription>Transfers run between authoring environments. They do not publish to Experience Edge.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="job-name">Job name</Label>
          <Input id="job-name" value={name} onChange={event => setName(event.target.value)} placeholder="Campaign pages to staging" maxLength={120} required /></div>
        <div><Label>Source environment</Label><p className="mt-2 break-all text-sm">{envs[0]?.host ?? "Connect environments first"}</p></div>
        <div><Label>Destination environment</Label><p className="mt-2 break-all text-sm">{envs[1]?.host ?? "Connect environments first"}</p></div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">Source master <ArrowRight className="size-3" /> Destination master</p>
      </CardContent></Card>
    <Card><CardHeader><CardTitle>Items</CardTitle><CardDescription>{Object.keys(selected).length} roots selected. Browse one folder at a time, or enter an exact path.</CardDescription>
      <div className="flex gap-2"><Input value={path} onChange={event => setPath(event.target.value)} aria-label="Source content path" />
        <Button type="button" variant="outline" onClick={() => setBrowsePath(path)}>Browse</Button></div>
    </CardHeader><CardContent>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Reading source items…</p>}
      {data?.hasMore && <p className="mb-3 text-xs text-muted-foreground">Showing the first 50 children. Enter an exact child path to find items beyond this page.</p>}
      <ul className="divide-y rounded-lg border">{data?.items.map(item => <li key={item.id} className="flex items-start gap-3 p-3">
        <Checkbox checked={Boolean(selected[item.id])} disabled={["/sitecore/content", "/sitecore/media library"].includes(item.path.toLowerCase())}
          aria-label={`Select ${item.name}`} onCheckedChange={checked => setSelected(old => { const next = { ...old }; if (checked) next[item.id] = item; else delete next[item.id]; return next })} />
        <div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="break-all font-mono text-xs text-muted-foreground">{item.path}</p><p className="text-xs text-muted-foreground">{item.template}</p></div>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setPath(item.path); setBrowsePath(item.path) }}>Open</Button>
      </li>)}</ul>
      {Object.keys(selected).length > 0 && <div className="mt-4 space-y-1"><p className="text-sm font-medium">Selected roots</p>{Object.values(selected).map(item => <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
        <span className="break-all">{item.path}</span><Button type="button" size="sm" variant="ghost" onClick={() => setSelected(old => { const next = { ...old }; delete next[item.id]; return next })}>Unselect</Button>
      </div>)}</div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Transfer settings</CardTitle><CardDescription>The native API preserves item IDs and fields; it does not generate AI field mappings.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="scope">Scope</Label><select id="scope" className="rounded-md border bg-background p-2 text-sm" value={scope} onChange={event => setScope(event.target.value as Plan["scope"])}>
          <option value="SingleItem">Selected items only</option><option value="ItemAndDescendants">Selected items and descendants</option></select></div>
        <div className="grid gap-2"><Label htmlFor="merge-strategy">Existing destination items</Label><select id="merge-strategy" className="rounded-md border bg-background p-2 text-sm" value={mergeStrategy} onChange={event => setMergeStrategy(event.target.value as Plan["mergeStrategy"])}>
          <option value="KeepExistingItem">Keep existing items</option><option value="OverrideExistingItem">Overwrite matching items</option></select></div>
      </CardContent></Card>
    {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
    <p className="text-xs text-muted-foreground">Drafts live only in this tab. Keep the tab open while forwarding chunks. Native imports and their history remain in Sitecore.</p>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => router.push("/")}>Cancel</Button><Button type="submit" disabled={envs.length !== 2}>Create and review transfer</Button></div>
  </form>
}
