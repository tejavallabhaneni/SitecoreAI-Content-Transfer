// Offline demo: an in-memory imitation of the SitecoreAI endpoints this app
// calls. It never makes a network request and never sees real credentials.
// Paths and IDs are fictional sample content ("Harbor and Pine").

import type { Connections, HistoryRecord, NativeStatus, Plan } from "./sitecore/public-transfer"

export const DEMO_CONNECTIONS: Connections = {
  source: { baseUrl: "https://demo-source.sitecore-sample.invalid", accessToken: "demo-token-not-a-secret" },
  destination: { baseUrl: "https://demo-destination.sitecore-sample.invalid", accessToken: "demo-token-not-a-secret" },
}

type Item = { itemId: string; name: string; path: string; template: string; fields: string[] }

const SITE = "/sitecore/content/Harbor and Pine"
const HOME = `${SITE}/Website/Home`
const MEDIA = "/sitecore/media library/Project/Harbor and Pine"

/** The sample scenarios, so the UI and tests can point at them by name. */
export const DEMO_PATHS = {
  home: HOME,
  newPage: `${HOME}/Campaigns/Spring sale`,
  existingPage: `${HOME}/Campaigns/Summer launch`,
  conflictPage: `${HOME}/Legacy promo`,
  missingParentPage: `${HOME}/Blog/Welcome post`,
  newFolder: `${HOME}/Blog`,
  failingImport: `${HOME}/Broken import`,
  newImage: `${MEDIA}/Images/Hero spring`,
} as const

const page = ["Title", "Summary", "Body"]
let counter = 0
const guid = (seed: number) => `0a1b2c3d-${(4000 + seed).toString(16).padStart(4, "0")}-4e5f-8a9b-${(seed * 7919).toString(16).padStart(12, "0")}`

function tree(): Item[] {
  counter = 0
  const item = (path: string, template: string, fields: string[] = []): Item => ({ itemId: guid(++counter), name: path.split("/").at(-1)!, path, template, fields })
  return [
    item("/sitecore/content", "Main section"),
    item(SITE, "Headless Tenant"),
    item(`${SITE}/Website`, "Headless Site"),
    item(HOME, "Page", page),
    item(`${HOME}/About us`, "Page", page),
    item(`${HOME}/Campaigns`, "Folder"),
    item(DEMO_PATHS.newPage, "Campaign page", [...page, "Start date"]),
    item(DEMO_PATHS.existingPage, "Campaign page", [...page, "Start date"]),
    item(`${HOME}/Products`, "Page", page),
    item(`${HOME}/Products/Trail jacket`, "Product page", [...page, "Price", "SKU"]),
    item(`${HOME}/Products/Harbor boots`, "Product page", [...page, "Price", "SKU"]),
    item(DEMO_PATHS.conflictPage, "Page", page),
    item(DEMO_PATHS.newFolder, "Folder"),
    item(DEMO_PATHS.missingParentPage, "Article page", [...page, "Author"]),
    item(DEMO_PATHS.failingImport, "Page", page),
    item(`${SITE}/Website/Data`, "Folder"),
    item(`${SITE}/Website/Data/Navigation`, "Navigation", ["Links"]),
    item("/sitecore/media library", "Main section"),
    item("/sitecore/media library/Project", "Media folder"),
    item(MEDIA, "Media folder"),
    item(`${MEDIA}/Images`, "Media folder"),
    item(DEMO_PATHS.newImage, "Jpeg", ["Alt", "Width", "Height"]),
    item(`${MEDIA}/Images/Store front`, "Jpeg", ["Alt", "Width", "Height"]),
  ]
}

type ExportOp = { plan: Plan; polls: number; chunkSetId: string; chunks: number; copied: Set<number>; completed: boolean }
type ImportOp = NativeStatus & { polls: number; plan: Plan; file: string; history: { Name: string; Date: string }[] }

let source = new Map<string, Item>()
let destination = new Map<string, Item>()
let exportOps = new Map<string, ExportOp>()
let blobs = new Map<string, { op: string; polls: number }>()
let imports: ImportOp[] = []

const key = (path: string) => path.toLowerCase()
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

/** Resets the sample environments. Called whenever the demo starts. */
export function resetDemo() {
  const items = tree()
  source = new Map(items.map(item => [key(item.path), item]))
  // The destination is missing the new content, and "Legacy promo" was
  // recreated there by hand, so it has a different ID at the same path.
  const missing = new Set([DEMO_PATHS.newPage, DEMO_PATHS.newFolder, DEMO_PATHS.missingParentPage, DEMO_PATHS.newImage, DEMO_PATHS.failingImport].map(key))
  destination = new Map(items.filter(item => !missing.has(key(item.path))).map(item => [key(item.path), { ...item }]))
  destination.get(key(DEMO_PATHS.conflictPage))!.itemId = "ffffeeee-dddd-4ccc-bbbb-aaaa99998888"
  exportOps = new Map(); blobs = new Map()
  const done = (name: string, minutes: number, total: number, state = "Finished", errors: string[] | null = null): ImportOp => ({
    Id: crypto.randomUUID(), SourceName: name, DatabaseName: "master", ConsumedDate: ago(minutes), TransferState: state,
    Strategy: "KeepExistingItem", TotalItemsCount: total, TransferredItemsCount: state === "Finished" ? total : 0, ValidationErrors: errors,
    Description: state === "Failed" ? "Sample failure: a required template was missing in the destination." : undefined,
    polls: 99, plan: { itemPaths: [], scope: "SingleItem", mergeStrategy: "KeepExistingItem" }, file: name,
    history: [{ Name: "Queued", Date: ago(minutes + 2) }, { Name: "InProgress", Date: ago(minutes + 1) }, { Name: state, Date: ago(minutes) }],
  })
  imports = [
    done("product-pages-sample.raif", 60 * 26, 12),
    done("navigation-sample.raif", 60 * 3, 3),
    done("store-locator-sample.raif", 45, 0, "Failed", ["Sample: template {B3C1...} is not present in the destination."]),
  ]
}
resetDemo()

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function browse(path: unknown, side: unknown) {
  const value = typeof path === "string" ? path : "/sitecore/content"
  if (!/^\/sitecore\/(content|media library)(\/|$)/i.test(value) || value.includes("..")) throw new Error("Choose a content or media-library path.")
  const store = side === "destination" ? destination : source
  const parent = store.get(key(value.replace(/\/$/, "")))
  if (!parent) throw new Error("That content path was not found.")
  const depth = parent.path.split("/").length
  const children = [...store.values()].filter(item => item.path.toLowerCase().startsWith(key(parent.path) + "/") && item.path.split("/").length === depth + 1)
  const shape = (item: Item) => ({ itemId: item.itemId, name: item.name, path: item.path, template: { name: item.template }, fields: { nodes: item.fields.map(name => ({ name })) } })
  return { parent: shape(parent), nodes: children.map(shape), pageInfo: { hasNextPage: false } }
}

/** Mirrors the real preflight: fail closed on a different ID or a missing parent. */
function preflightOne(path: string) {
  const sourceItem = source.get(key(path))
  if (!sourceItem) throw new Error("Source item was not found")
  const targetItem = destination.get(key(path)) ?? null
  if (targetItem && targetItem.itemId !== sourceItem.itemId) throw new Error("Destination item at the same path has a different Sitecore item ID")
  const segments = path.split("/").filter(Boolean)
  const parentChecks = []
  for (let i = 2; i < segments.length; i++) {
    const parent = "/" + segments.slice(0, i).join("/")
    const a = source.get(key(parent)); const b = destination.get(key(parent))
    if (!a || !b) throw new Error(`Missing required parent in one environment: ${parent}`)
    parentChecks.push({ path: parent, sourceId: a.itemId, destinationId: b.itemId })
  }
  return { sourceItem: { itemId: sourceItem.itemId, path: sourceItem.path }, targetItem: targetItem && { itemId: targetItem.itemId, path: targetItem.path }, parentChecks, checkedAt: new Date().toISOString(), ready: true as const }
}

function plan(value: unknown): Plan {
  const input = value as Plan | undefined
  if (!input || !Array.isArray(input.itemPaths) || input.itemPaths.length < 1 || input.itemPaths.length > 20) throw new Error("Select between 1 and 20 content roots.")
  return input
}

function itemsIn(p: Plan) {
  return [...source.values()].filter(item => p.itemPaths.some(root => key(item.path) === key(root) || (p.scope === "ItemAndDescendants" && key(item.path).startsWith(key(root) + "/"))))
}

function apply(p: Plan) {
  let written = 0
  for (const item of itemsIn(p)) {
    const existing = destination.get(key(item.path))
    if (existing && p.mergeStrategy === "KeepExistingItem") continue
    destination.set(key(item.path), { ...item }); written++
  }
  return written
}

function history() {
  const current = imports.map(status)
  const records: HistoryRecord[] = imports.map(op => ({ Name: op.Id, SourceName: op.SourceName, ConsumeDate: op.ConsumedDate, Strategy: op.Strategy, Events: op.history }))
  return { current: [...current].reverse(), history: [...records].reverse(), totalCount: imports.length, page: 1 }
}

function status(op: ImportOp): NativeStatus {
  return { Id: op.Id, SourceName: op.SourceName, DatabaseName: op.DatabaseName, ConsumedDate: op.ConsumedDate, TransferState: op.TransferState, Strategy: op.Strategy,
    Description: op.Description, TotalItemsCount: op.TotalItemsCount, TransferredItemsCount: op.TransferredItemsCount, ValidationErrors: op.ValidationErrors }
}

/** Handles one app action exactly as /api/sitecore would, but in memory. */
export async function demoAction<T>(action: string, body: Record<string, unknown>): Promise<T> {
  await wait(Number(body.__delay ?? 180))
  return run(action, body) as T
}

function run(action: string, body: Record<string, unknown>): unknown {
  switch (action) {
    case "history": return Number(body.page ?? 1) > 1 ? { current: [], history: [], totalCount: imports.length, page: body.page } : history()
    case "detail": {
      const op = imports.find(row => row.Id === body.id)
      if (!op) throw new Error("SitecoreAI could not find that transfer.")
      return status(op)
    }
    case "items": return browse(body.path, body.side)
    case "preflight": return plan(body.plan).itemPaths.map(preflightOne)
    case "start": {
      const p = plan(body.plan)
      if (body.approved !== true || (p.mergeStrategy === "OverrideExistingItem" && body.overwriteApproved !== true)) throw new Error("Review and approve the destination changes first.")
      p.itemPaths.forEach(preflightOne)
      const operationId = crypto.randomUUID()
      exportOps.set(operationId, { plan: p, polls: 0, chunkSetId: crypto.randomUUID(), chunks: Math.max(1, Math.ceil(itemsIn(p).length / 2)), copied: new Set(), completed: false })
      return { operationId }
    }
    case "exportStatus": {
      const op = exportOps.get(String(body.operationId))
      if (!op) return { State: "NotFound" }
      op.polls++
      return op.polls < 2 ? { State: "Running" } : { State: "Completed", ChunkSetsMetadata: [{ ChunkSetId: op.chunkSetId, ChunkCount: op.chunks }] }
    }
    case "copyChunk": {
      const op = exportOps.get(String(body.operationId))
      if (!op || body.chunkSetId !== op.chunkSetId || !Number.isInteger(body.chunk) || Number(body.chunk) >= op.chunks) throw new Error("Source chunk is missing binary data or its IsMedia flag.")
      op.copied.add(Number(body.chunk))
      return { copied: true }
    }
    case "completeChunkSet": {
      const op = exportOps.get(String(body.operationId))
      if (!op || op.copied.size !== op.chunks) throw new Error("Destination returned no transfer file.")
      op.completed = true
      const file = `${body.operationId}.raif`
      blobs.set(file, { op: String(body.operationId), polls: 0 })
      return { ContentTransferFileName: file }
    }
    case "blobStatus": {
      const blob = blobs.get(String(body.file))
      if (!blob) throw new Error("Destination file: not found")
      blob.polls++
      return { BlobState: blob.polls < 2 ? "Processing" : "Uploaded" }
    }
    case "import": {
      const blob = blobs.get(String(body.file))
      if (!blob || blob.polls < 2) throw new Error("The destination file is not ready to import.")
      const op = exportOps.get(blob.op)!
      const now = new Date().toISOString()
      imports.push({ Id: crypto.randomUUID(), SourceName: String(body.file), DatabaseName: "master", ConsumedDate: now, TransferState: "Queued", Strategy: op.plan.mergeStrategy,
        TotalItemsCount: itemsIn(op.plan).length, TransferredItemsCount: 0, ValidationErrors: null, polls: 0, plan: op.plan, file: String(body.file), history: [{ Name: "Queued", Date: now }] })
      return { started: true, file: body.file }
    }
    case "importStatus": {
      const op = imports.find(row => row.Id === body.importId) ?? imports.find(row => row.file === body.file)
      if (!op) return { TransferState: "Queued" }
      if (op.polls++ > 10) return status(op)
      const now = new Date().toISOString()
      if (op.TransferState === "Queued") { op.TransferState = "InProgress"; op.TransferredItemsCount = Math.floor((op.TotalItemsCount ?? 0) / 2); op.history.push({ Name: "InProgress", Date: now }) }
      else if (op.TransferState === "InProgress") {
        if (op.plan.itemPaths.some(path => key(path) === key(DEMO_PATHS.failingImport))) {
          op.TransferState = "Failed"; op.ValidationErrors = ["Sample: field \"Body\" failed destination validation on Broken import."]
          op.Description = "Sample failure to show how errors look."
        } else {
          op.TransferredItemsCount = apply(op.plan); op.TransferState = "Finished"
        }
        op.history.push({ Name: op.TransferState, Date: now })
      }
      return status(op)
    }
    case "test": return { ok: true }
    default: throw new Error("Unsupported SitecoreAI operation.")
  }
}
