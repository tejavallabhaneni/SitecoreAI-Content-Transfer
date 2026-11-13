import test from "node:test"
import assert from "node:assert/strict"
import { DEMO_ENVS, DEMO_PATHS, demoBackend, resetDemo, setDemoDelay } from "../src/lib/demo-sitecore.ts"
import { importState, parentPaths, planProblem, reviewPlan, runTransfer } from "../src/lib/transfer.ts"

setDemoDelay(0)
const [DEV, STAGING, PROD] = DEMO_ENVS.map(env => env.id)
const plan = (itemPaths, scope = "SingleItem", mergeStrategy = "KeepExistingItem") => ({ itemPaths, scope, mergeStrategy })
const approve = { approved: true, overwriteApproved: true }
const run = (p, from = DEV, to = STAGING, approval = approve) => runTransfer(demoBackend, from, to, p, approval, () => {})
const outcomes = async (p, from = DEV, to = STAGING) => (await reviewPlan(demoBackend, from, to, p)).map(row => row.outcome)

test.beforeEach(() => resetDemo())

test("parent paths start below the root folder", () => {
  assert.deepEqual(parentPaths("/sitecore/content/A/B/C"), ["/sitecore/content/A", "/sitecore/content/A/B"])
  assert.deepEqual(parentPaths("/sitecore/content/A"), [])
})

test("plan checks: empty, roots, duplicates, overlap, too many", () => {
  assert.match(planProblem(plan([])), /Tick at least one/)
  assert.match(planProblem(plan(["/sitecore/content"])), /not the root/)
  assert.match(planProblem(plan(["/sitecore/system/x"])), /not the root/)
  assert.match(planProblem(plan([DEMO_PATHS.newPage, DEMO_PATHS.newPage.toUpperCase()])), /twice/)
  assert.match(planProblem(plan([DEMO_PATHS.home, DEMO_PATHS.newPage], "ItemAndDescendants")), /inside another/)
  assert.equal(planProblem(plan([DEMO_PATHS.home, DEMO_PATHS.newPage])), "")
  assert.match(planProblem(plan(Array.from({ length: 21 }, (_, i) => `/sitecore/content/x${i}`))), /at most 20/)
})

test("tree: first level of Content, with children flags", async () => {
  const nodes = await demoBackend.children(DEV, "/sitecore/content")
  assert.deepEqual(nodes.map(n => n.name), ["Harbor and Pine"])
  assert.equal(nodes[0].hasChildren, true)
  const leaves = await demoBackend.children(DEV, `${DEMO_PATHS.home}/Campaigns`)
  assert.ok(leaves.every(n => n.hasChildren === false))
})

test("tree: environments differ the way the scenarios need", async () => {
  await assert.rejects(demoBackend.children(STAGING, DEMO_PATHS.newFolder), /doesn’t exist/)
  assert.equal(await demoBackend.item(PROD, DEMO_PATHS.existingPage), null)
  const [dev, staging] = await Promise.all([demoBackend.item(DEV, DEMO_PATHS.conflictPage), demoBackend.item(STAGING, DEMO_PATHS.conflictPage)])
  assert.notEqual(dev.id, staging.id)
})

test("review: create, skip, update, and both conflict kinds", async () => {
  assert.deepEqual(await outcomes(plan([DEMO_PATHS.newPage, DEMO_PATHS.existingPage, DEMO_PATHS.conflictPage, DEMO_PATHS.missingParentPage])), ["create", "keep", "conflict", "conflict"])
  assert.deepEqual(await outcomes(plan([DEMO_PATHS.existingPage], "SingleItem", "OverrideExistingItem")), ["update"])
  const [conflict, parent] = await reviewPlan(demoBackend, DEV, STAGING, plan([DEMO_PATHS.conflictPage, DEMO_PATHS.missingParentPage]))
  assert.match(conflict.message, /different Sitecore item ID/)
  assert.match(parent.message, /Missing required parent.*\/Blog$/)
})

test("review: same environment twice is refused", async () => {
  await assert.rejects(reviewPlan(demoBackend, DEV, DEV, plan([DEMO_PATHS.newPage])), /two different/)
})

test("run: needs approval, and overwrite approval when overwriting", async () => {
  await assert.rejects(run(plan([DEMO_PATHS.newPage]), DEV, STAGING, { approved: false, overwriteApproved: false }), /Approve/)
  await assert.rejects(run(plan([DEMO_PATHS.existingPage], "SingleItem", "OverrideExistingItem"), DEV, STAGING, { approved: true, overwriteApproved: false }), /Approve/)
})

test("run: re-checks and refuses a conflict before writing", async () => {
  await assert.rejects(run(plan([DEMO_PATHS.conflictPage])), /different Sitecore item ID/)
})

test("run: creates a new page and reports every phase", async () => {
  const phases = []
  const result = await runTransfer(demoBackend, DEV, STAGING, plan([DEMO_PATHS.newPage]), approve, p => phases.push(p.phase))
  assert.equal(result.items, 1)
  assert.deepEqual([...new Set(phases)], [1, 2, 3, 4, 5])
  assert.equal((await demoBackend.item(STAGING, DEMO_PATHS.newPage)).path, DEMO_PATHS.newPage)
  assert.deepEqual(await outcomes(plan([DEMO_PATHS.newPage])), ["keep"], "a second review sees it as existing")
})

test("run: keep-existing leaves the destination version; overwrite replaces it", async () => {
  const before = await demoBackend.item(PROD, DEMO_PATHS.home)
  await run(plan([DEMO_PATHS.existingPage]), DEV, STAGING)
  assert.ok(await demoBackend.item(STAGING, DEMO_PATHS.existingPage))
  await run(plan([DEMO_PATHS.existingPage]), DEV, PROD)
  assert.ok(await demoBackend.item(PROD, DEMO_PATHS.existingPage), "missing in Production, so it is created")
  assert.equal((await demoBackend.item(PROD, DEMO_PATHS.home)).id, before.id)
})

test("run: a folder with everything under it fixes the missing parent", async () => {
  const result = await run(plan([DEMO_PATHS.newFolder], "ItemAndDescendants"))
  assert.equal(result.items, 2)
  assert.deepEqual(await outcomes(plan([DEMO_PATHS.missingParentPage])), ["keep"])
})

test("run: content and media travel separately", async () => {
  const media = []
  const spy = { ...demoBackend, pollMs: 0, saveChunk: (...args) => { media.push(args[5]); return demoBackend.saveChunk(...args) } }
  Object.defineProperty(spy, "pollMs", { value: 0 })
  await runTransfer(spy, DEV, STAGING, plan([DEMO_PATHS.newPage, DEMO_PATHS.newImage]), approve, () => {})
  assert.deepEqual([...new Set(media)].sort(), [false, true])
  assert.ok(await demoBackend.item(STAGING, DEMO_PATHS.newImage))
})

test("run: a failed import is reported, and nothing is written", async () => {
  await assert.rejects(run(plan([DEMO_PATHS.failingImport])), /could not import.*Broken import/)
  assert.equal(await demoBackend.item(STAGING, DEMO_PATHS.failingImport), null)
})

test("run: follows the Content Transfer call order and always cleans up the source", async () => {
  const calls = []
  const fake = {
    pollMs: 0,
    children: async () => [],
    item: async (env, path) => ({ id: `id-${path}`, path }),
    createTransfer: async (env) => { calls.push(`create@${env}`) },
    transferStatus: async () => ({ state: "Completed", chunkSets: [{ chunkSetId: "set", chunkCount: 2, totalItemCount: 3 }] }),
    getChunk: async (env, id, set, n) => { calls.push(`get${n}@${env}`); return new Blob(["x"]) },
    saveChunk: async (env, id, set, n) => { calls.push(`save${n}@${env}`); if (n === 1 && fake.failSave) throw new Error("disk full") },
    completeChunkSet: async (env) => { calls.push(`complete@${env}`); return "f.raif" },
    deleteTransfer: async (env) => { calls.push(`delete@${env}`) },
    consumeFile: async (env) => { calls.push(`consume@${env}`) },
    blobState: async () => ({ state: "Transferred" }),
  }
  await runTransfer(fake, "A", "B", plan(["/sitecore/content/S/P"]), approve, () => {}, () => "t1")
  assert.deepEqual(calls, ["create@A", "get0@A", "save0@B", "get1@A", "save1@B", "complete@B", "delete@A", "consume@B"])
  calls.length = 0
  fake.failSave = true
  await assert.rejects(runTransfer(fake, "A", "B", plan(["/sitecore/content/S/P"]), approve, () => {}, () => "t2"), /disk full/)
  assert.ok(calls.includes("delete@A"), "the source transfer is removed even after a failure")
  assert.ok(!calls.includes("consume@B"), "nothing is imported after a failed copy")
})

test("import states", () => {
  assert.equal(importState({ state: "Processing" }), "running")
  assert.equal(importState({ state: "Transferred" }), "done")
  assert.equal(importState({ state: "TransferredWithErrors" }), "partial")
  assert.equal(importState({ state: "Error", error: "BlobNotFound" }), "done")
  assert.equal(importState({ state: "Error", error: "boom" }), "failed")
})
