import { getSitecoreToken, secureOrigin, sitecoreRequest, type SitecoreEnvironmentConfig } from "./client"
import { verifyPreflight } from "./preflight"
import { parseTransferInput, type SafeMerge, type SafeScope } from "../transfers/validation"

export const ITEM_TRANSFER = "/sitecore/shell/api/v3/ItemsTransfer"
const CONTENT_TRANSFER = "/sitecore/api/content/transfer/v1/transfers"

export type Connection = { baseUrl: string; accessToken: string }
export type Connections = { source: Connection; destination: Connection }
export type DiscoveredEnvironment = { id: string; name: string; host: string; projectName: string; organizationName: string }
export type Plan = { itemPaths: string[]; scope: SafeScope; mergeStrategy: SafeMerge }
export type NativeStatus = {
  Id: string; SourceName: string; DatabaseName?: string; ConsumedDate?: string
  TransferState: string; Strategy?: string; Description?: string
  TotalItemsCount?: number; TransferredItemsCount?: number; ValidationErrors?: string[] | null
}
export type HistoryRecord = {
  Name: string; SourceName: string; ConsumeDate?: string; Strategy?: string
  Events?: { Name: string; Date: string }[]
}

export class InputError extends Error {}

function userToken(value: unknown): string {
  if (typeof value !== "string" || value.length < 10 || value.length > 16_384 || /[\r\n]/.test(value)) throw new InputError("Sign in to Sitecore to continue.")
  return value
}

async function deployRequest<T>(token: string, path: string): Promise<T> {
  // Fixed origin and internally constructed paths. No environment variables,
  // install-owner credentials, or arbitrary URLs can replace this user's token.
  const response = await fetch(`https://xmclouddeploy-api.sitecorecloud.io${path}`, {
    headers: { Authorization: `Bearer ${userToken(token)}`, Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`SitecoreAI environment discovery was not authorized (HTTP ${response.status}). The registered app needs Deploy API access for this user.`)
  return response.json() as Promise<T>
}

function environmentDto(value: unknown): DiscoveredEnvironment | null {
  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>
  if (item.isDeleted || typeof item.id !== "string" || typeof item.host !== "string" || !item.host) return null
  let host: string
  try { host = new URL(secureOrigin(item.host)).hostname } catch { return null }
  return { id: item.id, name: typeof item.name === "string" ? item.name : item.id, host,
    projectName: typeof item.projectName === "string" ? item.projectName : "",
    organizationName: typeof item.organizationName === "string" ? item.organizationName : "" }
}

export async function discoverEnvironments(token: unknown, page: unknown = 1) {
  if (!Number.isInteger(page) || Number(page) < 1 || Number(page) > 100_000) throw new InputError("Invalid environment page.")
  const result = await deployRequest<{ data: unknown[]; totalCount: number }>(userToken(token), `/api/environments/v1?PageNumber=${page}&PageSize=50`)
  if (!Array.isArray(result.data) || !Number.isInteger(result.totalCount) || result.totalCount < 0) throw new Error("SitecoreAI returned an unexpected environment list.")
  return { environments: result.data.map(environmentDto).filter((env): env is DiscoveredEnvironment => env !== null), page: Number(page), totalCount: result.totalCount }
}

export async function connectSignedInEnvironments(token: unknown, sourceId: unknown, destinationId: unknown): Promise<Connections> {
  const accessToken = userToken(token)
  if (sourceId === destinationId) throw new InputError("Choose two different environments.")
  const [sourceDto, destinationDto] = await Promise.all([sourceId, destinationId].map(id => deployRequest(accessToken, `/api/environments/v1/${identifier(id)}`)))
  const source = environmentDto(sourceDto), destination = environmentDto(destinationDto)
  if (!source || !destination) throw new InputError("Select available authoring environments.")
  const connections = parseConnections({ source: { baseUrl: `https://${source.host}`, accessToken }, destination: { baseUrl: `https://${destination.host}`, accessToken } })
  // An interactive login is not proof of transfer-API authorization. Check both
  // environments read-only and fail explicitly if this token is not accepted.
  await Promise.all([connections.source, connections.destination].map(connection =>
    sitecoreRequest(configFor(connection), ITEM_TRANSFER + "/transfers?page=1&pageSize=1")))
  return connections
}

export function configFor(connection: Connection): SitecoreEnvironmentConfig {
  if (!connection || typeof connection.baseUrl !== "string" ||
      typeof connection.accessToken !== "string" || connection.accessToken.length < 10 ||
      connection.accessToken.length > 16_384 || /[\r\n]/.test(connection.accessToken)) {
    throw new InputError("Connect your own SitecoreAI environments to continue.")
  }
  return { baseUrl: secureOrigin(connection.baseUrl), accessToken: connection.accessToken, clientId: "", clientSecret: "" }
}

export function parseConnections(input: unknown): Connections {
  if (!input || typeof input !== "object") throw new InputError("Connect your environments first.")
  const value = input as Connections
  const source = configFor(value.source)
  const destination = configFor(value.destination)
  if (source.baseUrl === destination.baseUrl) throw new InputError("Choose two different authoring environments.")
  return {
    source: { baseUrl: source.baseUrl, accessToken: source.accessToken! },
    destination: { baseUrl: destination.baseUrl, accessToken: destination.accessToken! },
  }
}

export async function connectEnvironment(input: unknown): Promise<Connection> {
  if (!input || typeof input !== "object") throw new InputError("Enter environment credentials.")
  const data = input as Record<string, unknown>
  if (typeof data.host !== "string" || typeof data.clientId !== "string" ||
      typeof data.clientSecret !== "string" || !data.clientId.trim() ||
      !data.clientSecret || data.clientId.length > 256 || data.clientSecret.length > 2048) {
    throw new InputError("Enter a host, client ID, and client secret for each environment.")
  }
  const config = { baseUrl: secureOrigin(data.host.trim()), clientId: data.clientId.trim(), clientSecret: data.clientSecret }
  // Public users never share the installation owner's credentials or token cache.
  const accessToken = await getSitecoreToken(config, false)
  const connection = { baseUrl: config.baseUrl, accessToken }
  await sitecoreRequest(configFor(connection), ITEM_TRANSFER + "/transfers?page=1&pageSize=1")
  return connection
}

export function parsePlan(input: unknown): Plan {
  if (!input || typeof input !== "object") throw new InputError("Select the items to transfer.")
  const value = input as Record<string, unknown>
  if (!Array.isArray(value.itemPaths) || value.itemPaths.length < 1 || value.itemPaths.length > 20) {
    throw new InputError("Select between 1 and 20 content roots.")
  }
  try {
    const trees = value.itemPaths.map(itemPath => parseTransferInput({ itemPath, scope: value.scope, mergeStrategy: value.mergeStrategy }))
    const paths = trees.map(tree => tree.itemPath)
    if (new Set(paths.map(path => path.toLowerCase())).size !== paths.length) throw new Error("Duplicate content roots.")
    if (trees[0].scope === "ItemAndDescendants" && paths.some(path => paths.some(parent =>
      parent !== path && path.toLowerCase().startsWith(parent.toLowerCase() + "/")))) {
      throw new Error("Select the common ancestor rather than overlapping content roots.")
    }
    return { itemPaths: paths, scope: trees[0].scope, mergeStrategy: trees[0].mergeStrategy }
  } catch (error) { throw new InputError(error instanceof Error ? error.message : "Invalid transfer plan.") }
}

export function identifier(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 512 || /[\x00-\x1f\\/?#]/.test(value) || value.includes("..")) {
    throw new InputError("Invalid transfer identifier.")
  }
  return encodeURIComponent(value)
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    throw new InputError("Invalid export or chunk-set identifier.")
  }
  return value
}

async function getJson<T>(config: SitecoreEnvironmentConfig, path: string, init?: RequestInit): Promise<T> {
  return (await sitecoreRequest(config, path, init)).json() as Promise<T>
}

export async function preflight(connections: Connections, plan: Plan) {
  const source = configFor(connections.source)
  const destination = configFor(connections.destination)
  const reports = []
  for (const item_path of plan.itemPaths) reports.push(await verifyPreflight(source, destination, { item_path }))
  return reports
}

export async function listNativeTransfers(connections: Connections, page: number) {
  const destination = configFor(connections.destination)
  const [current, history] = await Promise.all([
    getJson<{ Transfers: NativeStatus[]; TotalCount: number }>(destination, `${ITEM_TRANSFER}/transfers?page=${page}&pageSize=50`),
    getJson<{ Sources: HistoryRecord[]; TotalCount: number }>(destination, `${ITEM_TRANSFER}/history?page=${page}&pageSize=50`),
  ])
  if (!Array.isArray(current.Transfers) || !Array.isArray(history.Sources)) throw new Error("SitecoreAI returned an unexpected history response.")
  return { current: current.Transfers, history: history.Sources, totalCount: Math.max(current.TotalCount, history.TotalCount), page }
}

export async function transferDetails(connections: Connections, id: string) {
  return getJson<NativeStatus>(configFor(connections.destination), `${ITEM_TRANSFER}/transfers/${identifier(id)}`)
}

export async function browseItems(connections: Connections, inputPath: unknown, side: "source" | "destination") {
  const path = typeof inputPath === "string" ? inputPath : "/sitecore/content"
  if (path.length > 1024 || !(/^\/sitecore\/(content|media library)(\/|$)/.test(path)) || /[\x00-\x1f\\?#]/.test(path) || path.includes("..")) {
    throw new InputError("Choose a content or media-library path.")
  }
  // Field names only: field values are not needed to select content roots.
  const itemFields = `itemId name path template { name } fields(ownFields: true, excludeStandardFields: true) { nodes { name } }`
  const query = `query { item(where: { database: "master", path: ${JSON.stringify(path)} }) { ${itemFields} children(first: 50) { nodes { ${itemFields} } pageInfo { hasNextPage endCursor } } } }`
  const response = await getJson<{ data?: { item?: { itemId: string; name: string; path: string; template?: { name: string }; fields?: { nodes: { name: string }[] }; children?: { nodes: unknown[]; pageInfo?: unknown } } }; errors?: unknown[] }>(configFor(connections[side]), "/sitecore/api/authoring/graphql/v1/", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  })
  if (response.errors?.length) throw new Error("SitecoreAI could not read this content tree. Check Authoring API permissions.")
  if (!response.data?.item) throw new InputError("That content path was not found.")
  return { parent: response.data.item, nodes: response.data.item.children?.nodes ?? [], pageInfo: response.data.item.children?.pageInfo }
}

/** One bounded request per phase. No database, filesystem or background worker. */
export async function performStep(connections: Connections, action: string, body: Record<string, unknown>) {
  const source = configFor(connections.source)
  const destination = configFor(connections.destination)
  if (action === "start") {
    const plan = parsePlan(body.plan)
    if (body.approved !== true || (plan.mergeStrategy === "OverrideExistingItem" && body.overwriteApproved !== true)) {
      throw new InputError("Review and approve the destination changes first.")
    }
    await preflight(connections, plan)
    const operationId = crypto.randomUUID()
    await sitecoreRequest(source, CONTENT_TRANSFER, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TransferId: operationId, Configuration: { Database: "master", DataTrees: plan.itemPaths.map(ItemPath => ({ ItemPath, Scope: plan.scope, MergeStrategy: plan.mergeStrategy })) } }),
    })
    return { operationId }
  }
  if (action === "exportStatus") return getJson(source, `${CONTENT_TRANSFER}/${uuid(body.operationId)}/status`)
  if (action === "copyChunk") {
    if (!Number.isInteger(body.chunk) || Number(body.chunk) < 0 || Number(body.chunk) > 100_000) throw new InputError("Invalid chunk index.")
    const path = `${CONTENT_TRANSFER}/${uuid(body.operationId)}/chunksets/${uuid(body.chunkSetId)}/chunks/${body.chunk}`
    const chunk = await sitecoreRequest(source, path, { headers: { Accept: "application/octet-stream" }, signal: AbortSignal.timeout(50_000) })
    const media = chunk.headers.get("Content-Disposition")?.match(/(?:^|;)\s*IsMedia\s*=\s*"?(true|false)"?(?:;|$)/i)?.[1]?.toLowerCase()
    if (!chunk.body || !media) throw new Error("Source chunk is missing binary data or its IsMedia flag.")
    await sitecoreRequest(destination, `${path}?isMedia=${media}`, {
      method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: chunk.body,
      duplex: "half", signal: AbortSignal.timeout(50_000),
    } as RequestInit & { duplex: "half" })
    return { copied: true }
  }
  if (action === "completeChunkSet") return getJson(destination, `${CONTENT_TRANSFER}/${uuid(body.operationId)}/chunksets/${uuid(body.chunkSetId)}/complete`, { method: "POST" })
  if (action === "blobStatus" || action === "import") {
    const file = identifier(body.file)
    if (typeof body.file !== "string" || !body.file.endsWith(".raif")) throw new InputError("Expected a .raif transfer file.")
    const blob = await getJson<{ BlobState: string }>(destination, `${ITEM_TRANSFER}/sources/blobs/${file}`)
    if (action === "blobStatus") return blob
    if (blob.BlobState !== "Uploaded") throw new InputError("The destination file is not ready to import.")
    await sitecoreRequest(destination, `${ITEM_TRANSFER}/transfers/databases/master/sources?blobName=${file}`, { method: "POST" })
    // Do not assume the Location header ends with a UUID. The source file name
    // is used to find the actual native import ID in the paged transfer list.
    return { started: true, file: body.file }
  }
  if (action === "importStatus") {
    const file = typeof body.file === "string" ? body.file : ""
    identifier(file)
    if (typeof body.importId === "string") return transferDetails(connections, body.importId)
    // Imports appear in Sitecore's list; use its real Id rather than inventing it.
    for (let page = 1; page <= 20; page++) {
      const result = await getJson<{ Transfers: NativeStatus[]; TotalCount: number }>(destination, `${ITEM_TRANSFER}/transfers?page=${page}&pageSize=100`)
      const match = result.Transfers?.filter(row => row.SourceName === file).sort((a,b) => (b.ConsumedDate ?? "").localeCompare(a.ConsumedDate ?? ""))[0]
      if (match) return transferDetails(connections, match.Id)
      if (page * 100 >= result.TotalCount) break
    }
    return { TransferState: "Queued" }
  }
  throw new InputError("Unsupported SitecoreAI operation.")
}
