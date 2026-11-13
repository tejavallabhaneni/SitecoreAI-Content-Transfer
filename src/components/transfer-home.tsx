"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, LoaderCircle, Sparkles, X } from "lucide-react"
import { ContentTree, ScopeToggle, type TreeController } from "@/components/content-tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { backend, choose, createDraft, start, startDemo, useSession } from "@/lib/session"
import type { Merge, Scope, TreeNode } from "@/lib/transfer"
import { cn } from "@/lib/utils"

const howTo = [
  { title: "Install the app in every environment", text: "In the Sitecore Cloud Portal, open App Studio and install Content Transfer. Give it access to each environment you want to copy between." },
  { title: "Open it and pick From and To", text: "Open Content Transfer from SitecoreAI. It lists the environments it’s installed in. Choose where to copy from and where to copy to." },
  { title: "Tick what to copy", text: "Open folders in the From tree and tick pages or media. Badges show what’s New, what Exists, and what has a different ID." },
  { title: "Review and start", text: "Check what will happen to each item, approve, and start. Then publish in the destination when you’re ready." },
]

export function HowToUse() {
  return <section aria-labelledby="how-heading" className="surface p-5 sm:p-6">
    <h2 id="how-heading" className="text-lg font-semibold">How to use Content Transfer</h2>
    <ol className="mt-4 grid gap-4 sm:grid-cols-2">
      {howTo.map((step, index) => <li key={step.title} className="flex gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">{index + 1}</span>
        <div><p className="font-semibold">{step.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p></div>
      </li>)}
    </ol>
  </section>
}

const STEPS = ["Environments", "Choose content", "Settings", "Review & start"]

/** The four-step progress bar shown at the top of every step. */
export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return <ol aria-label="Steps" className="surface grid grid-cols-4 gap-1 p-2 sm:gap-2 sm:p-3">
    {STEPS.map((label, index) => {
      const step = index + 1
      const done = step < current
      const active = step === current
      return <li key={label} aria-current={active ? "step" : undefined} className={cn("flex flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center text-xs sm:flex-row sm:gap-2 sm:px-3 sm:text-left sm:text-sm", active && "bg-white/15 font-semibold")}>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold", active ? "bg-brand-red text-white" : done ? "bg-emerald-100 text-emerald-800" : "bg-white/10 text-muted-foreground")}>
          {done ? <Check className="size-4" aria-hidden="true" /> : step}</span>
        <span className={cn(!active && !done && "text-muted-foreground")}><span className="sr-only">Step {step}{done ? " (done)" : ""}: </span>{label}</span>
      </li>
    })}
  </ol>
}

// Kept outside the component so Back from the review page returns to the same step and selection.
type Picked = { node: TreeNode; scope: Scope }
type Wizard = { step: 1 | 2 | 3; selected: Map<string, Picked>; merge: Merge; name: string }
const fresh = (): Wizard => ({ step: 1, selected: new Map(), merge: "KeepExistingItem", name: "" })
let saved: Wizard = fresh()
/** Starts the next transfer from step 1 with nothing selected. */
export function resetWizard() { saved = fresh() }
/** Back from the review: Settings shows the transfer as it is now, including items added there. */
export function restoreWizard(draft: { name: string; plan: { items: { path: string; scope: Scope }[]; mergeStrategy: Merge } }) {
  const selected = new Map<string, Picked>(draft.plan.items.map(item => [item.path.toLowerCase(), {
    node: saved.selected.get(item.path.toLowerCase())?.node ?? { id: item.path, name: item.path.split("/").at(-1) ?? item.path, path: item.path, template: "", hasChildren: true },
    scope: item.scope,
  }]))
  saved = { step: 3, selected, merge: draft.plan.mergeStrategy, name: draft.name }
}

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px]"

/** The three ways Sitecore's Content Transfer handles items that already exist in the destination. */
export const MERGE_OPTIONS: { value: Merge; label: string; text: string; tone: string }[] = [
  { value: "KeepExistingItem", label: "Keep what’s in To", text: "Safest. Adds items that are missing in To and leaves existing ones as they are.", tone: "bg-emerald-100 text-emerald-800" },
  { value: "OverrideExistingItem", label: "Overwrite existing items", text: "Adds missing items and replaces existing ones with the From version. Nothing is deleted.", tone: "bg-amber-100 text-amber-800" },
  { value: "OverrideExistingTree", label: "Replace whole trees", text: "For items copied with sub-items: To ends up exactly like From, so items in To that From doesn’t have are deleted. Single items are overwritten.", tone: "bg-orange-100 text-orange-800" },
]

export function TransferHome() {
  const router = useRouter()
  const session = useSession()
  const [step, setStep] = useState(saved.step)
  const [selected, setSelected] = useState(saved.selected)
  const [merge, setMerge] = useState(saved.merge)
  const [name, setName] = useState(saved.name)
  const [error, setError] = useState("")
  const toTree = useRef<TreeController>(null)

  useEffect(() => { void start() }, [])
  useEffect(() => { saved = { step, selected, merge, name } }, [step, selected, merge, name])

  const toggle = (node: TreeNode, on: boolean) => setSelected(old => {
    const next = new Map(old)
    if (on) next.set(node.path.toLowerCase(), { node, scope: "SingleItem" }); else next.delete(node.path.toLowerCase())
    return next
  })
  const setScope = (path: string, scope: Scope) => setSelected(old => {
    const picked = old.get(path.toLowerCase())
    return picked ? new Map(old).set(path.toLowerCase(), { ...picked, scope }) : old
  })
  const setAllScopes = (scope: Scope) => setSelected(old => new Map([...old].map(([key, picked]) => [key, { ...picked, scope: picked.node.hasChildren ? scope : "SingleItem" }])))
  const go = (next: 1 | 2 | 3) => { setError(""); setStep(next); window.scrollTo({ top: 0 }) }

  function review() {
    setError("")
    try {
      // An item inside a folder copied with sub-items is already included: leave it out instead of failing.
      const picks = [...selected.values()]
      const covered = picks.filter(pick => picks.some(parent => parent !== pick && parent.scope === "ItemAndDescendants" && pick.node.path.toLowerCase().startsWith(parent.node.path.toLowerCase() + "/")))
      if (covered.length) {
        setSelected(old => { const next = new Map(old); covered.forEach(pick => next.delete(pick.node.path.toLowerCase())); return next })
        toast.info(`${covered.map(pick => pick.node.name).join(", ")} ${covered.length === 1 ? "is" : "are"} already included by a folder copied with sub-items.`)
      }
      const items = picks.filter(pick => !covered.includes(pick)).map(pick => ({ path: pick.node.path, scope: pick.scope }))
      const draft = createDraft(name, { items, mergeStrategy: merge })
      router.push(`/review/${draft.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t prepare the transfer.") }
  }

  if (session.status === "starting" || session.status === "loading") {
    return <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Title />
      <p className="surface flex items-center gap-3 p-6"><LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Finding the environments this app is installed in…</p>
    </div>
  }

  if (session.status !== "ready" || session.envs.length < 2) {
    const message = session.status === "error" ? session.error
      : session.status === "ready" ? "Content Transfer is installed in fewer than two environments. Install it in each environment you want to copy between, then open it again."
      : "Open Content Transfer from SitecoreAI to see your environments, or try it now with sample environments."
    return <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Title />
      <section className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="max-w-xl text-[15px] leading-6">{message}</p>
        <Button size="lg" className="gap-2" onClick={startDemo}><Sparkles className="size-4" aria-hidden="true" />Try the demo</Button>
      </section>
      <HowToUse />
    </div>
  }

  const sourceEnv = session.envs.find(env => env.id === session.source)
  const destinationEnv = session.envs.find(env => env.id === session.destination)
  const same = session.source === session.destination
  const route = <span className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-white/15 px-3 py-1">{sourceEnv?.name}</span><ArrowRight className="size-4" aria-hidden="true" /><span className="rounded-full bg-white/15 px-3 py-1">{destinationEnv?.name}</span></span>

  return <div className="mx-auto flex max-w-6xl flex-col gap-6">
    <Title />
    <Stepper current={step} />

    {step === 1 && <section aria-labelledby="env-heading" className="surface p-5 sm:p-7">
      <h2 id="env-heading" className="text-xl font-semibold">Where are you copying from and to?</h2>
      <p className="mt-1 text-sm text-muted-foreground">These are the environments Content Transfer is installed in.</p>
      <div className="mt-6 grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="grid gap-2"><Label htmlFor="from-env" className="text-[15px]">From</Label>
          <select id="from-env" className={selectClass} value={session.source} onChange={event => { choose("source", event.target.value); setSelected(new Map()) }}>
            {session.envs.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}</select></div>
        <Button variant="outline" size="icon" className="mx-auto size-11" aria-label="Swap From and To" onClick={() => { const from = session.source!; choose("source", session.destination!); choose("destination", from); setSelected(new Map()) }}>
          <ArrowLeftRight className="size-4" aria-hidden="true" /></Button>
        <div className="grid gap-2"><Label htmlFor="to-env" className="text-[15px]">To</Label>
          <select id="to-env" className={selectClass} value={session.destination} onChange={event => choose("destination", event.target.value)}>
            {session.envs.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}</select></div>
      </div>
      {same && <p role="alert" className="mt-4 text-sm text-rose-300">Pick two different environments.</p>}
      <div className="mt-7 flex justify-end"><Button size="lg" className="gap-2" disabled={same} onClick={() => go(2)}>Next: choose content<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
    </section>}

    {step === 2 && <>
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-3 pl-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">{route}<span className="text-sm font-semibold">{selected.size ? `${selected.size} selected` : "Nothing selected yet"}</span></div>
        <div className="flex gap-2"><Button variant="outline" size="lg" className="gap-2" onClick={() => go(1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>
          <Button size="lg" className="gap-2" disabled={!selected.size} onClick={() => go(3)}>Next: settings<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">Tick items in From. For a ticked folder, choose <strong className="text-white">Item</strong> or <strong className="text-white">+ Sub-items</strong>. Badges compare each item with To.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface flex min-w-0 flex-col" aria-labelledby="from-tree">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b px-5 py-3"><h2 id="from-tree" className="truncate text-lg font-semibold">From: {sourceEnv?.name}</h2><span className="shrink-0 text-xs text-muted-foreground">Tick to copy</span></div>
          <div className="h-[max(24rem,calc(100dvh-24rem))] overflow-auto p-3"><ContentTree key={`s-${session.source}-${session.destination}`} backend={backend()} env={session.source!} compareTo={session.destination} label={`Content tree of ${sourceEnv?.name}`}
            selected={new Map([...selected].map(([key, picked]) => [key, picked.scope]))} onToggle={toggle} onScope={(node, scope) => setScope(node.path, scope)}
            onExpandChange={(path, isOpen) => toTree.current?.follow(path, isOpen)} /></div>
        </section>
        <section className="surface flex min-w-0 flex-col" aria-labelledby="to-tree">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b px-5 py-3"><h2 id="to-tree" className="truncate text-lg font-semibold">To: {destinationEnv?.name}</h2><span className="shrink-0 text-xs text-muted-foreground">What’s there now</span></div>
          <div className="h-[max(24rem,calc(100dvh-24rem))] overflow-auto p-3"><ContentTree key={`d-${session.version}-${session.destination}`} backend={backend()} env={session.destination!} label={`Content tree of ${destinationEnv?.name}`} controllerRef={toTree} /></div>
        </section>
      </div>
      {selected.size > 0 && <div className="surface p-4"><p className="text-sm font-semibold">Selected</p>
        <ul className="mt-2 flex flex-wrap gap-2">{[...selected.values()].map(({ node, scope }) => <li key={node.path} className="flex max-w-full items-center gap-1 rounded-full bg-white/15 py-1 pr-1 pl-3 text-xs">
          <span className="truncate" title={node.path}>{node.name}{scope === "ItemAndDescendants" ? " + sub-items" : ""}</span>
          <button type="button" className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Remove ${node.name}`} onClick={() => toggle(node, false)}><X className="size-3.5" aria-hidden="true" /></button></li>)}</ul></div>}
    </>}

    {step === 3 && <section aria-labelledby="settings-heading" className="surface grid gap-6 p-5 sm:p-7">
      <div><h2 id="settings-heading" className="text-xl font-semibold">How should it copy?</h2><div className="mt-3">{route}</div></div>

      <fieldset className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><legend className="text-[15px] font-semibold">What to copy ({selected.size})</legend>
          <div className="flex gap-2 text-xs"><Button type="button" variant="outline" size="sm" onClick={() => setAllScopes("SingleItem")}>All: item only</Button><Button type="button" variant="outline" size="sm" onClick={() => setAllScopes("ItemAndDescendants")}>All: with sub-items</Button></div></div>
        <ul className="divide-y divide-white/10 rounded-lg border">{[...selected.values()].map(({ node, scope }) => <li key={node.path} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0"><p className="truncate font-medium">{node.name}</p><p className="truncate font-mono text-xs text-muted-foreground" title={node.path}>{node.path}</p></div>
          <ScopeToggle value={scope} disabled={!node.hasChildren} onChange={value => setScope(node.path, value)} label={node.name} />
        </li>)}</ul>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[15px] font-semibold">If an item already exists in To</legend>
        <div className="grid gap-3 md:grid-cols-3">{MERGE_OPTIONS.map(option => <label key={option.value} className={cn("flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-white/10", merge === option.value && "border-white bg-white/15")}>
          <span className="flex items-center gap-2"><input type="radio" name="merge" value={option.value} checked={merge === option.value} onChange={() => setMerge(option.value)} className="size-4 accent-[#e8213a]" />
            <span className="font-semibold">{option.label}</span></span>
          <span className="text-sm leading-6 text-muted-foreground">{option.text}</span>
          {option.value === "OverrideExistingTree" && <span className={cn("self-start rounded-full px-2 py-0.5 text-xs font-semibold", option.tone)}>Can delete items in To</span>}
        </label>)}</div>
      </fieldset>

      <div className="grid gap-2"><Label htmlFor="name" className="text-[15px]">Name (optional)</Label><Input id="name" className="h-11" value={name} maxLength={120} onChange={event => setName(event.target.value)} placeholder={`${sourceEnv?.name} → ${destinationEnv?.name}`} /></div>
      {error && <p role="alert" className="rounded-lg bg-[#4a0a1c]/80 p-3 text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" size="lg" className="gap-2" onClick={() => go(2)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>
        <Button size="lg" className="gap-2" onClick={review}>Next: review<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
    </section>}
  </div>
}

function Title() {
  return <div><h1 className="page-title">Copy content between SitecoreAI environments</h1>
    <p className="page-description">Four short steps. Nothing is written until you approve it.</p></div>
}
