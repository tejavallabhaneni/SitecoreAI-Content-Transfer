// Offline demo: three sample SitecoreAI environments held in memory. It never
// makes a network request. Paths and IDs are fictional ("Harbor and Pine").
// Chunks carry the actual items, so an import really changes the destination.

import type { Backend, DataTree, Env, TreeNode } from "./transfer"

type Item = { id: string; name: string; path: string; template: string }

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

export const DEMO_ENVS: Env[] = [
  { id: "demo-dev", name: "Development (sample)" },
  { id: "demo-staging", name: "Staging (sample)" },
  { id: "demo-prod", name: "Production (sample)" },
]

const guid = (seed: number) => `0a1b2c3d-${(4000 + seed).toString(16).padStart(4, "0")}-4e5f-8a9b-${(seed * 7919).toString(16).padStart(12, "0")}`
const key = (path: string) => path.toLowerCase()

function fullTree(): Item[] {
  let counter = 0
  const item = (path: string, template: string): Item => ({ id: guid(++counter), name: path.split("/").at(-1)!, path, template })
  return [
    item("/sitecore/content", "Main section"), item(SITE, "Headless Tenant"), item(`${SITE}/Website`, "Headless Site"),
    item(HOME, "Page"), item(`${HOME}/About us`, "Page"), item(`${HOME}/Campaigns`, "Folder"),
    item(DEMO_PATHS.newPage, "Campaign page"), item(DEMO_PATHS.existingPage, "Campaign page"),
    item(`${HOME}/Products`, "Page"), item(`${HOME}/Products/Trail jacket`, "Product page"), item(`${HOME}/Products/Harbor boots`, "Product page"),
    item(DEMO_PATHS.conflictPage, "Page"), item(DEMO_PATHS.newFolder, "Folder"), item(DEMO_PATHS.missingParentPage, "Article page"),
    item(DEMO_PATHS.failingImport, "Page"), item(`${SITE}/Website/Data`, "Folder"), item(`${SITE}/Website/Data/Navigation`, "Navigation"),
    item("/sitecore/media library", "Main section"), item("/sitecore/media library/Project", "Media folder"), item(MEDIA, "Media folder"),
    item(`${MEDIA}/Images`, "Media folder"), item(DEMO_PATHS.newImage, "Jpeg"), item(`${MEDIA}/Images/Store front`, "Jpeg"),
  ]
}

type Packaged = { polls: number; chunkSetId: string; chunks: string[] }
type Entry = { item: Item; merge: DataTree["mergeStrategy"] }
type File = { entries: Entry[]; consumed: boolean; polls: number; state?: string; error?: string }

let stores = new Map<string, Map<string, Item>>()
let packaged = new Map<string, Packaged>()
let received = new Map<string, Map<number, string>>()
let files = new Map<string, File>()

/** Resets the sample environments. Called whenever the demo starts. */
export function resetDemo() {
  const items = fullTree()
  const asStore = (list: Item[]) => new Map(list.map(item => [key(item.path), { ...item }]))
  // Staging and Production lack the new content, and "Legacy promo" was
  // recreated there by hand, so it has a different ID at the same path.
  const missing = new Set([DEMO_PATHS.newPage, DEMO_PATHS.newFolder, DEMO_PATHS.missingParentPage, DEMO_PATHS.newImage, DEMO_PATHS.failingImport].map(key))
  const later = items.filter(item => !missing.has(key(item.path))).map(item => key(item.path) === key(DEMO_PATHS.conflictPage) ? { ...item, id: "ffffeeee-dddd-4ccc-bbbb-aaaa99998888" } : item)
  stores = new Map([["demo-dev", asStore(items)], ["demo-staging", asStore(later)], ["demo-prod", asStore(later.filter(item => !item.path.includes("/Summer launch")))]])
  packaged = new Map(); received = new Map(); files = new Map()
}
resetDemo()

function store(env: string) {
  const found = stores.get(env)
  if (!found) throw new Error("Unknown sample environment.")
  return found
}
let delay = 160
/** Tests turn the artificial latency off. */
export const setDemoDelay = (ms: number) => { delay = ms }
const wait = (ms: number) => ms ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

function within(trees: DataTree[], items: Iterable<Item>): Entry[] {
  return [...items].flatMap(item => {
    const tree = trees.find(t => key(item.path) === key(t.itemPath) || (t.scope === "ItemAndDescendants" && key(item.path).startsWith(key(t.itemPath) + "/")))
    return tree ? [{ item, merge: tree.mergeStrategy }] : []
  })
}

export const demoBackend: Backend = {
  get pollMs() { return delay ? 350 : 0 },
  async children(env, path) {
    await wait(delay)
    const items = store(env)
    const parent = items.get(key(path))
    if (!parent) throw new Error("That folder doesn’t exist in this environment.")
    const depth = parent.path.split("/").length
    const all = [...items.values()]
    return all.filter(item => key(item.path).startsWith(key(parent.path) + "/") && item.path.split("/").length === depth + 1)
      .map((item): TreeNode => ({ id: item.id, name: item.name, path: item.path, template: item.template, hasChildren: all.some(other => key(other.path).startsWith(key(item.path) + "/")) }))
  },
  async item(env, path) {
    await wait(delay / 4)
    const found = store(env).get(key(path))
    return found ? { id: found.id, path: found.path } : null
  },
  async createTransfer(env, transferId, trees) {
    await wait(delay)
    const entries = within(trees, store(env).values())
    // Two items per chunk; each chunk is the JSON the destination will import.
    const chunks: string[] = []
    for (let index = 0; index < Math.max(1, entries.length); index += 2) chunks.push(JSON.stringify(entries.slice(index, index + 2)))
    packaged.set(`${env}:${transferId}`, { polls: 0, chunkSetId: crypto.randomUUID(), chunks })
  },
  async transferStatus(env, transferId) {
    await wait(delay)
    const op = packaged.get(`${env}:${transferId}`)
    if (!op) return { state: "NotFound", chunkSets: [] }
    if (op.polls++ < 1) return { state: "Running", chunkSets: [] }
    const total = op.chunks.reduce((sum, chunk) => sum + (JSON.parse(chunk) as Entry[]).length, 0)
    return { state: "Completed", chunkSets: [{ chunkSetId: op.chunkSetId, chunkCount: op.chunks.length, totalItemCount: total }] }
  },
  async getChunk(env, transferId, chunkSetId, chunkId) {
    await wait(delay)
    const op = packaged.get(`${env}:${transferId}`)
    if (!op || op.chunkSetId !== chunkSetId || !op.chunks[chunkId]) throw new Error(`Chunk ${chunkId} came back empty.`)
    return new Blob([op.chunks[chunkId]], { type: "application/octet-stream" })
  },
  async saveChunk(env, transferId, chunkSetId, chunkId, chunk) {
    await wait(delay)
    store(env)
    const id = `${env}:${transferId}:${chunkSetId}`
    const chunks = received.get(id) ?? new Map<number, string>()
    chunks.set(chunkId, await chunk.text())
    received.set(id, chunks)
  },
  async completeChunkSet(env, transferId, chunkSetId) {
    await wait(delay)
    const chunks = received.get(`${env}:${transferId}:${chunkSetId}`)
    if (!chunks?.size) throw new Error("The destination returned no transfer file.")
    const file = `${transferId}.raif`
    const entries = [...chunks.keys()].sort((a, b) => a - b).flatMap(index => JSON.parse(chunks.get(index)!) as Entry[])
    files.set(`${env}:${file}`, { entries, consumed: false, polls: 0 })
    return file
  },
  async deleteTransfer(env, transferId) {
    packaged.delete(`${env}:${transferId}`)
  },
  async consumeFile(env, file) {
    await wait(delay)
    const found = files.get(`${env}:${file}`)
    if (!found) throw new Error("The transfer file does not exist on the destination.")
    found.consumed = true
  },
  async blobState(env, file) {
    await wait(delay)
    const found = files.get(`${env}:${file}`)
    if (!found) return { state: "Error", error: "BlobNotFound" }
    if (!found.consumed || found.polls++ < 1) return { state: "Processing" }
    if (!found.state) {
      if (found.entries.some(entry => key(entry.item.path) === key(DEMO_PATHS.failingImport))) {
        found.state = "Error"; found.error = "Sample failure: field “Body” failed validation on Broken import"
      } else {
        const items = store(env)
        for (const { item, merge } of found.entries) if (!items.has(key(item.path)) || merge === "OverrideExistingItem") items.set(key(item.path), { ...item })
        found.state = "Transferred"
      }
    }
    return { state: found.state, ...(found.error ? { error: found.error } : {}) }
  },
}
