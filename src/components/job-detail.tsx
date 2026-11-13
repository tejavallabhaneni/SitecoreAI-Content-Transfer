"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, Play } from "lucide-react"
import { toast } from "sonner"
import { StatusBadge } from "@/components/status-badge"
import { WorkflowSteps } from "@/components/workflow-steps"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/hooks/use-api"
import { reviewDraft, runDraft } from "@/lib/browser-session"
import { formatDateTime } from "@/lib/format"
import type { HydratedJob } from "@/lib/types"

export function JobDetail({ jobId }: { jobId: string }) {
  const { data, error, loading, reload, setData } = useApi<{ job: HydratedJob }>(`/api/jobs/${encodeURIComponent(jobId)}`, 4000)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<Awaited<ReturnType<typeof reviewDraft>> | null>(null)
  const job = data?.job
  async function verify() {
    setBusy(true); setReview(null)
    try { setReview(await reviewDraft(jobId)); toast.success("Transfer checks passed. You can review and start the transfer.") }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Preflight failed.") }
    finally { setBusy(false) }
  }
  async function run() {
    if (!job?.plan || !review) return
    if (!window.confirm(`Transfer ${job.plan.itemPaths.join(", ")} to ${job.target?.host}? Scope: ${job.plan.scope}. Existing items: ${job.plan.mergeStrategy}. This writes to master; publishing is separate.`)) return
    const overwriteApproved = job.plan.mergeStrategy !== "OverrideExistingItem" || window.confirm("Overwrite matching destination items with source values?")
    if (!overwriteApproved) return
    setBusy(true); setReview(null)
    try { await runDraft(jobId, true, overwriteApproved, updated => setData({ job: updated })); toast.success("Destination imports finished. Publishing remains separate.") }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Transfer stopped.") }
    finally { setBusy(false) }
  }
  if (loading && !job) return <p className="text-sm text-muted-foreground">Reading transfer details…</p>
  if (error || !job) return <Alert variant="destructive"><AlertTitle>Job could not be loaded</AlertTitle><AlertDescription>{error ?? "Reconnect and open a native transfer, or prepare a new draft."} <button type="button" className="underline" onClick={() => reload()}>Try again</button> · <Link href="/" className="underline">All jobs</Link></AlertDescription></Alert>

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    {job.plan && <WorkflowSteps active={3} />}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><Link href="/" className="text-sm text-muted-foreground">← All transfers</Link>
        <h1 className="mt-2 break-all text-2xl font-semibold tracking-tight">{job.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{job.source?.host ?? "Source not recorded by destination API"}<ArrowRight className="size-4" />{job.target?.host ?? "Destination"}</p></div>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={job.status} />
        {job.plan && job.status === "queued" && <><Button variant="outline" onClick={() => void verify()} disabled={busy}>{busy ? "Checking…" : "Check transfer"}</Button><Button onClick={() => void run()} disabled={busy || !review}><Play />Start transfer</Button></>}
      </div>
    </div>
    {review && <Alert><AlertTitle>Ready for your approval</AlertTitle><AlertDescription>{review.length} selected content roots passed the source and destination checks. Review the content and settings below, then start the transfer.</AlertDescription></Alert>}
    {job.stage && <Card><CardHeader><CardTitle>{job.stage}</CardTitle><CardDescription>Keep this tab open while it forwards chunks. Imports already accepted by Sitecore continue there.</CardDescription></CardHeader>
      {job.exportOperationId && <CardContent><p className="break-all font-mono text-xs">Source export: {job.exportOperationId}</p></CardContent>}</Card>}
    {job.progressKnown && job.status === "running" && <Card><CardContent className="pt-4"><Progress value={job.progress} /><p className="mt-2 text-sm">{job.transferredItemsCount} of {job.itemCount} items written by Sitecore</p></CardContent></Card>}
    {job.nativeState && <p className="text-sm text-muted-foreground">Native state: {job.nativeState}{job.database ? ` · Database: ${job.database}` : ""}{job.itemCount !== undefined ? ` · Items: ${job.itemCount}` : ""}</p>}
    {job.error && <Alert variant="destructive"><AlertTitle>Transfer needs review</AlertTitle><AlertDescription>{job.error} Check destination history and the source export before starting another transfer. Failed write operations are not retried automatically.</AlertDescription></Alert>}
    {job.status === "success" && <Alert><AlertTitle>Import completed</AlertTitle><AlertDescription>Content was imported into the destination master database. Follow your normal publishing workflow to make it live.</AlertDescription></Alert>}
    <Tabs defaultValue="items"><TabsList><TabsTrigger value="items">Items</TabsTrigger><TabsTrigger value="settings">Transfer settings</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
      <TabsContent value="items" className="mt-4"><Card><CardContent className="pt-4">
        {job.plan ? <ul className="space-y-2">{job.plan.itemPaths.map(path => <li key={path} className="break-all font-mono text-sm">{path}</li>)}</ul> : <p className="text-sm text-muted-foreground">This is a native destination import. {job.sourceFile ? `Source file: ${job.sourceFile}. ` : ""}{job.itemCount === undefined ? "Sitecore did not return an item count in this response." : `${job.itemCount} source items. ${job.transferredItemsCount === undefined ? "Written count unavailable." : `${job.transferredItemsCount} written; kept existing items are not counted as written.`}`}</p>}
      </CardContent></Card></TabsContent>
      <TabsContent value="settings" className="mt-4"><Card><CardHeader><CardTitle>Native transfer settings</CardTitle><CardDescription>Item IDs and fields are preserved. Native content transfer does not provide AI field remapping.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">
        <p>Scope: {job.plan?.scope ?? "Not recorded in this import response"}</p><p>Existing items: {job.plan?.mergeStrategy ?? "See the native transfer record"}</p><p>Publishing: separate from import</p><p>Tree replacement and delete operations: unavailable</p>
      </CardContent></Card></TabsContent>
      <TabsContent value="activity" className="mt-4"><ol className="space-y-3 rounded-xl border p-4 text-sm">
        {job.history?.length ? job.history.map((event,index) => <li key={index}>{event.Name} · {formatDateTime(event.Date)}</li>) : <li className="text-muted-foreground">No matching state-change events were returned on the current history page.</li>}
        {job.plan && <li>Tab-local draft created {formatDateTime(job.createdAt)}. Drafts and chunk progress are cleared on reload.</li>}
        <li className="text-muted-foreground">Destination history does not include every source export or chunk-forwarding step.</li>
      </ol></TabsContent>
    </Tabs>
  </div>
}
