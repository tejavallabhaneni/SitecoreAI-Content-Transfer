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
    const preview = text(context?.preview)
    if (preview) previewIds.set(id, preview)
    envs.push({ id, name: text(resource.tenantDisplayName, resource.environmentName, resource.tenantName) || id, tenant: text(resource.tenantName) || undefined })
  }
  return envs
}

/** One Authoring GraphQL `item(...)` query. Returns what came back, errors and all. */
async function graphqlItem(env: string, query: string, variables: Record<string, unknown>): Promise<{ item: unknown; errors: string[] }> {
  const sdkClient = await sdk()
  const result = await race(sdkClient.mutate("xmc.authoring.graphql" as never, { params: { query: { sitecoreContextId: env }, body: { query, variables } } } as never), CALL_TIMEOUT_MS, "Reading content")
  let level = record(result)
  let errors: unknown[] = []
  let item: unknown = undefined
  for (let depth = 0; depth < 5 && level; depth++) {
    if (Array.isArray(level.errors) && level.errors.length) errors = level.errors
    if ("item" in level) { item = level.item; break }
    level = record(level.data)
  }
  return { item: item ?? null, errors: errors.map(error => text(record(error)?.message, error) || "GraphQL error") }
}

async function call<T>(kind: "query" | "mutate", operation: string, env: string, params: Record<string, unknown>, timeout = CALL_TIMEOUT_MS): Promise<T | null> {
  const sdkClient = await sdk()
  const query = { ...(record(params.query) ?? {}), sitecoreContextId: env }
  const request = { params: { ...params, query }, timeoutMs: timeout } as never
  const promise = kind === "query" ? sdkClient.query(operation as never, request) : sdkClient.mutate(operation as never, request)
  return unwrap<T>(await race(promise as Promise<unknown>, timeout, operation), operation)
}

type RawItem = { itemId: string; name: string; path: string; icon?: unknown; template?: { name?: string } | null; children?: { nodes?: unknown[] } | null }

// Richest first. An item whose template is missing (an all-zeros template ID)
// makes `template` and `icon` fail for its whole folder, so the tree steps down
// and keeps whatever the richer attempt did return. A field an environment's
// schema doesn't have is skipped for that environment from then on.
const HAS_CHILDREN = "children(first: 1) { nodes { itemId } }"
const TIERS = [`itemId name path icon template { name } ${HAS_CHILDREN}`, `itemId name path template { name } ${HAS_CHILDREN}`, `itemId name path ${HAS_CHILDREN}`]
const PAGE = 500
const startTier = new Map<string, number>()
const brokenTemplate = (message: string) => /00000000-0000-0000-0000-000000000000/.test(message) || (/template/i.test(message) && /(does ?n[o']t exist|access rights)/i.test(message))
const schemaGap = (message: string) => /cannot query field|unknown (field|argument)|field undefined|validation error/i.test(message)

// Item icons are served by each environment's CM host. Authoring GraphQL gives a
// relative or themed path, so the host is learned once per environment from the
// preview API, which answers with an absolute icon URL.
const previewIds = new Map<string, string>()
const iconOrigins = new Map<string, Promise<string>>()
const absoluteOrigin = (url: string) => { try { return /^https?:\/\//i.test(url) ? new URL(url).origin : "" } catch { return "" } }
const iconText = (value: unknown) => typeof value === "string" ? value.trim() : text(record(value)?.url, record(value)?.value)

function iconOrigin(env: string, sampleId: string): Promise<string> {
  const known = iconOrigins.get(env)
  if (known) return known
  const learning = (async () => {
    const preview = previewIds.get(env)
    if (!preview) return ""
    const sdkClient = await sdk()
    const result = await race(sdkClient.mutate("xmc.preview.graphql" as never, { params: { query: { sitecoreContextId: preview },
      body: { query: "query Icon($path: String!, $language: String!) { item(path: $path, language: $language) { icon } }", variables: { path: sampleId, language: "en" } } } } as never), 8000, "Finding item icons")
    let level = record(result)
    for (let depth = 0; depth < 5 && level && !("item" in level); depth++) level = record(level.data)
    return absoluteOrigin(iconText(record(level?.item)?.icon))
  })().catch(() => "")
  iconOrigins.set(env, learning)
  return learning
}

export function iconUrl(raw: string, origin: string): string | undefined {
  if (!raw) return undefined
  const sized = (url: string) => url.replace(/\/\d+x\d+\//, "/32x32/")
  if (/^https?:\/\//i.test(raw)) return sized(raw)
  if (/^\/[-~]\/(icon|media)\//i.test(raw)) return origin ? sized(origin + raw) : undefined
  return origin ? `${origin}/-/icon/${sized(raw.replace(/^~?\/?/, ""))}` : undefined
}

async function childItems(env: string, path: string): Promise<RawItem[]> {
  let richer = new Map<string, RawItem>()
  let lastError = ""
  for (let tier = startTier.get(env) ?? 0; tier < TIERS.length; tier++) {
    const { item, errors } = await graphqlItem(env, `query Children($path: String!) { item(where: { database: "master", path: $path }) { itemId children(first: ${PAGE}) { nodes { ${TIERS[tier]} } } } }`, { path })
    const nodes = ((record(item)?.children as RawItem["children"])?.nodes ?? []).filter((node): node is RawItem => Boolean(record(node)?.itemId))
    const merged = nodes.map(node => ({ ...richer.get(node.itemId), ...node, icon: node.icon ?? richer.get(node.itemId)?.icon, template: node.template ?? richer.get(node.itemId)?.template }))
    if (!errors.length) {
      if (!item) throw new Error("That folder doesn’t exist in this environment.")
      return merged
    }
    lastError = errors[0]
    const all = errors.join(" ")
    if (brokenTemplate(all)) { richer = new Map([...richer, ...merged.map(node => [node.itemId, node] as const)]); continue }
    if (schemaGap(all)) { startTier.set(env, tier + 1); continue }
    if (item) return merged
    break
  }
  if (richer.size) return [...richer.values()]
  throw new Error(`SitecoreAI couldn’t read this folder: ${lastError}`)
}

async function toNodes(env: string, items: RawItem[]): Promise<TreeNode[]> {
  const icons = items.map(item => iconText(item.icon))
  const absolute = icons.map(absoluteOrigin).find(Boolean)
  if (absolute && !iconOrigins.has(env)) iconOrigins.set(env, Promise.resolve(absolute))
  const needsHost = icons.some(icon => icon && !/^https?:/i.test(icon))
  const origin = needsHost ? await iconOrigin(env, items[0].itemId) : absolute ?? ""
  return items.map((item, index) => ({ id: item.itemId, name: item.name, path: item.path, template: item.template?.name ?? "",
    hasChildren: Boolean(item.children?.nodes?.length), icon: iconUrl(icons[index], origin) }))
}

export const marketplaceBackend: Backend = {
  pollMs: 2000,
  async children(env, path) {
    const items = await childItems(env, path)
    return items.length ? toNodes(env, items) : []
  },
  async item(env, path) {
    const { item, errors } = await graphqlItem(env, `query Item($path: String!) { item(where: { database: "master", path: $path }) { itemId path } }`, { path })
    const found = record(item)
    if (!found && errors.length) throw new Error(`SitecoreAI couldn’t check ${path}: ${errors[0]}`)
    return found ? { id: String(found.itemId), path: String(found.path) } : null
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
