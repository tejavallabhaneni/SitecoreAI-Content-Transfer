"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, ArrowRight, LoaderCircle, Sparkles, X } from "lucide-react"
import { ContentTree } from "@/components/content-tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { backend, choose, createDraft, start, startDemo, useSession } from "@/lib/session"
import type { Merge, Scope, TreeNode } from "@/lib/transfer"

const steps = [
  { title: "Install the app in every environment", text: "In the Sitecore Cloud Portal, open App Studio and install Content Transfer. Give it access to each environment you want to copy between." },
  { title: "Open it and pick From and To", text: "Open Content Transfer from SitecoreAI. It lists the environments it’s installed in. Choose where to copy from and where to copy to." },
  { title: "Tick what to copy", text: "Open folders in the From tree and tick pages or media. Badges show what’s New, what Exists, and what has a different ID." },
  { title: "Review and start", text: "Check what will happen to each item, approve, and start. Then publish in the destination when you’re ready." },
]

export function HowToUse({ compact = false }: { compact?: boolean }) {
  return <section aria-labelledby="how-heading" className="surface p-5 sm:p-6">
    <h2 id="how-heading" className="text-lg font-semibold">How to use Content Transfer</h2>
    <ol className={compact ? "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "mt-4 grid gap-4 sm:grid-cols-2"}>
      {steps.map((step, index) => <li key={step.title} className="flex gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">{index + 1}</span>
        <div><p className="font-semibold">{step.title}</p>{!compact && <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>}</div>
      </li>)}
    </ol>
  </section>
}

function Intro() {
  return <div><h1 className="page-title">Copy content between SitecoreAI environments</h1>
    <p className="page-description">Pick two environments, tick what to copy, review, and start. Nothing is written until you approve it.</p></div>
}

const selectClass = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm"

export function TransferHome() {
  const router = useRouter()
  const session = useSession()
  const [selected, setSelected] = useState<Map<string, TreeNode>>(new Map())
  const [scope, setScope] = useState<Scope>("SingleItem")
  const [merge, setMerge] = useState<Merge>("KeepExistingItem")
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  useEffect(() => { void start() }, [])

  const toggle = (node: TreeNode, on: boolean) => setSelected(old => {
    const next = new Map(old)
    if (on) next.set(node.path.toLowerCase(), node); else next.delete(node.path.toLowerCase())
    return next
  })

  function review() {
    setError("")
    try {
      const draft = createDraft(name, { itemPaths: [...selected.values()].map(node => node.path), scope, mergeStrategy: merge })
      router.push(`/review/${draft.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t prepare the transfer.") }
  }

  if (session.status === "starting" || session.status === "loading") {
    return <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Intro />
      <p className="surface flex items-center gap-3 p-6"><LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Finding the environments this app is installed in…</p>
    </div>
  }

  if (session.status !== "ready" || session.envs.length < 2) {
    const message = session.status === "error" ? session.error
      : session.status === "ready" ? "Content Transfer is installed in fewer than two environments. Install it in each environment you want to copy between, then open it again."
      : "Open Content Transfer from SitecoreAI to see your environments, or try it now with sample environments."
    return <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Intro />
      <section className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="max-w-xl text-sm leading-6">{message}</p>
        <Button size="lg" className="gap-2" onClick={startDemo}><Sparkles className="size-4" aria-hidden="true" />Try the demo</Button>
      </section>
      <HowToUse />
    </div>
  }

  const sourceEnv = session.envs.find(env => env.id === session.source)
  const destinationEnv = session.envs.find(env => env.id === session.destination)
  const same = session.source === session.destination
  const treeKey = `${session.version}-${session.source}-${session.destination}`

  return <div className="mx-auto flex max-w-6xl flex-col gap-6">
    <Intro />
    <HowToUse compact />

    <section aria-label="Environments" className="surface grid items-end gap-4 p-5 sm:grid-cols-[1fr_auto_1fr]">
      <div className="grid gap-2"><Label htmlFor="from-env">From</Label>
        <select id="from-env" className={selectClass} value={session.source} onChange={event => { choose("source", event.target.value); setSelected(new Map()) }}>
          {session.envs.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}</select></div>
      <Button variant="outline" size="icon" className="mx-auto" aria-label="Swap From and To" onClick={() => { const from = session.source!; choose("source", session.destination!); choose("destination", from); setSelected(new Map()) }}>
        <ArrowLeftRight className="size-4" aria-hidden="true" /></Button>
      <div className="grid gap-2"><Label htmlFor="to-env">To</Label>
        <select id="to-env" className={selectClass} value={session.destination} onChange={event => choose("destination", event.target.value)}>
          {session.envs.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}</select></div>
      {same && <p role="alert" className="text-sm text-rose-200 sm:col-span-3">Pick two different environments.</p>}
    </section>

    {!same && <div className="grid gap-4 lg:grid-cols-2">
      <section className="surface flex min-h-80 flex-col" aria-labelledby="from-tree">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3"><h2 id="from-tree" className="font-semibold">From: {sourceEnv?.name}</h2><span className="text-xs text-muted-foreground">Tick items to copy</span></div>
        <div className="max-h-[28rem] overflow-auto p-2"><ContentTree key={`s-${treeKey}`} backend={backend()} env={session.source!} compareTo={session.destination} label={`Content tree of ${sourceEnv?.name}`} selected={new Set(selected.keys())} onToggle={toggle} /></div>
      </section>
      <section className="surface flex min-h-80 flex-col" aria-labelledby="to-tree">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3"><h2 id="to-tree" className="font-semibold">To: {destinationEnv?.name}</h2><span className="text-xs text-muted-foreground">What’s there now</span></div>
        <div className="max-h-[28rem] overflow-auto p-2"><ContentTree key={`d-${treeKey}`} backend={backend()} env={session.destination!} label={`Content tree of ${destinationEnv?.name}`} /></div>
      </section>
    </div>}

    {!same && <section className="surface grid gap-4 p-5 sm:grid-cols-2" aria-label="Transfer settings">
      <div className="sm:col-span-2">
        <p className="text-sm font-semibold">Selected ({selected.size})</p>
        {selected.size ? <ul className="mt-2 flex flex-wrap gap-2">{[...selected.values()].map(node => <li key={node.path} className="flex max-w-full items-center gap-1 rounded-full bg-white/15 py-1 pr-1 pl-3 text-xs">
          <span className="truncate" title={node.path}>{node.path.replace(/^\/sitecore\/(content|media library)\//i, "")}</span>
          <button type="button" className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Remove ${node.name}`} onClick={() => toggle(node, false)}><X className="size-3.5" aria-hidden="true" /></button></li>)}</ul>
          : <p className="mt-1 text-sm text-muted-foreground">Nothing yet. Tick items in the From tree.</p>}
      </div>
      <div className="grid gap-2"><Label htmlFor="scope">What to copy</Label><select id="scope" className={selectClass} value={scope} onChange={event => setScope(event.target.value as Scope)}>
        <option value="SingleItem">Only the ticked items</option><option value="ItemAndDescendants">Ticked items and everything under them</option></select></div>
      <div className="grid gap-2"><Label htmlFor="merge">If it already exists in To</Label><select id="merge" className={selectClass} value={merge} onChange={event => setMerge(event.target.value as Merge)}>
        <option value="KeepExistingItem">Keep the To version (safe)</option><option value="OverrideExistingItem">Overwrite with the From version</option></select></div>
      <div className="grid gap-2 sm:col-span-2"><Label htmlFor="name">Name (optional)</Label><Input id="name" className="h-10" value={name} maxLength={120} onChange={event => setName(event.target.value)} placeholder={`${sourceEnv?.name} → ${destinationEnv?.name}`} /></div>
      {error && <p role="alert" className="rounded-lg bg-rose-100 p-3 text-sm text-rose-800 sm:col-span-2">{error}</p>}
      <div className="flex justify-end sm:col-span-2"><Button size="lg" className="gap-2" disabled={!selected.size} onClick={review}>Review {selected.size || ""} item{selected.size === 1 ? "" : "s"}<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
    </section>}
  </div>

}
