"use client"

// Runs inside SitecoreAI as a Marketplace app. The host lists the environments
// the app is installed in (`application.context` → `resourceAccess`), and every
// call is addressed to one of them by its Sitecore Context ID. No credentials,
// sign-in or server proxy: the SDK bridge to the host does the authentication.

import type { ClientSDK } from "@sitecore-marketplace-sdk/client"
import type { Backend, ChunkSet, Env, TreeNode } from "./transfer"

const BRIDGE_TIMEOUT_MS = 200_000
const CALL_TIMEOUT_MS = 60_000
const CHUNK_TIMEOUT_MS = 180_000

let client: ClientSDK | null = null
let starting: Promise<ClientSDK> | null = null

/** True when the page is framed, which is how SitecoreAI opens Marketplace apps. */
export const inMarketplaceHost = () => typeof window !== "undefined" && window.parent !== window

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.trim() !== "")?.trim() ?? ""
const message = (error: unknown) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"

async function sdk(): Promise<ClientSDK> {
  if (client) return client
  if (!inMarketplaceHost()) throw new Error("Open Content Transfer from SitecoreAI to use your environments.")
  starting ??= (async () => {
    try {
      const [{ ClientSDK }, xmc] = await Promise.all([import("@sitecore-marketplace-sdk/client"), import("@sitecore-marketplace-sdk/xmc")])
      client = await ClientSDK.init({ target: window.parent, timeout: BRIDGE_TIMEOUT_MS, modules: [xmc.XMC] })
      return client
    } catch (error) {
      starting = null
      throw new Error(`Couldn’t connect to SitecoreAI: ${message(error)}. Refresh the page.`)
    }
  })()
  return starting
}

function race<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what}: no response within ${Math.round(ms / 1000)}s`)), ms) })])
    .finally(() => clearTimeout(timer))
}

/** `query` wraps results as `{ data: { data, error, response } }`; `mutate` doesn't. Walk down to the payload. */
function unwrap<T>(result: unknown, what: string): T | null {
  let current = record(result)
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current.error) throw Object.assign(new Error(`${what}: ${text(record(current.error)?.message, current.error) || "failed"}`), { status: record(current.response)?.status })
    const status = record(current.response)?.status
    if (typeof status === "number" && status >= 400) throw Object.assign(new Error(`${what} answered HTTP ${status}.`), { status })
    const inner = current.data
    const innerRecord = record(inner)
    if (!innerRecord || inner instanceof Blob || !("data" in innerRecord || "error" in innerRecord || "response" in innerRecord)) return (inner as T) ?? null
    current = innerRecord
  }
  return null
}

/** The environments this app is installed in. */
export async function installedEnvironments(): Promise<Env[]> {
  const sdkClient = await sdk()
  const result = await race(sdkClient.query("application.context"), 20_000, "Reading the app’s environments")
  if (result.error) throw new Error(`Reading the app’s environments failed: ${message(result.error)}`)
  let data = record(result.data) ?? {}
  if (!data.resourceAccess && record(data.data)?.resourceAccess) data = record(data.data)!
  const resources = Array.isArray(data.resourceAccess) ? data.resourceAccess : Array.isArray(data.resources) ? data.resources : []
  const seen = new Set<string>()
  const envs: Env[] = []
  for (const entry of resources) {
    const resource = record(entry)
    if (!resource) continue
    const context = record(resource.context)
    const id = text(context?.live, resource.contextId, context?.preview)
    if (!id || seen.has(id)) continue
    seen.add(id)
    envs.push({ id, name: text(resource.tenantDisplayName, resource.environmentName, resource.tenantName) || id, tenant: text(resource.tenantName) || undefined })
  }
  return envs
}

async function graphql<T>(env: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const sdkClient = await sdk()
  const result = await race(sdkClient.mutate("xmc.authoring.graphql" as never, { params: { query: { sitecoreContextId: env }, body: { query, variables } } } as never), CALL_TIMEOUT_MS, "Reading content")
  let payload = record(result)
  for (let depth = 0; depth < 4 && payload && !("item" in payload) && !payload.errors; depth++) payload = record(payload.data)
  const errors = payload?.errors
  if (Array.isArray(errors) && errors.length) throw new Error(`SitecoreAI could not read the content tree: ${text(record(errors[0])?.message) || "GraphQL error"}`)
  return (payload ?? {}) as T
}

async function call<T>(kind: "query" | "mutate", operation: string, env: string, params: Record<string, unknown>, timeout = CALL_TIMEOUT_MS): Promise<T | null> {
  const sdkClient = await sdk()
  const query = { ...(record(params.query) ?? {}), sitecoreContextId: env }
  const request = { params: { ...params, query }, timeoutMs: timeout } as never
  const promise = kind === "query" ? sdkClient.query(operation as never, request) : sdkClient.mutate(operation as never, request)
  return unwrap<T>(await race(promise as Promise<unknown>, timeout, operation), operation)
}

type RawItem = { itemId: string; name: string; path: string; template?: { name?: string }; children?: { nodes?: unknown[] } }
const FIELDS = "itemId name path template { name } children(first: 1) { nodes { itemId } }"
const node = (item: RawItem): TreeNode => ({ id: item.itemId, name: item.name, path: item.path, template: item.template?.name ?? "", hasChildren: Boolean(item.children?.nodes?.length) })

export const marketplaceBackend: Backend = {
  pollMs: 2000,
  async children(env, path) {
    const data = await graphql<{ item?: { children?: { nodes?: RawItem[] } } | null }>(env,
      `query Children($path: String!) { item(where: { database: "master", path: $path }) { itemId children(first: 200) { nodes { ${FIELDS} } } } }`, { path })
    if (!data.item) throw new Error("That folder doesn’t exist in this environment.")
    return (data.item.children?.nodes ?? []).map(node)
  },
  async item(env, path) {
    const data = await graphql<{ item?: { itemId: string; path: string } | null }>(env,
      `query Item($path: String!) { item(where: { database: "master", path: $path }) { itemId path } }`, { path })
    return data.item ? { id: data.item.itemId, path: data.item.path } : null
  },
  async createTransfer(env, transferId, trees) {
    await call("mutate", "xmc.contentTransfer.createContentTransfer", env, { body: { transferId, configuration: { dataTrees: trees } } })
  },
  async transferStatus(env, transferId) {
    try {
      const data = record(await call("query", "xmc.contentTransfer.getContentTransferStatus", env, { path: { transferId } })) ?? {}
      const sets = data.ChunkSetsMetadata ?? data.chunkSetsMetadata
      const chunkSets: ChunkSet[] = (Array.isArray(sets) ? sets : []).flatMap(entry => {
        const set = record(entry)
        const chunkSetId = text(set?.ChunkSetId, set?.chunkSetId)
        return set && chunkSetId ? [{ chunkSetId, chunkCount: Number(set.ChunkCount ?? set.chunkCount ?? 0), totalItemCount: Number(set.TotalItemCount ?? set.totalItemCount ?? 0) }] : []
      })
      return { state: text(data.State, data.state) || "Unknown", chunkSets }
    } catch (error) {
      if (record(error)?.status === 404) return { state: "NotFound", chunkSets: [] }
      throw error
    }
  },
  async getChunk(env, transferId, chunkSetId, chunkId) {
    const data = await call<unknown>("query", "xmc.contentTransfer.getChunk", env, { path: { transferId, chunksetId: chunkSetId, chunkId } }, CHUNK_TIMEOUT_MS)
    const blob = data instanceof Blob ? data : data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? new Blob([data as BlobPart]) : null
    if (!blob || blob.size === 0) throw new Error(`Chunk ${chunkId} came back empty.`)
    return blob
  },
  async saveChunk(env, transferId, chunkSetId, chunkId, chunk, isMedia) {
    // The Blob goes as-is; isMedia must always be sent or the endpoint answers 405.
    await call("mutate", "xmc.contentTransfer.saveChunk", env, { path: { transferId, chunksetId: chunkSetId, chunkId }, body: chunk, query: { isMedia } }, CHUNK_TIMEOUT_MS)
  },
  async completeChunkSet(env, transferId, chunkSetId) {
    const data = record(await call("mutate", "xmc.contentTransfer.completeChunkSetTransfer", env, { path: { transferId, chunksetId: chunkSetId } }))
    const name = text(data?.ContentTransferFileName, data?.contentTransferFileName)
    if (!name) throw new Error("The destination returned no transfer file.")
    return name
  },
  async deleteTransfer(env, transferId) {
    await call("mutate", "xmc.contentTransfer.deleteContentTransfer", env, { path: { transferId } })
  },
  async consumeFile(env, file) {
    await call("query", "xmc.contentTransfer.consumeFile", env, { query: { databaseName: "master", fileName: `blob://${file}` } })
  },
  async blobState(env, file) {
    const data = record(await call("query", "xmc.contentTransfer.getBlobState", env, { query: { fileName: file } })) ?? {}
    const details = data.details ?? data.Details
    const error = text(data.Error, data.error, typeof details === "string" ? details : record(details)?.Error)
    return { state: text(data.BlobState, data.blobState, data.Status, data.status) || "Unknown", ...(error ? { error } : {}) }
  },
}
