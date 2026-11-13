"use client"

// Tab memory only: no database, cookies, localStorage or server state.

import { useSyncExternalStore } from "react"
import { DEMO_ENVS, demoBackend, resetDemo } from "./demo-sitecore"
import { inMarketplaceHost, installedEnvironments, marketplaceBackend } from "./marketplace"
import { planProblem, reviewPlan, runTransfer, type Backend, type Env, type Plan, type ReviewRow } from "./transfer"

export type Status = "starting" | "outside" | "loading" | "ready" | "error"
export type Draft = {
  id: string; name: string; plan: Plan; source: Env; destination: Env
  status: "draft" | "running" | "done" | "failed"; phase?: number; stage?: string; error?: string
  items?: number; createdAt: string; startedAt?: string; finishedAt?: string
}
type State = { status: Status; demo: boolean; envs: Env[]; error?: string; source?: string; destination?: string; drafts: Map<string, Draft>; version: number }

let state: State = { status: "starting", demo: false, envs: [], drafts: new Map(), version: 0 }
const listeners = new Set<() => void>()
function set(change: Partial<State>) {
  state = { ...state, ...change, version: state.version + 1 }
  listeners.forEach(listener => listener())
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const serverState: State = { status: "starting", demo: false, envs: [], drafts: new Map(), version: 0 }

export const useSession = () => useSyncExternalStore(subscribe, () => state, () => serverState)
export const backend = (): Backend => state.demo ? demoBackend : marketplaceBackend

/** Inside SitecoreAI: read the environments the app is installed in. Outside: show the how-to and demo. */
export async function start() {
  if (state.status !== "starting") return
  if (!inMarketplaceHost()) { set({ status: "outside" }); return }
  set({ status: "loading" })
  try {
    const envs = await installedEnvironments()
    set({ status: "ready", envs, source: envs[0]?.id, destination: envs[1]?.id })
  } catch (error) {
    set({ status: "error", error: error instanceof Error ? error.message : "Couldn’t read the app’s environments." })
  }
}

export function startDemo() {
  resetDemo()
  set({ demo: true, status: "ready", envs: DEMO_ENVS, source: DEMO_ENVS[0].id, destination: DEMO_ENVS[1].id, drafts: new Map(), error: undefined })
}
export function leaveDemo() {
  set({ demo: false, status: "starting", envs: [], source: undefined, destination: undefined, drafts: new Map() })
  void start()
}

export function choose(side: "source" | "destination", id: string) {
  set(side === "source" ? { source: id } : { destination: id })
}

export function createDraft(name: string, plan: Plan): Draft {
  const source = state.envs.find(env => env.id === state.source)
  const destination = state.envs.find(env => env.id === state.destination)
  if (!source || !destination) throw new Error("Pick a From and a To environment.")
  if (source.id === destination.id) throw new Error("Pick two different environments.")
  const problem = planProblem(plan)
  if (problem) throw new Error(problem)
  const draft: Draft = { id: crypto.randomUUID(), name: name.trim() || `${source.name} → ${destination.name}`, plan, source, destination, status: "draft", createdAt: new Date().toISOString() }
  set({ drafts: new Map(state.drafts).set(draft.id, draft) })
  return draft
}

function update(id: string, change: Partial<Draft>) {
  const draft = state.drafts.get(id)
  if (draft) set({ drafts: new Map(state.drafts).set(id, { ...draft, ...change }) })
}

export function dropFromDraft(id: string, paths: string[]) {
  const draft = state.drafts.get(id)
  if (!draft || draft.status !== "draft") throw new Error("Only a transfer that hasn’t started can be changed.")
  const drop = new Set(paths.map(path => path.toLowerCase()))
  const items = draft.plan.items.filter(item => !drop.has(item.path.toLowerCase()))
  if (!items.length) throw new Error("Nothing would be left to transfer. Choose different content.")
  update(id, { plan: { ...draft.plan, items } })
}

export async function checkDraft(id: string): Promise<ReviewRow[]> {
  const draft = state.drafts.get(id)
  if (!draft) throw new Error("This transfer is no longer in this tab.")
  return reviewPlan(backend(), draft.source.id, draft.destination.id, draft.plan)
}

export async function startDraft(id: string, approval: { overwriteApproved: boolean; deleteApproved: boolean }) {
  const draft = state.drafts.get(id)
  if (!draft || draft.status !== "draft") throw new Error("This transfer has already started.")
  update(id, { status: "running", startedAt: new Date().toISOString(), phase: 1, stage: "Starting" })
  try {
    const result = await runTransfer(backend(), draft.source.id, draft.destination.id, draft.plan, { approved: true, ...approval },
      progress => update(id, { phase: progress.phase, stage: progress.stage, items: progress.items }))
    update(id, { status: "done", phase: 5, items: result.items, finishedAt: new Date().toISOString(), ...(result.partial ? { error: "Some items did not import. Check the destination." } : {}) })
  } catch (error) {
    update(id, { status: "failed", error: error instanceof Error ? error.message : "The transfer stopped.", finishedAt: new Date().toISOString() })
    throw error
  }
}
