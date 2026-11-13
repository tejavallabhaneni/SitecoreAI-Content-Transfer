"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleSlash, LoaderCircle, PencilLine, Play, Plus, RefreshCcw, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MERGE_OPTIONS, Stepper, resetWizard } from "@/components/transfer-home"
import { checkDraft, dropFromDraft, startDraft, useSession, type Draft } from "@/lib/session"
import { approvalsFor, type ReviewOutcome, type ReviewRow } from "@/lib/transfer"
import { cn } from "@/lib/utils"

const outcomes: Record<ReviewOutcome, { label: string; icon: typeof Plus; badge: string; explain: string }> = {
  create: { label: "Create", icon: Plus, badge: "bg-emerald-100 text-emerald-800", explain: "New in To. It will be created with the same item ID." },
  update: { label: "Overwrite", icon: PencilLine, badge: "bg-amber-100 text-amber-800", explain: "Already in To with the same ID. The From version will replace it." },
  replace: { label: "Replace tree", icon: RefreshCcw, badge: "bg-orange-100 text-orange-800", explain: "To will match From exactly under this item." },
  keep: { label: "Skip", icon: CircleSlash, badge: "bg-slate-100 text-slate-800", explain: "Already in To with the same ID. The To version is kept." },
  conflict: { label: "Conflict", icon: AlertTriangle, badge: "bg-rose-100 text-rose-800", explain: "" },
}

function fixFor(message = "") {
  if (/different Sitecore item ID|different ID/i.test(message)) return "This item was created separately in each environment, so the IDs don’t match. Rename or delete it in To, or sync it with serialization, then check again."
  if (/Missing required parent/i.test(message)) return "A parent folder isn’t in To yet. Select the parent “with sub-items” too, or copy it first."
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

const scopeLabel = (scope: string) => scope === "ItemAndDescendants" ? "with sub-items" : "item only"

export function ReviewTransfer({ id }: { id: string }) {
  const session = useSession()
  const draft = session.drafts.get(id)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<ReviewRow[] | null>(null)
  const [ackWrite, setAckWrite] = useState(false)
  const [ackOverwrite, setAckOverwrite] = useState(false)
  const [ackDelete, setAckDelete] = useState(false)

  if (!draft) return <div className="surface mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold">This transfer isn’t in this tab</h1>
    <p className="mt-2 text-sm text-muted-foreground">Transfers live only in the tab that made them, so reloading clears them. Imports that already started continue in SitecoreAI.</p>
    <Link href="/" onClick={resetWizard} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />Start a new transfer</Link></div>

  const needs = approvalsFor(draft.plan)
  const conflicts = review?.filter(row => row.outcome === "conflict") ?? []
  const updates = review?.filter(row => row.outcome === "update" || row.outcome === "replace").length ?? 0
  const removals = review?.flatMap(row => row.removes ?? []) ?? []
  const truncated = review?.some(row => row.removesTruncated) ?? false
  const ready = Boolean(review && !conflicts.length && ackWrite && (!needs.overwrite || ackOverwrite) && (!needs.delete || ackDelete))
  const counts = (["create", "update", "replace", "keep", "conflict"] as const).map(outcome => ({ outcome, n: review?.filter(row => row.outcome === outcome).length ?? 0 })).filter(entry => entry.n)
  const mergeLabel = MERGE_OPTIONS.find(option => option.value === draft.plan.mergeStrategy)?.label

  async function check() {
    setBusy(true); setReview(null); setAckWrite(false); setAckOverwrite(false); setAckDelete(false)
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
    try { await startDraft(id, { overwriteApproved: ackOverwrite, deleteApproved: ackDelete }); toast.success("Import finished. Publish in To when you’re ready.") }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "The transfer stopped.") }
    finally { setBusy(false) }
  }

  return <div className="mx-auto flex max-w-6xl flex-col gap-6">
    <Stepper current={4} />
    <div>{draft.status === "draft" && <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" />Back to settings</Link>}
      <h1 className="page-title mt-2 break-words">{draft.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-white/15 px-3 py-1">{draft.source.name}</span><ArrowRight className="size-4" aria-hidden="true" /><span className="rounded-full bg-white/15 px-3 py-1">{draft.destination.name}</span><span className="text-muted-foreground">· {mergeLabel}</span></p></div>

    {draft.status === "draft" && !review && <section className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-semibold">Check before anything is written</h2><p className="mt-1 text-sm text-muted-foreground">Reads both environments and shows what will happen to each of the {draft.plan.items.length} selected item{draft.plan.items.length === 1 ? "" : "s"}.</p></div>
      <Button size="lg" className="gap-2" onClick={() => void check()} disabled={busy}>{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Checking…</> : <><ShieldCheck className="size-4" aria-hidden="true" />Check</>}</Button>
    </section>}

    {draft.status === "draft" && review && <section className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">What will happen</h2>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Summary">{counts.map(({ outcome, n }) => <span key={outcome} className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", outcomes[outcome].badge)}>{n} {outcomes[outcome].label.toLowerCase()}</span>)}
          {removals.length > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">{removals.length}{truncated ? "+" : ""} to delete</span>}</div></div>
        <Button variant="outline" size="sm" onClick={() => void check()} disabled={busy}>{busy ? "Checking…" : "Check again"}</Button></div>
      <ul className="mt-4 space-y-2">{review.map(row => {
        const tone = outcomes[row.outcome]
        return <li key={row.path} className="rounded-lg border bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tone.badge)}><tone.icon className="size-3" aria-hidden="true" />{tone.label}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{scopeLabel(row.scope)}</span><span className="min-w-0 break-all font-mono text-xs">{row.path}</span></div>
          {row.outcome === "conflict" ? <div className="mt-2 text-sm"><p className="font-semibold">{row.message}</p><p className="mt-1 text-muted-foreground">{fixFor(row.message)}</p></div>
            : <p className="mt-1.5 text-sm text-muted-foreground">{tone.explain}{row.scope === "ItemAndDescendants" && row.outcome !== "replace" ? " Its sub-items follow the same rule." : ""}</p>}
          {row.outcome === "replace" && <div className="mt-2 text-sm">{row.removes?.length
            ? <><p className="font-semibold text-rose-300">Deletes {row.removes.length}{row.removesTruncated ? "+" : ""} item{row.removes.length === 1 && !row.removesTruncated ? " in To that isn’t" : "s in To that aren’t"} in From:</p>
              <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto">{row.removes.slice(0, 50).map(path => <li key={path} className="break-all font-mono text-xs text-muted-foreground">{path}</li>)}</ul>
              {row.removes.length > 50 && <p className="mt-1 text-xs text-muted-foreground">…and {row.removes.length - 50} more.</p>}</>
            : <p className="text-muted-foreground">Nothing in To would be deleted right now.</p>}</div>}
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
      {needs.overwrite && <label className="flex items-start gap-3 text-sm"><Checkbox checked={ackOverwrite} onCheckedChange={value => setAckOverwrite(Boolean(value))} className="mt-0.5" /><span>{updates > 0
        ? <>Overwrite <strong>{updates}</strong> existing item{updates === 1 ? "" : "s"} in {draft.destination.name} with the From version.</>
        : <>Overwrite matching items in {draft.destination.name} if any appear there before the transfer runs.</>}</span></label>}
      {needs.delete && <label className="flex items-start gap-3 rounded-lg bg-[#4a0a1c]/70 p-3 text-sm"><Checkbox checked={ackDelete} onCheckedChange={value => setAckDelete(Boolean(value))} className="mt-0.5" /><span>
        <strong>Delete</strong> {removals.length ? <><strong>{removals.length}{truncated ? "+" : ""}</strong> item{removals.length === 1 && !truncated ? "" : "s"}</> : "any items"} in {draft.destination.name} that {removals.length === 1 && !truncated ? "isn’t" : "aren’t"} in {draft.source.name}, under the trees being replaced. This can’t be undone from this app.</span></label>}
      <div className="flex justify-end"><Button size="lg" className="gap-2" onClick={() => void run()} disabled={busy || !ready}><Play className="size-4" aria-hidden="true" />Start transfer</Button></div>
    </section>}

    {draft.status !== "draft" && <section className="surface space-y-4 p-5" aria-live="polite">
      <h2 className="font-semibold">{draft.status === "failed" ? "Transfer stopped" : draft.stage ?? "Transfer"}</h2>
      <Timeline draft={draft} />
      {draft.status === "running" && <p className="text-sm text-muted-foreground">Keep this tab open while chunks are copied. Once the import starts, SitecoreAI finishes it.</p>}
      {draft.status === "done" && <div className="rounded-lg bg-emerald-100 p-4 text-sm text-emerald-800"><p className="font-semibold">{draft.error ? "Imported with errors" : "Import complete"}</p>
        <p className="mt-1">{draft.error ?? `${draft.items ?? 0} item${draft.items === 1 ? " was" : "s were"} sent to the master database of ${draft.destination.name}.${draft.plan.mergeStrategy === "KeepExistingItem" ? " Items that were already there were kept as they were." : ""} Publish when you’re ready.`}</p></div>}
      {draft.status === "failed" && <div role="alert" className="rounded-lg bg-rose-100 p-4 text-sm text-rose-800"><p className="font-semibold">What went wrong</p><p className="mt-1">{draft.error} Check {draft.destination.name} before trying again. Failed writes aren’t retried automatically.</p></div>}
      {draft.status !== "running" && <Link href="/" onClick={resetWizard} className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">Start another transfer<ArrowRight className="size-4" aria-hidden="true" /></Link>}
    </section>}

    <details className="surface p-5 text-sm"><summary className="cursor-pointer font-semibold">Items and settings</summary>
      <ul className="mt-3 space-y-1">{draft.plan.items.map(item => <li key={item.path} className="break-all font-mono text-xs">{item.path} <span className="font-sans text-muted-foreground">({scopeLabel(item.scope)})</span></li>)}</ul>
      <p className="mt-3">If it already exists in To: {mergeLabel}</p>
    </details>
  </div>
}
