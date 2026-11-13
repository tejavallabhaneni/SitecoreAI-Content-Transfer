// Transfer logic shared by the real SitecoreAI backend and the offline demo.
// Pure TypeScript with no browser or Next.js imports, so it runs in unit tests.

export type Env = { id: string; name: string; tenant?: string }
/** `icons` lists the URLs to try for the item’s Sitecore icon, best first. */
export type TreeNode = { id: string; name: string; path: string; template: string; templateId?: string; hasChildren: boolean; icons?: string[] }
export type TemplateInfo = { id: string; path: string; name: string; baseIds: string[] }
export type ItemRef = { id: string; path: string; templateId?: string; templateName?: string }
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
  item(env: string, path: string): Promise<ItemRef | null>
  /** A template by ID: its path, name and the base templates it inherits. Null when the lookup can't find it. */
  templateInfo(env: string, templateId: string): Promise<TemplateInfo | null>
  /** A lighter `children` for comparisons (no icons). Falls back to `children`. */
  childrenForCheck?(env: string, path: string): Promise<TreeNode[]>
  createTransfer(env: string, transferId: string, trees: DataTree[]): Promise<void>
  transferStatus(env: string, transferId: string): Promise<{ state: string; chunkSets: ChunkSet[] }>
  getChunk(env: string, transferId: string, chunkSetId: string, chunkId: number): Promise<Blob>
  saveChunk(env: string, transferId: string, chunkSetId: string, chunkId: number, chunk: Blob, isMedia: boolean): Promise<void>
  completeChunkSet(env: string, transferId: string, chunkSetId: string): Promise<string>
  deleteTransfer(env: string, transferId: string): Promise<void>
  consumeFile(env: string, file: string): Promise<void>
  blobState(env: string, file: string): Promise<{ state: string; error?: string }>
}

/** `/sitecore` and its top-level folders (Content, Templates, Media Library…) can't be copied as a whole. */
export const isTopLevel = (path: string) => !/^\/sitecore\/[^/]+\/./i.test(path.trim())
export const isMedia = (path: string) => /^\/sitecore\/media library(\/|$)/i.test(path.trim())
const normalizeId = (id: string) => id.toLowerCase().replace(/[{}-]/g, "")
const lower = (path: string) => path.toLowerCase()

/** Checks a plan before it becomes a draft. Returns an error message, or "" when it's fine. */
export function planProblem(plan: Plan): string {
  if (!plan.items.length) return "Tick at least one item in the From tree."
  if (plan.items.length > 50) return "Select at most 50 items. Use “with sub-items” instead of ticking each one."
  const paths = plan.items.map(item => lower(item.path))
  if (paths.some(isTopLevel)) return "Choose items inside the top-level folders (Content, Templates, Media Library…), not the folders themselves."
  if (new Set(paths).size !== paths.length) return "The same item is selected twice."
  const inside = plan.items.find(item => plan.items.some(parent => parent !== item && parent.scope === "ItemAndDescendants" && lower(item.path).startsWith(lower(parent.path) + "/")))
  if (inside) return `“${inside.path.split("/").at(-1)}” is already included by a selected item with sub-items. Untick it, or copy the parent as a single item.`
  return ""
}

export type ReviewOutcome = "create" | "update" | "replace" | "keep" | "conflict"
/** For an item copied with sub-items: whether each sub-item is new in To, already there (same ID), or a different item at the same path. */
export type SubItemState = "new" | "exists" | "differs"
export type SubItem = { path: string; state: SubItemState }
/** A template To lacks: used directly by `usedBy` items, or inherited by another missing template. */
export type MissingTemplate = { id: string; name: string; path?: string; usedBy: number; inheritedBy?: string }
export type ReviewRow = {
  path: string; scope: Scope; outcome: ReviewOutcome; parents: number; message?: string
  missingTemplates?: MissingTemplate[]
  /** Templates To lacks that this transfer already includes; they are copied first. */
  templatesFirst?: string[]
  /** Parent folders To lacks; adding them to the transfer resolves the conflict. */
  missingParents?: string[]
  removes?: string[]; removesTruncated?: boolean
  subItems?: SubItem[]; subItemsTruncated?: boolean
}

const SUBTREE_LIMIT = 2000
type Sub = { path: string; templateId?: string; template: string }
/** Every item under `path` (not the item itself), by normalised ID, up to a limit. */
async function subtree(backend: Backend, env: string, path: string): Promise<{ items: Map<string, Sub>; truncated: boolean }> {
  const items = new Map<string, Sub>()
  const list = (folder: string) => backend.childrenForCheck ? backend.childrenForCheck(env, folder) : backend.children(env, folder)
  let queue = [path]
  // Several folders at a time, level by level.
  while (queue.length) {
    const batch = queue.slice(0, 6)
    queue = queue.slice(6)
    const results = await Promise.all(batch.map(folder => list(folder).then(children => ({ folder, children }), () => ({ folder, children: null as TreeNode[] | null }))))
    for (const { folder, children } of results) {
      if (!children) { if (folder === path) return { items, truncated: false }; continue }
      for (const child of children) {
        if (items.size >= SUBTREE_LIMIT) return { items, truncated: true }
        items.set(normalizeId(child.id), { path: child.path, templateId: child.templateId, template: child.template })
        if (child.hasChildren) queue.push(child.path)
      }
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
    const included = (itemPath: string) => plan.items.some(selected => lower(itemPath) === lower(selected.path) || (selected.scope === "ItemAndDescendants" && lower(itemPath).startsWith(lower(selected.path) + "/")))
    let missing = ""
    const missingParents: string[] = []
    const parents = ["/sitecore/" + path.split("/")[2], ...parentPaths(path)]
    for (const parent of parents) {
      const [a, b] = await Promise.all([backend.item(source, parent), backend.item(destination, parent)])
      if (!a) { missing = `Missing required parent in From: ${parent}`; break }
      // A parent To lacks is fine when this transfer includes it; otherwise it can be added.
      if (!b) { if (!included(parent)) missingParents.push(parent); continue }
      if (normalizeId(a.id) !== normalizeId(b.id)) { missing = `Parent item has a different ID in each environment: ${parent}`; break }
    }
    if (missing) { rows.push({ path, scope, outcome: "conflict", parents: 0, message: missing }); continue }
    if (missingParents.length) {
      rows.push({ path, scope, outcome: "conflict", parents: 0, missingParents,
        message: `Missing required parent${missingParents.length === 1 ? "" : "s"} in To: ${missingParents.join(", ")}` })
      continue
    }
    const outcome: ReviewOutcome = tree.mergeStrategy === "OverrideExistingTree" && to ? "replace" : !to ? "create" : tree.mergeStrategy === "KeepExistingItem" ? "keep" : "update"
    const empty = { items: new Map<string, Sub>(), truncated: false }
    // With sub-items: compare both trees so the review can say what each sub-item will do.
    const [fromTree, toTree] = scope === "ItemAndDescendants"
      ? await Promise.all([subtree(backend, source, path), to ? subtree(backend, destination, path) : Promise.resolve(empty)])
      : [empty, empty]
    // Every template these items use must exist in To, or Sitecore can't import them.
    const used = new Map<string, MissingTemplate>()
    for (const ref of [{ templateId: from.templateId, template: from.templateName ?? "" }, ...fromTree.items.values()]) {
      if (!ref.templateId) continue
      const key = normalizeId(ref.templateId)
      const entry = used.get(key) ?? { id: ref.templateId, name: ref.template || ref.templateId, usedBy: 0 }
      entry.usedBy++
      used.set(key, entry)
    }
    // Missing templates, including inherited base templates. A template counts as
    // missing only when the same lookup finds it in From; if From can't find it
    // either, the lookup can't answer for it and it isn't reported.
    const missingTemplates: MissingTemplate[] = []
    const templatesFirst: string[] = []
    const seen = new Set<string>()
    const visit = async (id: string, name: string, usedBy: number, inheritedBy?: string): Promise<void> => {
      const key = normalizeId(id)
      if (seen.has(key)) return
      seen.add(key)
      const toInfo = await backend.templateInfo(destination, id)
      if (toInfo) {
        // Present in To, but its own base templates must be there too.
        for (const base of toInfo.baseIds) await visit(base, "", 0, toInfo.name || name)
        return
      }
      const fromInfo = await backend.templateInfo(source, id)
      if (!fromInfo) return
      if (included(fromInfo.path)) templatesFirst.push(fromInfo.path)
      else missingTemplates.push({ id, name: fromInfo.name || name, path: fromInfo.path, usedBy, ...(inheritedBy ? { inheritedBy } : {}) })
      for (const base of fromInfo.baseIds) await visit(base, "", 0, fromInfo.name || name)
    }
    const templates = [...used.values()]
    for (let index = 0; index < templates.length; index += 8) {
      await Promise.all(templates.slice(index, index + 8).map(template => visit(template.id, template.name, template.usedBy)))
    }
    if (missingTemplates.length) {
      const names = missingTemplates.map(t => t.name)
      rows.push({ path, scope, parents: parents.length, outcome: "conflict", missingTemplates,
        message: `${names.length === 1 ? "Template" : `${names.length} templates`} missing in the destination: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}` })
      continue
    }
    const firstNote = templatesFirst.length ? { templatesFirst: templatesFirst.sort() } : {}
    if (scope !== "ItemAndDescendants") { rows.push({ path, scope, parents: parents.length, outcome, ...firstNote }); continue }
    const toByPath = new Set([...toTree.items.values()].map(sub => lower(sub.path)))
    const subItems: SubItem[] = [...fromTree.items].map(([id, sub]) => ({ path: sub.path, state: toTree.items.has(id) ? "exists" as const : toByPath.has(lower(sub.path)) ? "differs" as const : "new" as const }))
      .sort((a, b) => a.path.localeCompare(b.path))
    const row: ReviewRow = { path, scope, parents: parents.length, outcome, subItems, subItemsTruncated: fromTree.truncated || toTree.truncated, ...firstNote }
    // Replacing a tree deletes items under it in To that From doesn't have.
    if (outcome === "replace") {
      row.removes = [...toTree.items].filter(([id]) => !fromTree.items.has(id)).map(([, sub]) => sub.path).sort()
      row.removesTruncated = row.subItemsTruncated
    }
    rows.push(row)
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

  // Parents before children, so items added for a missing parent import first.
  const trees = plan.items.map(item => treeFor(item, plan.mergeStrategy)).sort((a, b) => a.itemPath.split("/").length - b.itemPath.split("/").length)
  // Templates go first, in their own transfer, so content that uses them can import.
  const isTemplate = (path: string) => /^\/sitecore\/templates\//i.test(path)
  const groups = [
    { media: false, trees: trees.filter(tree => isTemplate(tree.itemPath)) },
    { media: false, trees: trees.filter(tree => !isTemplate(tree.itemPath) && !isMedia(tree.itemPath)) },
    { media: true, trees: trees.filter(tree => isMedia(tree.itemPath)) },
  ].filter(group => group.trees.length)
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
