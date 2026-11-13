"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleSlash, LoaderCircle, PencilLine, Play, Plus, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { checkDraft, dropFromDraft, startDraft, useSession, type Draft } from "@/lib/session"
import type { ReviewOutcome, ReviewRow } from "@/lib/transfer"
import { cn } from "@/lib/utils"

const outcomes: Record<ReviewOutcome, { label: string; icon: typeof Plus; badge: string; explain: string }> = {
  create: { label: "Create", icon: Plus, badge: "bg-emerald-100 text-emerald-800", explain: "New in To. It will be created with the same item ID." },
  update: { label: "Update", icon: PencilLine, badge: "bg-amber-100 text-amber-800", explain: "Already in To with the same ID. The From version will overwrite it." },
  keep: { label: "Skip", icon: CircleSlash, badge: "bg-slate-100 text-slate-800", explain: "Already in To with the same ID. The To version is kept." },
  conflict: { label: "Conflict", icon: AlertTriangle, badge: "bg-rose-100 text-rose-800", explain: "" },
}

function fixFor(message = "") {
  if (/different Sitecore item ID|different ID/i.test(message)) return "This item was created separately in each environment, so the IDs don’t match. Rename or delete it in To, or sync it with serialization, then check again."
  if (/Missing required parent/i.test(message)) return "A parent folder isn’t in To yet. Tick the parent too (with “everything under them”), or copy it first."
  if (/not found/i.test(message)) return "The item isn’t in From any more. Leave it out and pick again."
  return "Check the item in both environments, then check again."
}

const phases = ["Package on From", "Copy chunks", "Prepare file on To", "Import into To", "Done"]

function Timeline({ draft }: { draft: Draft }) {
  const current = draft.status === "done" ? 6 : draft.phase ?? 0
  return <ol aria-label="Transfer progress" className="grid gap-3 sm:grid-cols-5">
    {phases.map((label, index) => {
      const step = index + 1
      const done = step < current
      const failed = draft.status === "failed" && step === current
      const active = draft.status === "running" && step === current
      return <li key={label} className="flex items-center gap-3 sm:flex-col sm:text-center">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
          failed ? "border-rose-300 bg-rose-100 text-rose-800" : done ? "border-emerald-300 bg-emerald-100 text-emerald-800" : active ? "border-white bg-white/20" : "border-white/30 text-muted-foreground")}>
          {failed ? <X className="size-4" aria-hidden="true" /> : done ? <Check className="size-4" aria-hidden="true" /> : active ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : step}
        </span>
        <span className={cn("text-xs", active || failed ? "font-semibold" : done ? "" : "text-muted-foreground")}>{label}<span className="sr-only">{failed ? " (failed)" : done ? " (done)" : active ? " (in progress)" : ""}</span></span>
      </li>
    })}
  </ol>
}

export function ReviewTransfer({ id }: { id: string }) {
  const session = useSession()
  const draft = session.drafts.get(id)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<ReviewRow[] | null>(null)
  const [ackWrite, setAckWrite] = useState(false)
  const [ackOverwrite, setAckOverwrite] = useState(false)

  if (!draft) return <div className="surface mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold">This transfer isn’t in this tab</h1>
    <p className="mt-2 text-sm text-muted-foreground">Transfers live only in the tab that made them, so reloading clears them. Imports that already started continue in SitecoreAI.</p>
    <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />Start a new transfer</Link></div>

  const conflicts = review?.filter(row => row.outcome === "conflict") ?? []
  const updates = review?.filter(row => row.outcome === "update").length ?? 0
  const ready = Boolean(review && !conflicts.length && ackWrite && (!updates || ackOverwrite))
  const counts = (["create", "update", "keep", "conflict"] as const).map(outcome => ({ outcome, n: review?.filter(row => row.outcome === outcome).length ?? 0 })).filter(entry => entry.n)

  async function check() {
    setBusy(true); setReview(null); setAckWrite(false); setAckOverwrite(false)
    try { setReview(await checkDraft(id)) }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "The check couldn’t run.") }
    finally { setBusy(false) }
  }
  function leaveOut() {
    try { dropFromDraft(id, conflicts.map(row => row.path)); setReview(rows => rows?.filter(row => row.outcome !== "conflict") ?? null) }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Couldn’t change the plan.") }
  }
  async function run() {
    setBusy(true)
    try { await startDraft(id, ackOverwrite); toast.success("Import finished. Publish in To when you’re ready.") }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "The transfer stopped.") }
    finally { setBusy(false) }
  }

  return <div className="mx-auto flex max-w-4xl flex-col gap-6">
    <div><Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" />Back</Link>
      <h1 className="page-title mt-2 break-words">{draft.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-white/15 px-3 py-1">{draft.source.name}</span><ArrowRight className="size-4" aria-hidden="true" /><span className="rounded-full bg-white/15 px-3 py-1">{draft.destination.name}</span></p></div>

    {draft.status === "draft" && !review && <section className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-semibold">Check before anything is written</h2><p className="mt-1 text-sm text-muted-foreground">Reads both environments and shows what will happen to each of the {draft.plan.itemPaths.length} item{draft.plan.itemPaths.length === 1 ? "" : "s"}.</p></div>
      <Button size="lg" className="gap-2" onClick={() => void check()} disabled={busy}>{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Checking…</> : <><ShieldCheck className="size-4" aria-hidden="true" />Check</>}</Button>
    </section>}

    {draft.status === "draft" && review && <section className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">What will happen</h2>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Summary">{counts.map(({ outcome, n }) => <span key={outcome} className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", outcomes[outcome].badge)}>{n} {outcomes[outcome].label.toLowerCase()}</span>)}</div></div>
        <Button variant="outline" size="sm" onClick={() => void check()} disabled={busy}>{busy ? "Checking…" : "Check again"}</Button></div>
      <ul className="mt-4 space-y-2">{review.map(row => {
        const tone = outcomes[row.outcome]
        return <li key={row.path} className="rounded-lg border bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tone.badge)}><tone.icon className="size-3" aria-hidden="true" />{tone.label}</span><span className="min-w-0 break-all font-mono text-xs">{row.path}</span></div>
          {row.outcome === "conflict" ? <div className="mt-2 text-sm"><p className="font-semibold">{row.message}</p><p className="mt-1 text-muted-foreground">{fixFor(row.message)}</p></div>
            : <p className="mt-1.5 text-sm text-muted-foreground">{tone.explain}{draft.plan.scope === "ItemAndDescendants" ? " Items under it are checked by Sitecore during the import." : ""}</p>}
        </li>
      })}</ul>
      {conflicts.length > 0 && <div role="alert" className="mt-4 rounded-lg bg-rose-100 p-4 text-sm text-rose-800">
        <p className="font-semibold">Fix {conflicts.length === 1 ? "the conflict" : `${conflicts.length} conflicts`} to continue</p>
        <p className="mt-1">Fix it in SitecoreAI and check again, or leave it out.</p>
        {conflicts.length < review.length && <Button variant="outline" size="sm" className="mt-3 border-rose-300 bg-transparent text-rose-800 hover:bg-rose-200" onClick={leaveOut}>Leave out blocked items</Button>}
      </div>}
    </section>}

    {draft.status === "draft" && review && !conflicts.length && <section className="surface space-y-4 p-5">
      <h2 className="font-semibold">Approve</h2>
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={ackWrite} onCheckedChange={value => setAckWrite(Boolean(value))} className="mt-0.5" /><span>Write these items to the <strong>master</strong> database of {draft.destination.name}. Publishing is a separate step.</span></label>
      {updates > 0 && <label className="flex items-start gap-3 text-sm"><Checkbox checked={ackOverwrite} onCheckedChange={value => setAckOverwrite(Boolean(value))} className="mt-0.5" /><span>Overwrite <strong>{updates}</strong> existing item{updates === 1 ? "" : "s"} in {draft.destination.name}.</span></label>}
      <div className="flex justify-end"><Button size="lg" className="gap-2" onClick={() => void run()} disabled={busy || !ready}><Play className="size-4" aria-hidden="true" />Start transfer</Button></div>
    </section>}

    {draft.status !== "draft" && <section className="surface space-y-4 p-5" aria-live="polite">
      <h2 className="font-semibold">{draft.status === "failed" ? "Transfer stopped" : draft.stage ?? "Transfer"}</h2>
      <Timeline draft={draft} />
      {draft.status === "running" && <p className="text-sm text-muted-foreground">Keep this tab open while chunks are copied. Once the import starts, SitecoreAI finishes it.</p>}
      {draft.status === "done" && <div className="rounded-lg bg-emerald-100 p-4 text-sm text-emerald-800"><p className="font-semibold">{draft.error ? "Imported with errors" : "Import complete"}</p>
        <p className="mt-1">{draft.error ?? `${draft.items ?? 0} item${draft.items === 1 ? " was" : "s were"} sent to the master database of ${draft.destination.name}.${draft.plan.mergeStrategy === "KeepExistingItem" ? " Items that were already there were kept as they were." : ""} Publish when you’re ready.`}</p></div>}
      {draft.status === "failed" && <div role="alert" className="rounded-lg bg-rose-100 p-4 text-sm text-rose-800"><p className="font-semibold">What went wrong</p><p className="mt-1">{draft.error} Check {draft.destination.name} before trying again. Failed writes aren’t retried automatically.</p></div>}
      {draft.status !== "running" && <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">Start another transfer<ArrowRight className="size-4" aria-hidden="true" /></Link>}
    </section>}

    <details className="surface p-5 text-sm"><summary className="cursor-pointer font-semibold">Items and settings</summary>
      <ul className="mt-3 space-y-1">{draft.plan.itemPaths.map(path => <li key={path} className="break-all font-mono text-xs">{path}</li>)}</ul>
      <p className="mt-3">What to copy: {draft.plan.scope === "ItemAndDescendants" ? "the items and everything under them" : "only the ticked items"}</p>
      <p>If it already exists: {draft.plan.mergeStrategy === "OverrideExistingItem" ? "overwrite with the From version" : "keep the To version"}</p>
    </details>
  </div>
}
