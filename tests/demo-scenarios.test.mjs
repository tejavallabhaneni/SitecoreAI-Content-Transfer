import test from "node:test"
import assert from "node:assert/strict"
import { DEMO_PATHS, demoAction, resetDemo } from "../src/lib/demo-sitecore.ts"

// Every demo call takes a short artificial delay; tests turn it off.
const call = (action, body = {}) => demoAction(action, { ...body, __delay: 0 })
const plan = (itemPaths, scope = "SingleItem", mergeStrategy = "KeepExistingItem") => ({ itemPaths, scope, mergeStrategy })

/** The same sequence runDraft() uses in the browser. */
async function transfer(p, { overwriteApproved = p.mergeStrategy === "OverrideExistingItem" } = {}) {
  const start = await call("start", { plan: p, approved: true, overwriteApproved })
  let exported
  do exported = await call("exportStatus", start); while (exported.State === "Running")
  assert.equal(exported.State, "Completed")
  const [set] = exported.ChunkSetsMetadata
  for (let chunk = 0; chunk < set.ChunkCount; chunk++) await call("copyChunk", { ...start, chunkSetId: set.ChunkSetId, chunk })
  const { ContentTransferFileName: file } = await call("completeChunkSet", { ...start, chunkSetId: set.ChunkSetId })
  assert.match(file, /\.raif$/)
  let blob
  do blob = await call("blobStatus", { file }); while (blob.BlobState !== "Uploaded")
  await call("import", { file })
  let status, importId
  do { status = await call("importStatus", { file, importId }); importId = status.Id ?? importId } while (["Queued", "InProgress"].includes(status.TransferState))
  return status
}

test.beforeEach(() => resetDemo())

test("browsing returns the folder and its direct children", async () => {
  const result = await call("items", { path: DEMO_PATHS.home, side: "source" })
  assert.equal(result.parent.path, DEMO_PATHS.home)
  const names = result.nodes.map(node => node.name)
  assert.ok(names.includes("Campaigns") && names.includes("Legacy promo"))
  assert.ok(!names.includes("Spring sale"), "grandchildren are not listed")
})

test("browsing rejects paths outside content and media", async () => {
  await assert.rejects(call("items", { path: "/sitecore/system" }), /content or media-library path/)
  await assert.rejects(call("items", { path: "/sitecore/content/Nope" }), /not found/)
})

test("destination tree is missing the new content", async () => {
  await assert.rejects(call("items", { path: DEMO_PATHS.newFolder, side: "destination" }), /not found/)
})

test("preflight: new item is ready to create", async () => {
  const [report] = await call("preflight", { plan: plan([DEMO_PATHS.newPage]) })
  assert.equal(report.targetItem, null)
  assert.ok(report.parentChecks.length >= 3)
})

test("preflight: existing item has the same ID", async () => {
  const [report] = await call("preflight", { plan: plan([DEMO_PATHS.existingPage]) })
  assert.equal(report.targetItem.itemId, report.sourceItem.itemId)
})

test("preflight: different ID at the same path is a conflict", async () => {
  await assert.rejects(call("preflight", { plan: plan([DEMO_PATHS.conflictPage]) }), /different Sitecore item ID/)
})

test("preflight: missing parent is a conflict", async () => {
  await assert.rejects(call("preflight", { plan: plan([DEMO_PATHS.missingParentPage]) }), /Missing required parent.*Blog$/)
})

test("start requires approval, and overwrite approval when overwriting", async () => {
  await assert.rejects(call("start", { plan: plan([DEMO_PATHS.newPage]), approved: false }), /approve/)
  await assert.rejects(call("start", { plan: plan([DEMO_PATHS.existingPage], "SingleItem", "OverrideExistingItem"), approved: true, overwriteApproved: false }), /approve/)
})

test("start re-runs the checks and refuses a conflict", async () => {
  await assert.rejects(call("start", { plan: plan([DEMO_PATHS.conflictPage]), approved: true }), /different Sitecore item ID/)
})

test("full transfer creates the new page in the destination", async () => {
  const status = await transfer(plan([DEMO_PATHS.newPage]))
  assert.equal(status.TransferState, "Finished")
  assert.equal(status.TransferredItemsCount, 1)
  const after = await call("items", { path: DEMO_PATHS.newPage, side: "destination" })
  assert.equal(after.parent.path, DEMO_PATHS.newPage)
  const [report] = await call("preflight", { plan: plan([DEMO_PATHS.newPage]) })
  assert.ok(report.targetItem, "a second check now sees it as existing")
})

test("keep-existing writes nothing for an item that is already there", async () => {
  const status = await transfer(plan([DEMO_PATHS.existingPage]))
  assert.equal(status.TransferState, "Finished")
  assert.equal(status.TransferredItemsCount, 0)
})

test("overwrite writes the existing item", async () => {
  const status = await transfer(plan([DEMO_PATHS.existingPage], "SingleItem", "OverrideExistingItem"))
  assert.equal(status.TotalItemsCount, 1)
  assert.equal(status.TransferredItemsCount, 1)
})

test("a folder with descendants fixes the missing-parent case", async () => {
  const status = await transfer(plan([DEMO_PATHS.newFolder], "ItemAndDescendants"))
  assert.equal(status.TransferredItemsCount, 2)
  const [report] = await call("preflight", { plan: plan([DEMO_PATHS.missingParentPage]) })
  assert.ok(report.targetItem)
})

test("media items transfer too", async () => {
  const status = await transfer(plan([DEMO_PATHS.newImage]))
  assert.equal(status.TransferState, "Finished")
})

test("failing import reports validation errors", async () => {
  const status = await transfer(plan([DEMO_PATHS.failingImport]))
  assert.equal(status.TransferState, "Failed")
  assert.match(status.ValidationErrors.join(" "), /Body/)
})

test("history lists sample and new imports, newest first", async () => {
  const before = await call("history", { page: 1 })
  assert.equal(before.current.length, 3)
  await transfer(plan([DEMO_PATHS.newImage]))
  const after = await call("history", { page: 1 })
  assert.equal(after.current.length, 4)
  assert.match(after.current[0].SourceName, /\.raif$/)
  const detail = await call("detail", { id: after.current[0].Id })
  assert.equal(detail.TransferState, "Finished")
})

test("chunk forwarding refuses out-of-range chunks and incomplete sets", async () => {
  const start = await call("start", { plan: plan([DEMO_PATHS.newPage]), approved: true })
  let exported
  do exported = await call("exportStatus", start); while (exported.State === "Running")
  const [set] = exported.ChunkSetsMetadata
  await assert.rejects(call("copyChunk", { ...start, chunkSetId: set.ChunkSetId, chunk: set.ChunkCount }))
  await assert.rejects(call("completeChunkSet", { ...start, chunkSetId: set.ChunkSetId }), /no transfer file/)
})

test("reset restores the sample environments", async () => {
  await transfer(plan([DEMO_PATHS.newPage]))
  resetDemo()
  await assert.rejects(call("items", { path: DEMO_PATHS.newPage, side: "destination" }), /not found/)
})
