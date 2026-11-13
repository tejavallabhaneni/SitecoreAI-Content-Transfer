// Transfer logic shared by the real SitecoreAI backend and the offline demo.
// Pure TypeScript with no browser or Next.js imports, so it runs in unit tests.

export type Env = { id: string; name: string; tenant?: string }
export type TreeNode = { id: string; name: string; path: string; template: string; hasChildren: boolean; icon?: string }
/** "SingleItem" copies just the item; "ItemAndDescendants" copies it with every item under it. */
export type Scope = "SingleItem" | "ItemAndDescendants"
/**
 * What happens when an item already exists in the destination:
 * - KeepExistingItem: leave it; only missing items are written.
 * - OverrideExistingItem: replace it with the source version.
 * - OverrideExistingTree: make the destination tree match the source exactly,
 *   deleting destination items under it that the source doesn't have.
 */
export type Merge = "KeepExistingItem" | "OverrideExistingItem" | "OverrideExistingTree"
export type Selection = { path: string; scope: Scope }
export type Plan = { items: Selection[]; mergeStrategy: Merge }
export type DataTree = { itemPath: string; scope: Scope; mergeStrategy: Merge }

/** Replacing a whole tree only makes sense with its sub-items; a single item is overwritten instead. */
export const treeFor = (item: Selection, merge: Merge): DataTree => ({
  itemPath: item.path, scope: item.scope,
  mergeStrategy: merge === "OverrideExistingTree" && item.scope !== "ItemAndDescendants" ? "OverrideExistingItem" : merge,
})
export type ChunkSet = { chunkSetId: string; chunkCount: number; totalItemCount: number }

/** Everything the app needs from one SitecoreAI environment, addressed by environment ID. */
export interface Backend {
  pollMs: number
  children(env: string, path: string): Promise<TreeNode[]>
  item(env: string, path: string): Promise<{ id: string; path: string } | null>
  createTransfer(env: string, transferId: string, trees: DataTree[]): Promise<void>
  transferStatus(env: string, transferId: string): Promise<{ state: string; chunkSets: ChunkSet[] }>
  getChunk(env: string, transferId: string, chunkSetId: string, chunkId: number): Promise<Blob>
  saveChunk(env: string, transferId: string, chunkSetId: string, chunkId: number, chunk: Blob, isMedia: boolean): Promise<void>
  completeChunkSet(env: string, transferId: string, chunkSetId: string): Promise<string>
  deleteTransfer(env: string, transferId: string): Promise<void>
  consumeFile(env: string, file: string): Promise<void>
  blobState(env: string, file: string): Promise<{ state: string; error?: string }>
}

export const ROOTS = ["/sitecore/content", "/sitecore/media library"]
export const isMedia = (path: string) => /^\/sitecore\/media library(\/|$)/i.test(path.trim())
const normalizeId = (id: string) => id.toLowerCase().replace(/[{}-]/g, "")
const lower = (path: string) => path.toLowerCase()

/** Checks a plan before it becomes a draft. Returns an error message, or "" when it's fine. */
export function planProblem(plan: Plan): string {
  if (!plan.items.length) return "Tick at least one item in the From tree."
  if (plan.items.length > 20) return "Select at most 20 items. Use “with sub-items” instead of ticking each one."
  const paths = plan.items.map(item => lower(item.path))
  if (paths.some(path => ROOTS.includes(path) || !/^\/sitecore\/(content|media library)\//.test(path))) return "Choose items under Content or Media Library, not the root folders."
  if (new Set(paths).size !== paths.length) return "The same item is selected twice."
  const inside = plan.items.find(item => plan.items.some(parent => parent !== item && parent.scope === "ItemAndDescendants" && lower(item.path).startsWith(lower(parent.path) + "/")))
  if (inside) return `“${inside.path.split("/").at(-1)}” is already included by a selected item with sub-items. Untick it, or copy the parent as a single item.`
  return ""
}

export type ReviewOutcome = "create" | "update" | "replace" | "keep" | "conflict"
export type ReviewRow = { path: string; scope: Scope; outcome: ReviewOutcome; parents: number; message?: string; removes?: string[]; removesTruncated?: boolean }

const SUBTREE_LIMIT = 2000
/** Every item under `path` (not the item itself), as id → path, up to a limit. */
async function subtree(backend: Backend, env: string, path: string): Promise<{ items: Map<string, string>; truncated: boolean }> {
  const items = new Map<string, string>()
  const queue = [path]
  while (queue.length) {
    const next = queue.shift()!
    let children: TreeNode[] = []
    try { children = await backend.children(env, next) } catch { if (next === path) return { items, truncated: false }; continue }
    for (const child of children) {
      if (items.size >= SUBTREE_LIMIT) return { items, truncated: true }
      items.set(normalizeId(child.id), child.path)
      if (child.hasChildren) queue.push(child.path)
    }
  }
  return { items, truncated: false }
}

/** Parent folders that must already exist, with the same IDs, in the destination. */
export function parentPaths(path: string): string[] {
  const segments = path.split("/").filter(Boolean)
  return segments.slice(2, -1).map((_, index) => "/" + segments.slice(0, index + 3).join("/"))
}

/**
 * What would happen to each selected item. Fails closed on a different ID at
 * the same path or a missing parent, the two cases that orphan imported items.
 */
export async function reviewPlan(backend: Backend, source: string, destination: string, plan: Plan): Promise<ReviewRow[]> {
  if (source === destination) throw new Error("Pick two different environments.")
  const rows: ReviewRow[] = []
  for (const selection of plan.items) {
    const { path, scope } = selection
    const tree = treeFor(selection, plan.mergeStrategy)
    const [from, to] = await Promise.all([backend.item(source, path), backend.item(destination, path)])
    if (!from) { rows.push({ path, scope, outcome: "conflict", parents: 0, message: "Source item was not found" }); continue }
    if (to && normalizeId(to.id) !== normalizeId(from.id)) { rows.push({ path, scope, outcome: "conflict", parents: 0, message: "Destination item at the same path has a different Sitecore item ID" }); continue }
    let missing = ""
    const parents = ["/sitecore/" + path.split("/")[2], ...parentPaths(path)]
    for (const parent of parents) {
      const [a, b] = await Promise.all([backend.item(source, parent), backend.item(destination, parent)])
      if (!a || !b) { missing = `Missing required parent in one environment: ${parent}`; break }
      if (normalizeId(a.id) !== normalizeId(b.id)) { missing = `Parent item has a different ID in each environment: ${parent}`; break }
    }
    if (missing) { rows.push({ path, scope, outcome: "conflict", parents: 0, message: missing }); continue }
    if (tree.mergeStrategy === "OverrideExistingTree" && to) {
      // Show exactly what replacing the tree would delete: items under it in To that From doesn't have.
      const [fromTree, toTree] = await Promise.all([subtree(backend, source, path), subtree(backend, destination, path)])
      const removes = [...toTree.items].filter(([id]) => !fromTree.items.has(id)).map(([, itemPath]) => itemPath).sort()
      rows.push({ path, scope, parents: parents.length, outcome: "replace", removes, removesTruncated: fromTree.truncated || toTree.truncated })
      continue
    }
    rows.push({ path, scope, parents: parents.length, outcome: !to ? "create" : tree.mergeStrategy === "KeepExistingItem" ? "keep" : "update" })
  }
  return rows
}

export type Progress = { phase: 1 | 2 | 3 | 4 | 5; stage: string; items?: number; chunk?: number; chunks?: number }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean, every: number, what: string): Promise<T> {
  const deadline = Date.now() + 30 * 60_000
  while (Date.now() < deadline) {
    const value = await read()
    if (done(value)) return value
    await sleep(every)
  }
  throw new Error(`${what} timed out. Check the destination before starting another transfer.`)
}

/** Maps a destination file state to running / done / failed. */
export function importState(state: { state: string; error?: string }): "running" | "done" | "partial" | "failed" {
  if (["Transferred", "Consumed", "Completed", "OK"].includes(state.state)) return "done"
  if (state.state === "TransferredWithErrors") return "partial"
  if (state.state === "Error") return /BlobNotFound/i.test(state.error ?? "") ? "done" : "failed"
  if (state.state === "Discarded") return "failed"
  return "running"
}

/**
 * Runs an approved plan: the source packages the items, each chunk is copied
 * to the destination, and the destination imports the resulting file into
 * master. Media and content travel in separate transfers.
 */
export type Approval = { approved: boolean; overwriteApproved: boolean; deleteApproved?: boolean }
/** Which approvals a plan needs: overwriting for either override, deleting for a tree replacement. */
export function approvalsFor(plan: Plan) {
  const trees = plan.items.map(item => treeFor(item, plan.mergeStrategy))
  return { overwrite: trees.some(tree => tree.mergeStrategy !== "KeepExistingItem"), delete: trees.some(tree => tree.mergeStrategy === "OverrideExistingTree") }
}

export async function runTransfer(backend: Backend, source: string, destination: string, plan: Plan,
  approval: Approval, report: (progress: Progress) => void, newId: () => string = () => crypto.randomUUID()) {
  const needs = approvalsFor(plan)
  if (!approval.approved || (needs.overwrite && !approval.overwriteApproved) || (needs.delete && !approval.deleteApproved)) throw new Error("Approve the changes before starting.")
  const problem = planProblem(plan)
  if (problem) throw new Error(problem)
  report({ phase: 1, stage: "Checking both environments again" })
  const blocked = (await reviewPlan(backend, source, destination, plan)).find(row => row.outcome === "conflict")
  if (blocked) throw new Error(`${blocked.path}: ${blocked.message}`)

  const trees = plan.items.map(item => treeFor(item, plan.mergeStrategy))
  const groups = [false, true].map(media => ({ media, trees: trees.filter(tree => isMedia(tree.itemPath) === media) })).filter(group => group.trees.length)
  let total = 0
  let partial = false
  for (const group of groups) {
    const transferId = newId()
    report({ phase: 1, stage: group.media ? "Packaging media on the source" : "Packaging content on the source" })
    const files: string[] = []
    let items = 0
    // Covers creation and packaging too: a failed or timed-out export must not
    // leave the transfer behind on the source either.
    try {
      await backend.createTransfer(source, transferId, group.trees)
      let notFound = 0
      const status = await poll(() => backend.transferStatus(source, transferId), value => {
        if (value.state === "NotFound" && ++notFound > 5) throw new Error("The source lost track of the transfer.")
        if (value.state === "Failed") throw new Error("The source could not package the selected items.")
        return value.state === "Completed"
      }, backend.pollMs, "Packaging on the source")
      const chunks = status.chunkSets.reduce((sum, set) => sum + set.chunkCount, 0)
      items = status.chunkSets.reduce((sum, set) => sum + set.totalItemCount, 0)
      let copied = 0
      for (const set of status.chunkSets) {
        for (let chunk = 0; chunk < set.chunkCount; chunk++) {
          report({ phase: 2, stage: `Copying chunk ${copied + 1} of ${chunks}`, chunk: copied, chunks, items })
          const blob = await backend.getChunk(source, transferId, set.chunkSetId, chunk)
          await backend.saveChunk(destination, transferId, set.chunkSetId, chunk, blob, group.media)
          copied++
        }
        report({ phase: 3, stage: "Preparing the file on the destination", chunk: copied, chunks, items })
        files.push(await backend.completeChunkSet(destination, transferId, set.chunkSetId))
      }
    } finally {
      // Never leave a packaged transfer behind on the source.
      await backend.deleteTransfer(source, transferId).catch(() => undefined)
    }
    total += items
    for (const file of files) {
      report({ phase: 4, stage: "Importing into the destination’s master database", items })
      await backend.consumeFile(destination, file)
      const final = await poll(() => backend.blobState(destination, file), value => importState(value) !== "running", backend.pollMs, "Import on the destination")
      const meaning = importState(final)
      if (meaning === "failed") throw new Error(`The destination could not import the items: ${final.error || final.state}.`)
      if (meaning === "partial") partial = true
    }
  }
  report({ phase: 5, stage: partial ? "Imported with errors — check the destination" : "Imported to master — publish when you’re ready", items: total })
  return { items: total, partial }
}
