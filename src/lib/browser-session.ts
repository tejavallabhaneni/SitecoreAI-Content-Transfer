"use client"

import type { Connections, HistoryRecord, NativeStatus, Plan } from "./sitecore/public-transfer"
import type { ContentItem, Environment, HydratedJob, JobStatus } from "./types"

// Tab memory only. No database, localStorage, sessionStorage, cookies, or files.
let connection: Connections | null = null
let refreshAccessToken: (() => Promise<string>) | null = null
let revision = 0
const listeners = new Set<() => void>()
const drafts = new Map<string, HydratedJob>()
export const subscribeConnection = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const connectionRevision = () => revision
export const serverRevision = () => 0
export const isConnected = () => connection !== null
export function setConnection(value: Connections | null, tokenProvider?: () => Promise<string>) {
  connection = value
  refreshAccessToken = value ? tokenProvider ?? null : null
  drafts.clear()
  revision++
  listeners.forEach(listener => listener())
}

export async function sitecoreAction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const current = connection
  const ownAuthentication = ["connect", "discover", "connectSignedIn"].includes(action)
  if (!ownAuthentication && !current) throw new Error("Connect your SitecoreAI environments first.")
  let requestConnections = current
  if (!ownAuthentication && current && refreshAccessToken) {
    const accessToken = await refreshAccessToken()
    if (current !== connection) throw new Error("The environment connection changed.")
    requestConnections = { source: { ...current.source, accessToken }, destination: { ...current.destination, accessToken } }
  }
  const response = await fetch("/api/sitecore", {
    method: "POST", cache: "no-store", credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, action, ...(ownAuthentication ? {} : { connections: requestConnections }) }),
  })
  const result = await response.json() as { data?: T; error?: string }
  if (!response.ok) throw new Error(result.error ?? `SitecoreAI request failed (${response.status}).`)
  if (!ownAuthentication && current !== connection) throw new Error("The environment connection changed.")
  return result.data as T
}

export function environments(): Environment[] {
  if (!connection) return []
  return (["source", "destination"] as const).map(id => ({
    id, name: id === "source" ? "Source authoring" : "Destination authoring",
    kind: "authoring", region: "", host: new URL(connection![id].baseUrl).hostname, connected: true,
  }))
}

function statusFor(value: string): JobStatus {
  if (value === "Finished") return "success"
  if (value === "Queued") return "queued"
  if (value === "InProgress") return "running"
  return "error"
}

export function nativeJob(current: NativeStatus | undefined, history: HistoryRecord | undefined): HydratedJob {
  const state = current?.TransferState ?? history?.Events?.at(-1)?.Name ?? "Unknown"
  const id = current?.Id ?? history?.Name ?? ""
  const date = current?.ConsumedDate ?? history?.ConsumeDate ?? ""
  const events = history?.Events ?? []
  const count = current?.TotalItemsCount
  const transferred = current?.TransferredItemsCount
  return {
    id: encodeURIComponent(id), nativeId: id, nativeState: state,
    name: current?.SourceName ?? history?.SourceName ?? id, sourceFile: current?.SourceName ?? history?.SourceName,
    sourceEnvId: "", targetEnvId: "destination", source: null,
    target: environments().find(e => e.id === "destination") ?? null,
    status: current?.ValidationErrors?.length ? "error" : statusFor(state), itemIds: [], items: [], mappings: [],
    progress: typeof count === "number" && count > 0 && typeof transferred === "number" ? Math.min(100, Math.round(transferred / count * 100)) : 0,
    progressKnown: typeof count === "number" && count > 0 && typeof transferred === "number",
    itemCount: count, transferredItemsCount: transferred,
    createdAt: date, updatedAt: events.at(-1)?.Date ?? date,
    completedAt: state === "Finished" ? events.at(-1)?.Date : undefined,
    database: current?.DatabaseName, history: events,
    error: current?.ValidationErrors?.length ? current.ValidationErrors.join("; ") : (state === "Failed" || state === "Discarded" ? current?.Description ?? `Native state: ${state}` : undefined),
  }
}

export async function loadJobs(page = 1) {
  if (!connection) return { jobs: [], summary: { queued: 0, running: 0, success: 0, error: 0, total: 0 }, page, totalCount: 0, connected: false }
  const native = await sitecoreAction<{ current: NativeStatus[]; history: HistoryRecord[]; totalCount: number }>("history", { page })
  const jobs: HydratedJob[] = []
  const histories = new Map(native.history.map(record => [record.Name, record]))
  for (const current of native.current) {
    jobs.push(nativeJob(current, histories.get(current.Id)))
    histories.delete(current.Id)
  }
  for (const record of histories.values()) jobs.push(nativeJob(undefined, record))
  if (page === 1) jobs.unshift(...drafts.values())
  const summary = { queued: 0, running: 0, success: 0, error: 0, total: jobs.length }
  for (const job of jobs) summary[job.status]++
  return { jobs, summary, page, totalCount: native.totalCount, connected: true }
}

type RawItem = { itemId: string; name: string; path: string; template?: { name: string }; fields?: { nodes: { name: string }[] } }
export async function loadItems(path = "/sitecore/content", side = "source") {
  if (!connection) return { items: [], hasMore: false }
  const data = await sitecoreAction<{ parent: RawItem; nodes: RawItem[]; pageInfo?: { hasNextPage: boolean } }>("items", { path, side })
  const items: ContentItem[] = [data.parent, ...data.nodes].map(item => ({
    id: item.itemId, name: item.name, path: item.path, template: item.template?.name ?? "",
    language: "", version: 0, lastModified: "", fields: item.fields?.nodes.map(field => field.name) ?? [],
  }))
  return { items, hasMore: data.pageInfo?.hasNextPage ?? false }
}

export async function sessionRead<T>(input: string): Promise<T> {
  const url = new URL(input, window.location.origin)
  if (url.pathname === "/api/environments") return { environments: environments() } as T
  if (url.pathname === "/api/items") return await loadItems(url.searchParams.get("path") ?? undefined, url.searchParams.get("side") ?? undefined) as T
  if (url.pathname === "/api/jobs") {
    const data = await loadJobs(Number(url.searchParams.get("page") ?? 1))
    const status = url.searchParams.get("status")
    return { ...data, jobs: status ? data.jobs.filter(job => job.status === status) : data.jobs } as T
  }
  if (url.pathname.startsWith("/api/jobs/")) {
    const id = url.pathname.slice("/api/jobs/".length)
    const draft = drafts.get(id)
    if (draft) return { job: draft } as T
    const nativeId = decodeURIComponent(id)
    const detail = await sitecoreAction<NativeStatus>("detail", { id: nativeId })
    // History is paginated separately; only attach matching records, never
    // invent creation/export events missing from the destination API.
    const history = await sitecoreAction<{ history: HistoryRecord[] }>("history", { page: 1 })
    return { job: nativeJob(detail, history.history.find(row => row.Name === nativeId)) } as T
  }
  throw new Error("Unsupported workspace request.")
}

export function createDraft(input: { name: string; itemPaths: string[]; scope: Plan["scope"]; mergeStrategy: Plan["mergeStrategy"] }): HydratedJob {
  if (!connection) throw new Error("Connect your environments first.")
  const id = "draft-" + crypto.randomUUID()
  const now = new Date().toISOString()
  const envs = environments()
  const job: HydratedJob = {
    id, name: input.name, sourceEnvId: "source", targetEnvId: "destination", source: envs[0], target: envs[1],
    status: "queued", progress: 0, progressKnown: false, itemIds: [], items: [], mappings: [], createdAt: now, updatedAt: now,
    plan: { itemPaths: input.itemPaths, scope: input.scope, mergeStrategy: input.mergeStrategy }, stage: "Draft — not started",
  }
  drafts.set(id, job)
  return job
}

export async function reviewDraft(id: string) {
  const draft = drafts.get(id)
  if (!draft?.plan) throw new Error("This draft is no longer in this tab. Reconnect and prepare a new plan.")
  return sitecoreAction<{ sourceItem: { itemId: string; path: string }; targetItem: unknown; parentChecks: unknown[] }[]>("preflight", { plan: draft.plan })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 30 * 60_000
  while (Date.now() < deadline) {
    const value = await read()
    if (done(value)) return value
    await sleep(2000)
  }
  throw new Error("The wait timed out. Check the native transfer status before starting another operation.")
}

export async function runDraft(id: string, approved: boolean, overwriteApproved: boolean, update: (job: HydratedJob) => void) {
  const draft = drafts.get(id)
  const session = connection
  if (!draft?.plan || draft.status !== "queued") throw new Error("Prepare a new reviewed transfer plan.")
  const show = (stage: string) => {
    if (session !== connection) throw new Error("Connection changed; inspect native status before continuing.")
    draft.stage = stage; draft.updatedAt = new Date().toISOString(); update({ ...draft })
  }
  try {
    draft.status = "running"
    show("Verifying parents and starting export")
    const start = await sitecoreAction<{ operationId: string }>("start", { plan: draft.plan, approved, overwriteApproved })
    draft.exportOperationId = start.operationId
    show("Waiting for Sitecore export")
    type Export = { State: string; ChunkSetsMetadata?: { ChunkSetId: string; ChunkCount: number }[] }
    const exported = await poll(() => sitecoreAction<Export>("exportStatus", start), value => {
      if (value.State === "Failed" || value.State === "NotFound") throw new Error(`Source export: ${value.State}`)
      if (!["Running", "Completed"].includes(value.State)) throw new Error("Unknown source export state.")
      return value.State === "Completed"
    })
    const sets = exported.ChunkSetsMetadata
    if (!sets?.length || sets.length > 20 || sets.some(set => !Number.isInteger(set.ChunkCount) || set.ChunkCount < 1 || set.ChunkCount > 100_000)) throw new Error("Unexpected export chunk metadata.")
    const files: string[] = []
    let count = 0
    const total = sets.reduce((sum, set) => sum + set.ChunkCount, 0)
    for (const set of sets) {
      for (let chunk = 0; chunk < set.ChunkCount; chunk++) {
        show(`Forwarding chunk ${count + 1} of ${total}`)
        await sitecoreAction("copyChunk", { ...start, chunkSetId: set.ChunkSetId, chunk })
        count++
      }
      show("Completing destination file")
      const file = await sitecoreAction<{ ContentTransferFileName: string }>("completeChunkSet", { ...start, chunkSetId: set.ChunkSetId })
      if (typeof file.ContentTransferFileName !== "string" || !file.ContentTransferFileName.endsWith(".raif")) throw new Error("Destination returned no transfer file.")
      files.push(file.ContentTransferFileName)
    }
    for (const file of files) {
      show("Waiting for destination file")
      await poll(() => sitecoreAction<{ BlobState: string }>("blobStatus", { file }), value => {
        if (["Error", "TransferredWithErrors", "Discarded"].includes(value.BlobState)) throw new Error("Destination file: " + value.BlobState)
        return value.BlobState === "Uploaded"
      })
      show("Starting destination master import")
      await sitecoreAction("import", { file })
      let importId: string | undefined
      await poll(() => sitecoreAction<NativeStatus>("importStatus", { file, importId }), value => {
        importId = value.Id ?? importId
        if (["Failed", "Discarded"].includes(value.TransferState) || value.ValidationErrors?.length) throw new Error("Import needs review: " + (value.ValidationErrors?.join("; ") ?? value.TransferState))
        if (!["Queued", "InProgress", "Unknown", "Finished"].includes(value.TransferState)) throw new Error("Unknown import state.")
        return value.TransferState === "Finished"
      })
    }
    draft.status = "success"; draft.completedAt = new Date().toISOString()
    show("Imported to master — publishing is separate")
  } catch (error) {
    draft.status = "error"
    draft.error = error instanceof Error ? error.message : "Transfer stopped."
    draft.stage = "Stopped — inspect native status before starting another transfer"
    if (session === connection) update({ ...draft })
    throw error
  }
}
