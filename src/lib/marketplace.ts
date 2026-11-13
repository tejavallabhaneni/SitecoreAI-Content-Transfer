"use client"

// Runs inside SitecoreAI as a Marketplace app. The host lists the environments
// the app is installed in (`application.context` → `resourceAccess`), and every
// call is addressed to one of them by its Sitecore Context ID. No credentials,
// sign-in or server proxy: the SDK bridge to the host does the authentication.

import type { ClientSDK } from "@sitecore-marketplace-sdk/client"
import type { Backend, ChunkSet, Env, TemplateInfo, TreeNode } from "./transfer"

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

const RETRY_MS = 800

function race<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what}: no response within ${Math.round(ms / 1000)}s`)), ms) })])
    .finally(() => clearTimeout(timer))
}

/** `query` wraps results as `{ data: { data, error, response } }`; `mutate` doesn't. Walk down to the payload. */
/** What an error body says, if anything: a message, a problem-details title/detail, or the raw JSON. */
function detail(error: unknown): string {
  const body = record(error)
  const said = text(body?.message, body?.detail, body?.title, body?.error, body?.Message, error)
  if (said) return said
  return body && Object.keys(body).length ? JSON.stringify(body).slice(0, 300) : ""
}

/** The HTTP response somewhere in an SDK result, for its status and headers. */
function responseOf(result: unknown): { status?: number; headers?: Headers } | null {
  let current = record(result)
  for (let depth = 0; depth < 4 && current; depth++) {
    const response = record(current.response)
    if (response && (typeof response.status === "number" || response.headers)) return response as { status?: number; headers?: Headers }
    current = record(current.data)
  }
  return null
}

/** Sitecore's ID for one request (x-sc-correlation-id), which Support can trace. */
export function correlationId(result: unknown): string {
  const headers = responseOf(result)?.headers as Headers | Record<string, string> | undefined
  if (!headers) return ""
  const value = typeof (headers as Headers).get === "function" ? (headers as Headers).get("x-sc-correlation-id") : (headers as Record<string, string>)["x-sc-correlation-id"]
  return /^[\w-]{8,64}$/.test(value ?? "") ? value as string : ""
}

const HINTS: Record<number, string> = {
  401: "SitecoreAI didn’t accept the app’s sign-in. Refresh the page and try again.",
  403: "The app isn’t allowed to do this in that environment. Check the app’s access in App Studio and that you’re an Organization Admin or Owner.",
  404: "Sitecore couldn’t find the transfer. It may have expired; start the transfer again.",
  413: "The chunk was too large for SitecoreAI to accept.",
}

function unwrap<T>(result: unknown, what: string): T | null {
  let current = record(result)
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current.error) {
      const status = responseOf(current)?.status ?? responseOf(result)?.status
      const said = detail(current.error)
      const hint = status ? HINTS[status] : undefined
      const traced = correlationId(current) || correlationId(result)
      throw Object.assign(new Error(`${what} ${status ? `answered HTTP ${status}` : "failed"}${said ? `: ${said}` : ""}.${hint ? ` ${hint}` : ""}${traced ? ` Sitecore correlation ID: ${traced}.` : ""}`), { status })
    }
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
  let failure = ""
  // A failed request (throttled, a server error, no body) is retried once and then
  // reported as an error, never as "not found": a missing answer isn't a missing item.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, RETRY_MS))
    const result = await race(sdkClient.mutate("xmc.authoring.graphql" as never, { params: { query: { sitecoreContextId: env }, body: { query, variables } } } as never), CALL_TIMEOUT_MS, "Reading content")
    const answer = readGraphql(result)
    if (!("failure" in answer)) return answer
    failure = answer.failure
  }
  return { item: null, errors: [failure] }
}

/** The `item` and GraphQL errors in an SDK result, or why the request itself failed. */
export function readGraphql(result: unknown): { item: unknown; errors: string[] } | { failure: string } {
  let level = record(result)
  let errors: unknown[] = []
  for (let depth = 0; depth < 5 && level; depth++) {
    if (Array.isArray(level.errors) && level.errors.length) errors = level.errors
    if ("item" in level) return { item: level.item ?? null, errors: errors.map(error => text(record(error)?.message, error) || "GraphQL error") }
    const status = record(level.response)?.status
    if (level.error || (typeof status === "number" && status >= 400)) {
      const said = level.error ? detail(level.error) : ""
      return { failure: `Authoring GraphQL ${typeof status === "number" ? `answered HTTP ${status}` : "failed"}${said ? `: ${said}` : ""}` }
    }
    level = record(level.data)
  }
  if (errors.length) return { item: null, errors: errors.map(error => text(record(error)?.message, error) || "GraphQL error") }
  return { failure: "Authoring GraphQL sent back no data" }
}

async function raw(kind: "query" | "mutate", operation: string, env: string, params: Record<string, unknown>, timeout = CALL_TIMEOUT_MS): Promise<unknown> {
  const sdkClient = await sdk()
  const query = { ...(record(params.query) ?? {}), sitecoreContextId: env }
  const request = { params: { ...params, query }, timeoutMs: timeout } as never
  const promise = kind === "query" ? sdkClient.query(operation as never, request) : sdkClient.mutate(operation as never, request)
  return race(promise as Promise<unknown>, timeout, operation)
}

async function call<T>(kind: "query" | "mutate", operation: string, env: string, params: Record<string, unknown>, timeout = CALL_TIMEOUT_MS): Promise<T | null> {
  return unwrap<T>(await raw(kind, operation, env, params, timeout), operation)
}

/** IsMedia from a chunk's Content-Disposition header, e.g. `attachment; filename=0; IsMedia=True`. */
export function chunkIsMedia(disposition: string | null | undefined): boolean | undefined {
  const match = /\bis_?media\s*=\s*"?(true|false|1|0)"?/i.exec(disposition ?? "")
  return match ? /^(true|1)$/i.test(match[1]) : undefined
}

type RawItem = { itemId: string; name: string; path: string; icon?: unknown; template?: { name?: string; templateId?: string } | null; children?: { nodes?: unknown[] } | null }

// Richest first. An item whose template is missing (an all-zeros template ID)
// makes `template` and `icon` fail for its whole folder, so the tree steps down
// and keeps whatever the richer attempt did return. A field an environment's
// schema doesn't have is skipped for that environment from then on.
const HAS_CHILDREN = "children(first: 1, includeHiddenItems: true) { nodes { itemId } }"
const TIERS = [`itemId name path icon template { name templateId } ${HAS_CHILDREN}`, `itemId name path template { name templateId } ${HAS_CHILDREN}`, `itemId name path ${HAS_CHILDREN}`]
const PAGE = 500
const startTier = new Map<string, number>()
const brokenTemplate = (message: string) => /00000000-0000-0000-0000-000000000000/.test(message) || (/template/i.test(message) && /(does ?n[o']t exist|access rights)/i.test(message))
const schemaGap = (message: string) => /cannot query field|unknown (field|argument)|field undefined|validation error/i.test(message)

// Item icons are served by each environment's CM host. Authoring GraphQL gives a
// relative or themed path, so the host is learned once per environment from the
// preview API, which answers with an absolute icon URL.
const previewIds = new Map<string, string>()
const iconOrigins = new Map<string, Promise<string>>()
const templateCache = new Map<string, TemplateInfo | null>()
/** 32 hex digits (with or without braces and dashes) as a dashed GUID. */
export const asGuid = (id: string) => {
  const hex = id.replace(/[{}-]/g, "")
  return /^[0-9a-f]{32}$/i.test(hex) ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : id
}
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

// Icon URLs, as relay learned them:
// - `/-/icon/…` answers only a browser signed in to that CM, so the CM's static
//   icon cache (`/temp/iconcache/{path}`) is tried first, then other CMs' caches
//   (themed icons are the same bitmap everywhere), then `/-/icon/…` itself.
// - A media item's icon is its own thumbnail, which the API wraps as
//   `/-/icon/-/media/{id}.ashx?thn=1`; the bare `/-/media/…` form needs no sign-in.
// - Tree icons are 16×16, the size the cache holds.
const learnedOrigins = new Set<string>()
const atTreeSize = (path: string) => path.replace(/\/\d+x\d+\//, "/16x16/")
function treeIconUrl(url: string) {
  const media = url.replace(/\/[-~]\/icon\/[-~]\/media\//i, "/-/media/")
  return media !== url ? media : url.replace(/(\/[-~]\/icon\/[^?#]*?)\/\d+x\d+\//i, "$1/16x16/")
}
function resolveIcon(raw: string, origin: string): string | undefined {
  if (!raw) return undefined
  if (/^https?:\/\//i.test(raw)) return treeIconUrl(raw)
  if (/^\/[-~]\/(icon|media)\//i.test(raw)) return origin ? treeIconUrl(origin + raw) : undefined
  return origin ? `${origin}/-/icon/${atTreeSize(raw.replace(/^~?\/?/, ""))}` : undefined
}
function themedIcon(url: string): { origin: string; path: string } | undefined {
  const match = url.match(/^(https?:\/\/[^/?#]+)(?:\/sitecore\/shell)?\/[-~]\/icon\/([^?#]+?)(?:\.aspx)?(?:[?#].*)?$/i)
  if (!match || /^[-~]\/media\//i.test(match[2])) return undefined
  return { origin: match[1], path: atTreeSize(match[2]) }
}
/** Every URL worth trying for an item's icon, best first. */
export function iconSources(raw: string, origin: string): string[] {
  const primary = resolveIcon(raw, origin)
  if (!primary) return []
  const themed = themedIcon(primary)
  if (!themed) return [primary]
  const origins = [themed.origin, ...[...learnedOrigins].filter(other => other !== themed.origin)]
  return [...new Set([...origins.map(host => `${host}/temp/iconcache/${themed.path.toLowerCase()}`), primary])]
}

async function childItems(env: string, path: string): Promise<{ items: RawItem[]; fellBack: boolean }> {
  let richer = new Map<string, RawItem>()
  let lastError = ""
  for (let tier = startTier.get(env) ?? 0; tier < TIERS.length; tier++) {
    const { item, errors } = await graphqlItem(env, `query Children($path: String!) { item(where: { database: "master", path: $path }) { itemId children(first: ${PAGE}, includeHiddenItems: true) { nodes { ${TIERS[tier]} } } } }`, { path })
    const nodes = ((record(item)?.children as RawItem["children"])?.nodes ?? []).filter((node): node is RawItem => Boolean(record(node)?.itemId))
    const merged = nodes.map(node => ({ ...richer.get(node.itemId), ...node, icon: node.icon ?? richer.get(node.itemId)?.icon, template: node.template ?? richer.get(node.itemId)?.template }))
    if (!errors.length) {
      if (!item) throw new Error("That folder doesn’t exist in this environment.")
      return { items: merged, fellBack: richer.size > 0 }
    }
    lastError = errors[0]
    const all = errors.join(" ")
    if (brokenTemplate(all)) { richer = new Map([...richer, ...merged.map(node => [node.itemId, node] as const)]); continue }
    if (schemaGap(all)) { startTier.set(env, tier + 1); continue }
    if (item) return { items: merged, fellBack: true }
    break
  }
  if (richer.size) return { items: [...richer.values()], fellBack: true }
  throw new Error(`SitecoreAI couldn’t read this folder: ${lastError}`)
}

/**
 * When a broken item forced a plainer query, ask for each remaining item's icon
 * and template on its own. In one aliased query a broken item fails only itself.
 */
async function recoverDetails(env: string, items: RawItem[]): Promise<RawItem[]> {
  const tier = startTier.get(env) ?? 0
  if (tier >= 2) return items
  const fields = tier === 0 ? "itemId icon template { name templateId }" : "itemId template { name templateId }"
  const missing = items.filter(item => !item.template?.name || (tier === 0 && !iconText(item.icon)))
  const found = new Map<string, RawItem>()
  for (let index = 0; index < missing.length; index += 25) {
    const chunk = missing.slice(index, index + 25)
    const query = `query Details { ${chunk.map((item, n) => `i${n}: item(where: { database: "master", itemId: ${JSON.stringify(item.itemId)} }) { ${fields} }`).join(" ")} }`
    try {
      const sdkClient = await sdk()
      const result = await race(sdkClient.mutate("xmc.authoring.graphql" as never, { params: { query: { sitecoreContextId: env }, body: { query, variables: {} } } } as never), CALL_TIMEOUT_MS, "Reading item details")
      let level = record(result)
      for (let depth = 0; depth < 5 && level && !("i0" in level); depth++) level = record(level.data)
      chunk.forEach((_, n) => { const detail = record(level?.[`i${n}`]); if (detail?.itemId) found.set(String(detail.itemId), detail as unknown as RawItem) })
    } catch { /* details are a nicety; the tree still works without them */ }
  }
  return items.map(item => { const detail = found.get(item.itemId); return detail ? { ...item, icon: item.icon ?? detail.icon, template: item.template ?? detail.template } : item })
}

/**
 * Media items: the Authoring API's `thumbnailUrl`, asked per item in one aliased
 * query. A `/-/media/…?db=master` thumbnail needs a CM sign-in that a framed app
 * can't send, so this is tried first. Any failure just leaves the other sources.
 */
async function mediaThumbnails(env: string, items: RawItem[]): Promise<Map<string, string>> {
  const thumbs = new Map<string, string>()
  const media = items.filter(item => /^\/sitecore\/media library\//i.test(item.path) && !item.children?.nodes?.length)
  for (let index = 0; index < media.length; index += 25) {
    const chunk = media.slice(index, index + 25)
    try {
      const sdkClient = await sdk()
      const query = `query Thumbs { ${chunk.map((item, n) => `i${n}: item(where: { database: "master", itemId: ${JSON.stringify(item.itemId)} }) { itemId thumbnailUrl }`).join(" ")} }`
      const result = await race(sdkClient.mutate("xmc.authoring.graphql" as never, { params: { query: { sitecoreContextId: env }, body: { query, variables: {} } } } as never), CALL_TIMEOUT_MS, "Reading thumbnails")
      let level = record(result)
      for (let depth = 0; depth < 5 && level && !("i0" in level); depth++) level = record(level.data)
      chunk.forEach((_, n) => { const found = record(level?.[`i${n}`]); const url = text(found?.thumbnailUrl); if (found?.itemId && url) thumbs.set(String(found.itemId), url) })
    } catch { /* thumbnails are a nicety */ }
  }
  return thumbs
}

async function toNodes(env: string, items: RawItem[]): Promise<TreeNode[]> {
  const icons = items.map(item => iconText(item.icon))
  const absolute = icons.map(absoluteOrigin).find(Boolean)
  if (absolute && !iconOrigins.has(env)) iconOrigins.set(env, Promise.resolve(absolute))
  const needsHost = icons.some(icon => icon && !/^https?:/i.test(icon))
  const origin = needsHost ? await iconOrigin(env, (items.find(item => iconText(item.icon)) ?? items[0]).itemId) : absolute ?? ""
  if (origin) learnedOrigins.add(origin)
  const thumbs = await mediaThumbnails(env, items)
  const absolutize = (url: string) => /^https?:\/\//i.test(url) ? url : origin && url.startsWith("/") ? origin + url : ""
  return items.map((item, index) => {
    const thumb = absolutize(thumbs.get(item.itemId) ?? "")
    return { id: item.itemId, name: item.name, path: item.path, template: item.template?.name ?? "", templateId: item.template?.templateId || undefined,
      hasChildren: Boolean(item.children?.nodes?.length), icons: [...new Set([...(thumb ? [thumb] : []), ...iconSources(icons[index], origin)])] }
  })
}

export const marketplaceBackend: Backend = {
  pollMs: 2000,
  async children(env, path) {
    const { items, fellBack } = await childItems(env, path)
    if (!items.length) return []
    return toNodes(env, fellBack ? await recoverDetails(env, items) : items)
  },
  async item(env, path) {
    let { item, errors } = await graphqlItem(env, `query Item($path: String!) { item(where: { database: "master", path: $path }) { itemId path template { templateId name } } }`, { path })
    // An item whose template is broken (or a schema without template IDs) is still looked up by ID and path.
    if (errors.length && (brokenTemplate(errors.join(" ")) || schemaGap(errors.join(" ")))) ({ item, errors } = await graphqlItem(env, `query Item($path: String!) { item(where: { database: "master", path: $path }) { itemId path } }`, { path }))
    const found = record(item)
    if (!found && errors.length) throw new Error(`SitecoreAI couldn’t check ${path}: ${errors[0]}`)
    const template = record(found?.template)
    return found ? { id: String(found.itemId), path: String(found.path), templateId: text(template?.templateId) || undefined, templateName: text(template?.name) || undefined } : null
  },
  async templateInfo(env, templateId) {
    const key = `${env}:${templateId.toLowerCase()}`
    const cached = templateCache.get(key)
    if (cached !== undefined) return cached
    // Three ways in one request: the dashed ID, the braced ID, and the braced ID
    // as a path (Sitecore resolves "{GUID}" paths by ID). The first that answers wins.
    const dashed = asGuid(templateId)
    const braced = `{${dashed.toUpperCase()}}`
    const ask = async (withBase: boolean) => {
      const fields = `itemId name path${withBase ? ' base: field(name: "__Base template") { value }' : ""}`
      const query = `query Template { a: item(where: { database: "master", itemId: ${JSON.stringify(dashed)} }) { ${fields} } b: item(where: { database: "master", itemId: ${JSON.stringify(braced)} }) { ${fields} } c: item(where: { database: "master", path: ${JSON.stringify(braced)} }) { ${fields} } }`
      const sdkClient = await sdk()
      const result = await race(sdkClient.mutate("xmc.authoring.graphql" as never, { params: { query: { sitecoreContextId: env }, body: { query, variables: {} } } } as never), CALL_TIMEOUT_MS, "Checking templates")
      let level = record(result)
      let errors: string[] = []
      for (let depth = 0; depth < 5 && level && !("a" in level || "b" in level || "c" in level); depth++) {
        if (Array.isArray(level.errors)) errors = level.errors.map(error => text(record(error)?.message))
        level = record(level.data)
      }
      return { found: ["a", "b", "c"].map(alias => record(level?.[alias])).find(item => item?.itemId), errors }
    }
    const first = await ask(true)
    const found = first.found ?? (first.errors.some(schemaGap) ? (await ask(false)).found : undefined)
    const info: TemplateInfo | null = found ? {
      id: String(found.itemId), path: String(found.path), name: String(found.name ?? ""),
      baseIds: (text(record(found.base)?.value).match(/\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?/gi) ?? []).map(id => id.replace(/[{}]/g, "")),
    } : null
    templateCache.set(key, info)
    return info
  },
  async childrenForCheck(env, path) {
    // The comparison only needs IDs, paths and templates: no icons or thumbnails.
    const { items, fellBack } = await childItems(env, path)
    const detailed = fellBack ? await recoverDetails(env, items) : items
    return detailed.map(item => ({ id: item.itemId, name: item.name, path: item.path, template: item.template?.name ?? "", templateId: item.template?.templateId || undefined, hasChildren: Boolean(item.children?.nodes?.length) }))
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
    const result = await raw("query", "xmc.contentTransfer.getChunk", env, { path: { transferId, chunksetId: chunkSetId, chunkId } }, CHUNK_TIMEOUT_MS)
    const data = unwrap<unknown>(result, "xmc.contentTransfer.getChunk")
    const blob = data instanceof Blob ? data : data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? new Blob([data as BlobPart]) : null
    if (!blob || blob.size === 0) throw new Error(`Chunk ${chunkId} came back empty.`)
    const headers = responseOf(result)?.headers
    const isMedia = chunkIsMedia(typeof headers?.get === "function" ? headers.get("content-disposition") : undefined)
    return isMedia === undefined ? { data: blob } : { data: blob, isMedia }
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

