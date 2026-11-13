"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowRight, Check, CircleSlash, LoaderCircle, PencilLine, Play, Plus, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { StatusBadge } from "@/components/status-badge"
import { WorkflowSteps } from "@/components/workflow-steps"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/hooks/use-api"
import { removeFromDraft, reviewDraft, runDraft, type ReviewOutcome, type ReviewRow } from "@/lib/browser-session"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { HydratedJob } from "@/lib/types"

/** Colour-coded review outcomes: green create, amber update, grey skip, red conflict. */
const outcomes: Record<ReviewOutcome, { label: string; icon: typeof Plus; badge: string; row: string; explain: string }> = {
  create: { label: "Create", icon: Plus, badge: "bg-emerald-100 text-emerald-800 border-emerald-200", row: "border-l-emerald-500", explain: "New in the destination. It will be created with the same item ID." },
  update: { label: "Update", icon: PencilLine, badge: "bg-amber-100 text-amber-900 border-amber-200", row: "border-l-amber-500", explain: "Already in the destination with the same ID. Source values will overwrite it." },
  keep: { label: "Skip", icon: CircleSlash, badge: "bg-slate-100 text-slate-800 border-slate-200", row: "border-l-slate-400", explain: "Already in the destination with the same ID. The destination version is kept." },
  conflict: { label: "Conflict", icon: AlertTriangle, badge: "bg-rose-100 text-rose-800 border-rose-200", row: "border-l-rose-500", explain: "" },
}

function fixFor(message = "") {
  if (/different Sitecore item ID/i.test(message)) return "An item with this path was created separately in the destination, so the IDs differ. Rename or delete the destination item, or sync it with serialization, then check again."
  if (/Missing required parent/i.test(message)) return "A parent folder doesn’t exist in the destination. Add the parent to this transfer (with its children), or copy it first."
  if (/Source item was not found/i.test(message)) return "The item isn’t in the source any more. Remove it and choose again."
  if (/identical/i.test(message)) return "The source and destination are the same environment. Reconnect with two different environments."
  return "Check the item in both environments, then run the checks again."
}

const phases = ["Export from source", "Forward chunks", "Build destination file", "Import to master", "Done"]

function Timeline({ job }: { job: HydratedJob }) {
  const current = job.status === "success" ? 6 : job.phase ?? 0
  return <ol aria-label="Transfer progress" className="grid gap-3 sm:grid-cols-5">
    {phases.map((label, index) => {
      const step = index + 1
      const done = step < current || (job.status === "success" && step <= 5)
      const failed = job.status === "error" && step === current
      const active = job.status === "running" && step === current
      return <li key={label} className="flex items-center gap-3 sm:flex-col sm:text-center">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
          failed ? "border-rose-500 bg-rose-100 text-rose-800" : done ? "border-emerald-500 bg-emerald-500 text-white dark:text-background" : active ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-border bg-card text-muted-foreground")}>
          {failed ? <X className="size-4" aria-hidden="true" /> : done ? <Check className="size-4" aria-hidden="true" /> : active ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : step}
        </span>
        <span className={cn("text-xs", active ? "font-semibold text-indigo-800" : failed ? "font-semibold text-rose-800" : done ? "text-foreground" : "text-muted-foreground")}>{label}<span className="sr-only">{failed ? " (failed)" : done ? " (done)" : active ? " (in progress)" : ""}</span></span>
      </li>
    })}
  </ol>
}

export function JobDetail({ jobId }: { jobId: string }) {
  const { data, error, loading, reload, setData } = useApi<{ job: HydratedJob }>(`/api/jobs/${encodeURIComponent(jobId)}`, 4000)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<ReviewRow[] | null>(null)
  const [ackWrite, setAckWrite] = useState(false)
  const [ackOverwrite, setAckOverwrite] = useState(false)
  const job = data?.job
  const conflicts = review?.filter(row => row.outcome === "conflict") ?? []
  const updates = review?.filter(row => row.outcome === "update").length ?? 0
  const ready = Boolean(review && !conflicts.length && ackWrite && (!updates || ackOverwrite))

  async function verify() {
    setBusy(true); setReview(null); setAckWrite(false); setAckOverwrite(false)
    try {
      const rows = await reviewDraft(jobId)
      setReview(rows)
      const blocked = rows.filter(row => row.outcome === "conflict").length
      if (blocked) toast.warning(`${blocked} item${blocked === 1 ? " needs" : "s need"} attention before you can start.`)
      else toast.success("All checks passed. Review the plan and approve it.")
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "The checks could not run.") }
    finally { setBusy(false) }
  }
  function dropConflicts() {
    try { setData({ job: removeFromDraft(jobId, conflicts.map(row => row.path)) }); setReview(review?.filter(row => row.outcome !== "conflict") ?? null) }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to change the plan.") }
  }
  async function run() {
    if (!job?.plan || !ready) return
    setBusy(true)
    try { await runDraft(jobId, true, job.plan.mergeStrategy !== "OverrideExistingItem" || ackOverwrite, updated => setData({ job: updated })); toast.success("Import finished. Publish when you’re ready.") }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Transfer stopped.") }
    finally { setBusy(false) }
  }
  if (loading && !job) return <p className="text-sm text-muted-foreground">Reading transfer details…</p>
  if (error || !job) return <Alert variant="destructive"><AlertTitle>This transfer could not be loaded</AlertTitle><AlertDescription>{error ?? "Plans live only in the tab that made them. Prepare a new plan, or open a transfer from the list."} <button type="button" className="underline" onClick={() => reload()}>Try again</button> · <Link href="/" className="underline">All transfers</Link></AlertDescription></Alert>

  const draftWaiting = Boolean(job.plan && job.status === "queued")
  const counts = (["create", "update", "keep", "conflict"] as const).map(outcome => ({ outcome, n: review?.filter(row => row.outcome === outcome).length ?? 0 })).filter(entry => entry.n)

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    {job.plan && <WorkflowSteps active={3} />}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><Link href="/" className="text-sm text-muted-foreground hover:text-primary">← All transfers</Link>
        <h1 className="mt-2 break-all text-2xl font-semibold tracking-tight">{job.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-connect-tint px-2.5 py-0.5 text-connect-ink">{job.source?.host ?? "Source not recorded"}</span><ArrowRight className="size-4 text-brand-ink" aria-hidden="true" /><span className="rounded-full bg-review-tint px-2.5 py-0.5 text-review-ink">{job.target?.host ?? "Destination"}</span></p></div>
      <StatusBadge status={job.status} />
    </div>

    {draftWaiting && !review && <Card className="border-t-4 border-t-review"><CardHeader><CardTitle>Check the plan first</CardTitle><CardDescription>Nothing is written yet. The check reads both environments and shows what would happen to each item.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ul className="space-y-1 text-sm text-muted-foreground"><li>• Is it new, already there, or blocked?</li><li>• Do the parent folders exist with the same IDs?</li><li>• Would anything be overwritten?</li></ul>
        <Button size="lg" className="gap-2" onClick={() => void verify()} disabled={busy}>{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Checking…</> : <><ShieldCheck className="size-4" aria-hidden="true" />Run checks</>}</Button>
      </CardContent></Card>}

    {draftWaiting && review && <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>What will happen</CardTitle><CardDescription>One row per selected item.{job.plan?.scope === "ItemAndDescendants" ? " Child items are checked by Sitecore during the import." : ""}</CardDescription></div>
        <Button variant="outline" size="sm" onClick={() => void verify()} disabled={busy}>{busy ? "Checking…" : "Check again"}</Button></div>
      <div className="flex flex-wrap gap-2 pt-1" aria-label="Summary">{counts.map(({ outcome, n }) => <span key={outcome} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", outcomes[outcome].badge)}>{n} {outcomes[outcome].label.toLowerCase()}</span>)}</div></CardHeader>
      <CardContent><ul className="space-y-2">{review.map(row => {
        const tone = outcomes[row.outcome]
        return <li key={row.path} className={cn("rounded-lg border border-l-4 p-3", tone.row)}>
          <div className="flex flex-wrap items-center gap-2"><span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", tone.badge)}><tone.icon className="size-3" aria-hidden="true" />{tone.label}</span><span className="min-w-0 break-all font-mono text-xs">{row.path}</span></div>
          {row.outcome === "conflict" ? <div className="mt-2 text-sm"><p className="font-medium text-rose-800">{row.message}</p><p className="mt-1 text-muted-foreground">{fixFor(row.message)}</p></div>
            : <p className="mt-1.5 text-sm text-muted-foreground">{tone.explain}{row.parents ? ` ${row.parents} parent folder${row.parents === 1 ? "" : "s"} matched.` : ""}</p>}
        </li>
      })}</ul></CardContent></Card>}

    {draftWaiting && review && conflicts.length > 0 && <Alert className="border-rose-200 bg-rose-50 text-rose-900"><AlertTriangle aria-hidden="true" /><AlertTitle>Fix {conflicts.length === 1 ? "the conflict" : `${conflicts.length} conflicts`} to continue</AlertTitle><AlertDescription className="text-rose-900">
      <p>Nothing can start while an item is blocked. Fix it in Sitecore and check again, or leave it out.</p>
      {conflicts.length < (review?.length ?? 0) && <Button variant="outline" size="sm" className="mt-2 border-rose-300 bg-card" onClick={dropConflicts}>Leave out blocked items</Button>}
    </AlertDescription></Alert>}

    {draftWaiting && review && !conflicts.length && <Card className="border-t-4 border-t-review"><CardHeader><CardTitle>Before you start</CardTitle><CardDescription>The checks passed. Confirm the points below to approve this transfer.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {["Source and destination are different environments", "Every parent folder exists with the same ID", "No item ID conflicts", "Plan lives only in this tab; keep it open"].map(text => <li key={text} className="flex items-center gap-2"><span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Check className="size-3.5" aria-hidden="true" /></span>{text}</li>)}
        </ul>
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={ackWrite} onCheckedChange={value => setAckWrite(Boolean(value))} className="mt-0.5" /><span>I understand this writes to the destination’s <strong>master</strong> database. Publishing is a separate step.</span></label>
          {updates > 0 && <label className="flex items-start gap-3 text-sm"><Checkbox checked={ackOverwrite} onCheckedChange={value => setAckOverwrite(Boolean(value))} className="mt-0.5" /><span>Overwrite <strong>{updates}</strong> existing destination item{updates === 1 ? "" : "s"} with the source version.</span></label>}
        </div>
        <div className="flex justify-end"><Button size="lg" className="gap-2" onClick={() => void run()} disabled={busy || !ready}><Play className="size-4" aria-hidden="true" />Start transfer</Button></div>
      </CardContent></Card>}

    {job.plan && job.status !== "queued" && <Card><CardHeader><CardTitle>{job.stage ?? "Transfer"}</CardTitle><CardDescription>{job.status === "running" ? "Keep this tab open while chunks are forwarded. Once Sitecore accepts an import, it continues there." : job.startedAt ? `Started ${formatDateTime(job.startedAt)}` : ""}</CardDescription></CardHeader>
      <CardContent className="space-y-4"><Timeline job={job} />{job.exportOperationId && <p className="break-all font-mono text-xs text-muted-foreground">Source export: {job.exportOperationId}</p>}</CardContent></Card>}
    {job.progressKnown && job.status === "running" && <Card><CardContent className="pt-4"><Progress value={job.progress} /><p className="mt-2 text-sm">{job.transferredItemsCount} of {job.itemCount} items written by Sitecore</p></CardContent></Card>}
    {job.nativeState && <p className="text-sm text-muted-foreground">Sitecore state: {job.nativeState}{job.database ? ` · Database: ${job.database}` : ""}{job.itemCount !== undefined ? ` · Items: ${job.itemCount}` : ""}</p>}
    {job.error && <Alert variant="destructive"><AlertTitle>Transfer needs review</AlertTitle><AlertDescription>{job.error} Check the destination history before starting another transfer. Failed writes are not retried automatically.</AlertDescription></Alert>}
    {job.status === "success" && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><Check aria-hidden="true" /><AlertTitle>Import completed</AlertTitle><AlertDescription className="text-emerald-900">Content is in the destination master database. Publish it through your normal workflow to make it live.</AlertDescription></Alert>}

    <Tabs defaultValue="items"><TabsList><TabsTrigger value="items">Items</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
      <TabsContent value="items" className="mt-4"><Card><CardContent className="pt-4">
        {job.plan ? <ul className="space-y-2">{job.plan.itemPaths.map(path => <li key={path} className="break-all font-mono text-sm">{path}</li>)}</ul> : <p className="text-sm text-muted-foreground">This is an import recorded by the destination. {job.sourceFile ? `Source file: ${job.sourceFile}. ` : ""}{job.itemCount === undefined ? "Sitecore did not return an item count." : `${job.itemCount} source items. ${job.transferredItemsCount === undefined ? "Written count unavailable." : `${job.transferredItemsCount} written; kept items are not counted as written.`}`}</p>}
      </CardContent></Card></TabsContent>
      <TabsContent value="settings" className="mt-4"><Card><CardHeader><CardTitle>Transfer settings</CardTitle><CardDescription>Item IDs and field values are preserved by Sitecore’s native content transfer.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">
        <p>What to copy: {job.plan ? (job.plan.scope === "ItemAndDescendants" ? "Selected items and everything under them" : "Selected items only") : "Not recorded in this import"}</p>
        <p>Existing items: {job.plan ? (job.plan.mergeStrategy === "OverrideExistingItem" ? "Overwrite with the source version" : "Keep the destination version") : job.nativeState ? "See the Sitecore transfer record" : "—"}</p>
        <p>Publishing: separate from import</p><p>Deleting or replacing whole trees: not available</p>
      </CardContent></Card></TabsContent>
      <TabsContent value="activity" className="mt-4"><ol className="space-y-3 rounded-xl border bg-card p-4 text-sm">
        {job.history?.length ? job.history.map((event, index) => <li key={index}>{event.Name} · {formatDateTime(event.Date)}</li>) : <li className="text-muted-foreground">No state changes were returned on the current history page.</li>}
        {job.plan && <li>Plan created in this tab {formatDateTime(job.createdAt)}. Plans and chunk progress clear when the tab reloads.</li>}
        <li className="text-muted-foreground">Destination history doesn’t include every export or chunk step.</li>
      </ol></TabsContent>
    </Tabs>
  </div>
}
