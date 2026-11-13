"use client"

import { useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, ChevronRight, FileOutput, FileInput, Folder, Home, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WorkflowSteps } from "@/components/workflow-steps"
import { connectionRevision, createDraft, isDemo, serverRevision, subscribeConnection } from "@/lib/browser-session"
import { DEMO_PATHS } from "@/lib/demo-sitecore"
import { useApi } from "@/hooks/use-api"
import { cn } from "@/lib/utils"
import type { ContentItem, Environment } from "@/lib/types"
import type { Plan } from "@/lib/sitecore/public-transfer"

/** Sample scenarios for the demo, each showing a different review outcome. */
const scenarios = [
  { path: DEMO_PATHS.newPage, label: "New page", hint: "Will be created", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { path: DEMO_PATHS.existingPage, label: "Existing page", hint: "Kept or updated", tone: "bg-amber-50 text-amber-900 border-amber-200" },
  { path: DEMO_PATHS.newImage, label: "New image", hint: "Media library", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  { path: DEMO_PATHS.conflictPage, label: "ID conflict", hint: "Blocked by the check", tone: "bg-rose-50 text-rose-800 border-rose-200" },
  { path: DEMO_PATHS.missingParentPage, label: "Missing parent", hint: "Blocked by the check", tone: "bg-rose-50 text-rose-800 border-rose-200" },
  { path: DEMO_PATHS.failingImport, label: "Failing import", hint: "Fails during import", tone: "bg-orange-50 text-orange-800 border-orange-200" },
]

const ROOTS = ["/sitecore/content", "/sitecore/media library"]
const selectClass = "h-10 rounded-md border border-input bg-card px-3 text-sm"

function crumbs(path: string) {
  const parts = path.split("/").filter(Boolean)
  return parts.map((name, index) => ({ name, path: "/" + parts.slice(0, index + 1).join("/") })).slice(1)
}

export function NewJobForm() {
  const router = useRouter()
  useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  const demo = isDemo()
  const { data: envData } = useApi<{ environments: Environment[] }>("/api/environments")
  const [path, setPath] = useState("/sitecore/content")
  const [browsePath, setBrowsePath] = useState("/sitecore/content")
  const { data, error, loading } = useApi<{ items: ContentItem[]; hasMore: boolean }>(`/api/items?path=${encodeURIComponent(browsePath)}`)
  // Keyed by lower-case path so the same item can't be added twice.
  const [selected, setSelected] = useState<Record<string, { path: string; name: string }>>({})
  const [name, setName] = useState("")
  const [scope, setScope] = useState<Plan["scope"]>("SingleItem")
  const [mergeStrategy, setMergeStrategy] = useState<Plan["mergeStrategy"]>("KeepExistingItem")
  const [formError, setFormError] = useState("")
  const envs = envData?.environments ?? []
  const count = Object.keys(selected).length

  const open = (target: string) => { setPath(target); setBrowsePath(target) }
  const toggle = (item: { path: string; name: string }, on: boolean) => setSelected(old => {
    const next = { ...old }
    if (on) next[item.path.toLowerCase()] = item; else delete next[item.path.toLowerCase()]
    return next
  })

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError("")
    const paths = Object.values(selected).map(item => item.path)
    if (!paths.length) { setFormError("Select at least one page, folder or media item."); return }
    if (!name.trim()) { setFormError("Give this transfer a name."); return }
    if (paths.length > 20) { setFormError("Select at most 20 content roots."); return }
    try {
      const job = createDraft({ name: name.trim(), itemPaths: paths, scope, mergeStrategy })
      toast.success("Plan ready. Check it before anything is written.")
      router.push(`/jobs/${job.id}`)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Unable to prepare a plan.") }
  }

  return <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <div><p className="eyebrow">Step 2 of 3</p><h1 className="page-title mt-2">Choose your content</h1>
      <p className="page-description">Tick the pages, folders or media to copy. You’ll see exactly what changes before anything is written.</p></div>
    <WorkflowSteps active={2} />

    <Card className="overflow-hidden"><CardContent className="grid items-center gap-3 p-4 sm:grid-cols-[1fr_auto_1fr]">
      <div className="flex min-w-0 items-center gap-3 rounded-lg bg-connect-tint p-3"><FileOutput className="size-5 shrink-0 text-connect-ink" aria-hidden="true" /><div className="min-w-0"><p className="text-xs text-connect-ink">Copy from (master)</p><p className="truncate text-sm font-semibold">{envs[0]?.host ?? "Connect environments first"}</p></div></div>
      <ArrowRight className="mx-auto size-5 rotate-90 text-brand-ink sm:rotate-0" aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-3 rounded-lg bg-review-tint p-3"><FileInput className="size-5 shrink-0 text-review-ink" aria-hidden="true" /><div className="min-w-0"><p className="text-xs text-review-ink">Copy to (master)</p><p className="truncate text-sm font-semibold">{envs[1]?.host ?? "Connect environments first"}</p></div></div>
    </CardContent></Card>

    {demo && <Card className="border-brand-tint bg-brand-soft"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-brand-ink" aria-hidden="true" />Sample scenarios</CardTitle><CardDescription>Add one or more to see how each case looks in the review. Or browse the tree below.</CardDescription></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{scenarios.map(scenario => {
        const on = Boolean(selected[scenario.path.toLowerCase()])
        return <button key={scenario.path} type="button" aria-pressed={on} onClick={() => toggle({ path: scenario.path, name: scenario.path.split("/").at(-1)! }, !on)}
          className={cn("rounded-lg border p-3 text-left text-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", scenario.tone, on && "ring-2 ring-current")}>
          <span className="flex items-center justify-between font-semibold">{scenario.label}{on && <span className="text-xs font-medium">Added ✓</span>}</span>
          <span className="mt-0.5 block text-xs opacity-90">{scenario.hint}</span>
        </button>
      })}</CardContent></Card>}

    <Card className="border-t-4 border-t-choose"><CardHeader><CardTitle>Select content</CardTitle><CardDescription>Open a folder to see what’s inside, then tick what you want to copy.</CardDescription>
      <nav aria-label="Current folder" className="flex flex-wrap items-center gap-1 text-xs">
        <button type="button" className="flex items-center gap-1 rounded px-1.5 py-1 text-choose-ink hover:bg-choose-tint" onClick={() => open("/sitecore/content")}><Home className="size-3.5" aria-hidden="true" />Content</button>
        <button type="button" className="rounded px-1.5 py-1 text-choose-ink hover:bg-choose-tint" onClick={() => open("/sitecore/media library")}>Media library</button>
        <span className="mx-1 text-muted-foreground">·</span>
        {crumbs(browsePath).map((crumb, index, all) => <span key={crumb.path} className="flex items-center gap-1">{index > 0 && <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />}
          <button type="button" className={cn("rounded px-1.5 py-1 hover:bg-muted", index === all.length - 1 && "font-semibold")} onClick={() => open(crumb.path)}>{crumb.name}</button></span>)}
      </nav>
      <div className="flex gap-2"><Input value={path} onChange={event => setPath(event.target.value)} aria-label="Source content path" className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={() => setBrowsePath(path)}>Go</Button></div>
    </CardHeader><CardContent>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Reading source items…</p>}
      {data?.hasMore && <p className="mb-3 text-xs text-muted-foreground">Showing the first 50 children. Type an exact child path to find items beyond this page.</p>}
      <ul className="divide-y rounded-lg border">{data?.items.map((item, index) => {
        const isRoot = ROOTS.includes(item.path.toLowerCase())
        return <li key={item.id} className={cn("flex items-center gap-3 p-3", index === 0 && "bg-muted/50")}>
          <Checkbox checked={Boolean(selected[item.path.toLowerCase()])} disabled={isRoot} aria-label={`Select ${item.name}`} onCheckedChange={checked => toggle(item, Boolean(checked))} />
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", index === 0 ? "bg-choose text-white dark:text-background" : "bg-choose-tint text-choose-ink")}><Folder className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="font-medium">{item.name}{index === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">this folder</span>}</p><p className="truncate font-mono text-xs text-muted-foreground">{item.path}</p></div>
          <span className="hidden rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">{item.template}</span>
          {index > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => open(item.path)} aria-label={`Open ${item.name}`}>Open<ChevronRight className="size-3.5" aria-hidden="true" /></Button>}
        </li>
      })}</ul>
      {count > 0 && <div className="mt-4"><p className="mb-2 text-sm font-medium">Selected ({count})</p><ul className="flex flex-wrap gap-2">{Object.values(selected).map(item => <li key={item.path} className="flex max-w-full items-center gap-1 rounded-full border border-choose/30 bg-choose-tint py-1 pr-1 pl-3 text-xs text-choose-ink">
        <span className="truncate" title={item.path}>{item.path.replace(/^\/sitecore\/(content|media library)\//i, "")}</span>
        <button type="button" className="rounded-full p-0.5 hover:bg-card" aria-label={`Remove ${item.name}`} onClick={() => toggle(item, false)}><X className="size-3.5" aria-hidden="true" /></button>
      </li>)}</ul></div>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Transfer settings</CardTitle><CardDescription>Name it, then choose how child items and existing content are handled.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="job-name">Transfer name</Label>
          <Input id="job-name" className="h-10" value={name} onChange={event => setName(event.target.value)} placeholder="Campaign pages to staging" maxLength={120} required /></div>
        <div className="grid gap-2"><Label htmlFor="scope">What to copy</Label><select id="scope" className={selectClass} value={scope} onChange={event => setScope(event.target.value as Plan["scope"])}>
          <option value="SingleItem">Selected items only</option><option value="ItemAndDescendants">Selected items and everything under them</option></select></div>
        <div className="grid gap-2"><Label htmlFor="merge-strategy">If it already exists in the destination</Label><select id="merge-strategy" className={selectClass} value={mergeStrategy} onChange={event => setMergeStrategy(event.target.value as Plan["mergeStrategy"])}>
          <option value="KeepExistingItem">Keep the destination version (safe)</option><option value="OverrideExistingItem">Overwrite with the source version</option></select></div>
      </CardContent></Card>
    {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
    <p className="text-xs text-muted-foreground">Plans live only in this tab. Imports and their history stay in Sitecore.</p>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => router.push("/")}>Cancel</Button><Button type="submit" className="gap-2" disabled={envs.length !== 2}>Review {count ? `${count} item${count === 1 ? "" : "s"}` : "transfer"}<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
  </form>
}
