"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleSlash, LoaderCircle, PencilLine, Play, Plus, RefreshCcw, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MERGE_OPTIONS, Stepper, resetWizard, restoreWizard } from "@/components/transfer-home"
import { addToDraft, checkDraft, dropFromDraft, startDraft, useSession, type Draft } from "@/lib/session"
import { approvalsFor, knownFix, type ReviewOutcome, type ReviewRow, type SubItem, type SubItemState } from "@/lib/transfer"
import { cn } from "@/lib/utils"

const outcomes: Record<ReviewOutcome, { label: string; icon: typeof Plus; badge: string; explain: string }> = {
  create: { label: "Create", icon: Plus, badge: "bg-emerald-100 text-emerald-800", explain: "New in To. It will be created with the same item ID." },
  update: { label: "Overwrite", icon: PencilLine, badge: "bg-amber-100 text-amber-800", explain: "Already in To with the same ID. The From version will replace it." },
  replace: { label: "Replace tree", icon: RefreshCcw, badge: "bg-orange-100 text-orange-800", explain: "To will match From exactly under this item." },
  keep: { label: "Skip", icon: CircleSlash, badge: "bg-slate-100 text-slate-800", explain: "Already in To with the same ID. The To version is kept." },
  conflict: { label: "Conflict", icon: AlertTriangle, badge: "bg-rose-100 text-rose-800", explain: "" },
}

function fixFor(message = "") {
  if (/Template.*missing in the destination/i.test(message)) return "Sitecore can’t import an item whose template isn’t in To. Add the missing templates to this transfer (they’re copied first), or leave this item out."
  if (/Parent item has a different ID/i.test(message)) return "That folder exists in both environments but was created separately, so its ID differs. Items keep their parent’s ID, so they can’t be placed under To’s folder without becoming orphaned. See the summary above."
  if (/different Sitecore item ID|different ID/i.test(message)) return "This item exists in both environments but was created separately, so the IDs don’t match. Sync it with serialization, or delete it in To if it’s unused, then check again."
  if (/Missing required parent in To/i.test(message)) return "Add the missing parent folders to this transfer (they’re copied before the item), or leave this item out."
  if (/Missing required parent/i.test(message)) return "A parent folder isn’t in From. Check the item’s location, or leave it out."
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

const subTone: Record<SubItemState, { label: string; badge: string }> = {
  new: { label: "Will be added", badge: "bg-emerald-100 text-emerald-800" },
  exists: { label: "Already in To", badge: "bg-slate-100 text-slate-800" },
  differs: { label: "Different item at same path", badge: "bg-rose-100 text-rose-800" },
}

/** What happens to each sub-item of an item copied with its sub-items. */
function SubItems({ items, truncated, merge }: { items: SubItem[]; truncated?: boolean; merge: string }) {
  const count = (state: SubItemState) => items.filter(item => item.state === state).length
  const [added, existing, differs] = [count("new"), count("exists"), count("differs")]
  const existingText = merge === "KeepExistingItem" ? "kept as they are" : merge === "OverrideExistingTree" ? "replaced" : "overwritten"
  if (!items.length) return <p className="mt-2 text-sm text-muted-foreground">It has no sub-items in From.</p>
  return <div className="mt-2 text-sm">
    <p><strong>{items.length}{truncated ? "+" : ""} sub-item{items.length === 1 ? "" : "s"}:</strong>{" "}
      <span className="text-emerald-300">{added} will be added</span>
      {existing > 0 && <> · {existing} already in To ({existingText})</>}
      {differs > 0 && <> · <span className="text-rose-300">{differs} with a different item at the same path</span></>}</p>
    {differs > 0 && merge !== "OverrideExistingTree" && <p className="mt-1 text-xs text-rose-300">A different item already uses that path in To, so the copy would sit next to it with the same name. Rename or remove it in To, or use Replace whole trees.</p>}
    <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">Show every sub-item</summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-auto">{items.map(item => <li key={item.path} className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("rounded-full px-2 py-0.5 font-semibold", subTone[item.state].badge)}>{subTone[item.state].label}</span><span className="break-all font-mono text-muted-foreground">{item.path}</span></li>)}</ul>
      {truncated && <p className="mt-1 text-xs text-muted-foreground">Showing the first 2,000 sub-items.</p>}
    </details>
  </div>
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
  const updates = (review?.filter(row => row.outcome === "update" || row.outcome === "replace").length ?? 0)
    + (draft.plan.mergeStrategy === "KeepExistingItem" ? 0 : review?.flatMap(row => row.subItems ?? []).filter(item => item.state === "exists").length ?? 0)
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
  async function addParents(paths: string[]) {
    try { addToDraft(id, paths.map(path => ({ path, scope: "SingleItem" as const }))); toast.success(`Added ${paths.length} parent folder${paths.length === 1 ? "" : "s"}. They’ll be copied first.`); await check() }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Couldn’t add the parent folders.") }
  }
  async function addTemplates(paths: string[]) {
    try { addToDraft(id, paths.map(path => ({ path, scope: "SingleItem" as const }))); toast.success(`Added ${paths.length} template${paths.length === 1 ? "" : "s"}. They’ll be copied first.`); await check() }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Couldn’t add the templates.") }
  }
  function leaveOut(rows: ReviewRow[] = conflicts) {
    const drop = new Set(rows.map(row => row.path))
    try { dropFromDraft(id, [...drop]); setReview(current => current?.filter(row => !drop.has(row.path)) ?? null) }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Couldn’t change the plan.") }
  }
  // Conflicts grouped by what causes them, so each cause is shown and fixed once.
  const idGroups = new Map<string, ReviewRow[]>()
  for (const row of conflicts) if (row.idConflictAt) idGroups.set(row.idConflictAt, [...(idGroups.get(row.idConflictAt) ?? []), row])
  const allParents = [...new Set(conflicts.flatMap(row => row.missingParents ?? []))].sort()
  const allTemplates = [...new Map(conflicts.flatMap(row => row.missingTemplates ?? []).filter(template => template.path).map(template => [template.path!.toLowerCase(), template])).values()]
  async function run() {
    setBusy(true)
    try { await startDraft(id, { overwriteApproved: ackOverwrite, deleteApproved: ackDelete }); toast.success("Import finished. Publish in To when you’re ready.") }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "The transfer stopped.") }
    finally { setBusy(false) }
  }

  return <div className="mx-auto flex max-w-6xl flex-col gap-6">
    <Stepper current={4} />
    <div>{draft.status === "draft" && <Link href="/" onClick={() => restoreWizard(draft)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" />Back to settings</Link>}
      <h1 className="page-title mt-2 break-words">{draft.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-white/15 px-3 py-1">{draft.source.name}</span><ArrowRight className="size-4" aria-hidden="true" /><span className="rounded-full bg-white/15 px-3 py-1">{draft.destination.name}</span><span className="text-muted-foreground">· {mergeLabel}</span></p></div>

    {draft.status === "draft" && !review && <section className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-semibold">Check before anything is written</h2><p className="mt-1 text-sm text-muted-foreground">Reads both environments and shows what will happen to each of the {draft.plan.items.length} selected item{draft.plan.items.length === 1 ? "" : "s"}.</p></div>
      <Button size="lg" className="gap-2" onClick={() => void check()} disabled={busy}>{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Checking…</> : <><ShieldCheck className="size-4" aria-hidden="true" />Check</>}</Button>
    </section>}

    {draft.status === "draft" && review && conflicts.length > 0 && <section className="surface space-y-4 border-rose-300/40 p-5" aria-labelledby="fix-heading">
      <div><h2 id="fix-heading" className="font-semibold">Fix these first</h2><p className="mt-1 text-sm text-muted-foreground">{conflicts.length} item{conflicts.length === 1 ? " is" : "s are"} blocked, by {idGroups.size + (allParents.length ? 1 : 0) + (allTemplates.length ? 1 : 0)} cause{idGroups.size + (allParents.length ? 1 : 0) + (allTemplates.length ? 1 : 0) === 1 ? "" : "s"}.</p></div>
      {allParents.length > 0 && <div className="rounded-lg border bg-white/5 p-4 text-sm">
        <p className="font-semibold">{allParents.length} parent folder{allParents.length === 1 ? " is" : "s are"} missing in {draft.destination.name}</p>
        <ul className="mt-2 space-y-0.5">{allParents.map(path => <li key={path} className="break-all font-mono text-xs text-muted-foreground">{path}</li>)}</ul>
        <Button size="sm" className="mt-3" disabled={busy} onClick={() => void addParents(allParents)}>Add all missing parent folders</Button>
        <p className="mt-2 text-xs text-muted-foreground">They’re copied before the items inside them.</p>
      </div>}
      {allTemplates.length > 0 && <div className="rounded-lg border bg-white/5 p-4 text-sm">
        <p className="font-semibold">{allTemplates.length} template{allTemplates.length === 1 ? " is" : "s are"} missing in {draft.destination.name}</p>
        <ul className="mt-2 space-y-0.5">{allTemplates.map(template => <li key={template.path} className="text-xs text-muted-foreground"><span className="font-semibold text-white">{template.name}</span> · <span className="break-all font-mono">{template.path}</span></li>)}</ul>
        <Button size="sm" className="mt-3" disabled={busy} onClick={() => void addTemplates(allTemplates.map(template => template.path!))}>Add all missing templates</Button>
        <p className="mt-2 text-xs text-muted-foreground">Templates are copied first, in their own step.</p>
      </div>}
      {[...idGroups].map(([folder, rows]) => <div key={folder} className="rounded-lg border bg-white/5 p-4 text-sm">
        <p className="font-semibold">“{folder.split("/").at(-1)}” exists in both environments with a different ID</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{folder}</p>
        <p className="mt-2 text-muted-foreground">It was created separately in each environment. Content Transfer keeps item IDs, so items from {draft.source.name} can’t be placed under {draft.destination.name}’s copy of this folder. Blocks {rows.length} selected item{rows.length === 1 ? "" : "s"}.</p>
        <p className="mt-2 text-xs text-muted-foreground">To transfer them: sync this folder between the environments with serialization so the IDs match, or, if {draft.destination.name}’s folder is unused, delete it there and copy it from {draft.source.name} with its sub-items.</p>
        <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={() => leaveOut(rows)}>Leave out the {rows.length} blocked item{rows.length === 1 ? "" : "s"}</Button>
      </div>)}
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
          {row.outcome === "conflict" ? <div className="mt-2 text-sm"><p className="font-semibold">{row.message}</p>
              {row.missingTemplates?.length ? <>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{row.missingTemplates.map(template => <li key={template.id}>
                  <span className="font-semibold text-white">{template.name}</span> · <>used by {template.usedBy} item{template.usedBy === 1 ? "" : "s"}</>
                  {template.path && <span className="block break-all font-mono">{template.path}</span>}</li>)}</ul>
              </> : null}
              {row.missingParents?.length ? <>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{row.missingParents.map(parent => <li key={parent} className="break-all font-mono">{parent}</li>)}</ul>
              </> : null}
              <p className="mt-1 text-muted-foreground">{fixFor(row.message)}</p></div>
            : <p className="mt-1.5 text-sm text-muted-foreground">{tone.explain}</p>}
          {row.templatesFirst?.length ? <p className="mt-2 text-xs text-emerald-300">Uses template{row.templatesFirst.length === 1 ? "" : "s"} that To doesn’t have yet; {row.templatesFirst.length === 1 ? "it’s" : "they’re"} in this transfer and will be copied first: {row.templatesFirst.map(path => path.split("/").at(-1)).join(", ")}.</p> : null}
          {row.outcome !== "conflict" && row.subItems && <SubItems items={row.subItems} truncated={row.subItemsTruncated} merge={draft.plan.mergeStrategy} />}
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
        {conflicts.length < review.length && <Button variant="outline" size="sm" className="mt-3 border-rose-300 bg-transparent text-rose-800 hover:bg-rose-200" onClick={() => leaveOut()}>Leave out blocked items</Button>}
      </div>}
    </section>}

    {draft.status === "draft" && review && !conflicts.length && <section className="surface space-y-4 p-5">
      <h2 className="font-semibold">Approve</h2>
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={ackWrite} onCheckedChange={value => setAckWrite(Boolean(value))} className="mt-0.5" /><span>Write these items to the <strong>authoring database (master)</strong> of {draft.destination.name}. They won’t be live until you publish them.</span></label>
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
        <p className="mt-1">{draft.error ?? `${draft.items ?? 0} item${draft.items === 1 ? " was" : "s were"} sent to the authoring database (master) of ${draft.destination.name}.${draft.plan.mergeStrategy === "KeepExistingItem" ? " Items that were already there were kept as they were." : ""} Publish when you’re ready.`}</p></div>}
      {draft.status === "failed" && <div role="alert" className="rounded-lg bg-rose-100 p-4 text-sm text-rose-800"><p className="font-semibold">What went wrong</p><p className="mt-1 break-words">{/[.!?]$/.test(draft.error?.trim() ?? "") ? draft.error : `${draft.error ?? "The transfer stopped"}.`}</p>
        <p className="mt-2">{draft.wrote ? <>Some items may already be in {draft.destination.name}. Check it before trying again.</> : <>Nothing was imported into {draft.destination.name}, so it’s safe to try again.</>}</p>
        <FixSteps fix={knownFix(draft.error, draft.destination.name)} /></div>}
      {draft.status !== "running" && <Link href="/" onClick={resetWizard} className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">Start another transfer<ArrowRight className="size-4" aria-hidden="true" /></Link>}
    </section>}

    <details className="surface p-5 text-sm"><summary className="cursor-pointer font-semibold">Items and settings</summary>
      <ul className="mt-3 space-y-1">{draft.plan.items.map(item => <li key={item.path} className="break-all font-mono text-xs">{item.path} <span className="font-sans text-muted-foreground">({scopeLabel(item.scope)})</span></li>)}</ul>
      <p className="mt-3">If it already exists in To: {mergeLabel}</p>
    </details>
  </div>
}

function FixSteps({ fix }: { fix: ReturnType<typeof knownFix> }) {
  if (!fix) return null
  return (
    <div className="mt-3 border-t border-rose-300 pt-3">
      <p className="font-semibold">How to fix this</p>
      <p className="mt-1">{fix.summary}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">{fix.steps.map(step => <li key={step} className="break-words">{step}</li>)}</ol>
      {fix.link && <a href={fix.link.href} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium underline underline-offset-2">{fix.link.label}</a>}
    </div>
  )
}
