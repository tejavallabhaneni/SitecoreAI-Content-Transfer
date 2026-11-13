import test from "node:test"
import assert from "node:assert/strict"
import { fromSitecore, toStatus } from "../src/lib/sitecore/history-core.ts"

test("SitecoreAI status mapping never invents publishing", () => {
  assert.equal(toStatus("Finished"), "success")
  assert.equal(toStatus("InProgress"), "running")
  assert.equal(toStatus("Queued"), "queued")
  assert.equal(toStatus("Unknown"), "unknown")
  assert.equal(toStatus("Failed"), "error")
})

test("history shows source package and native transition timeline", () => {
  const jobs = fromSitecore([], [{
    Name: "consumed.example", SourceName: "content-transfer-example.raif",
    ConsumeDate: "2026-11-10T12:00:00Z", Strategy: "KeepExistingItem",
    Events: [
      { Name: "Finished", Date: "2026-11-10T12:03:00Z" },
      { Name: "InProgress", Date: "2026-11-10T12:01:00Z" },
    ],
  }], "destination.sitecorecloud.io")
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceName, "content-transfer-example.raif")
  assert.equal(jobs[0].status, "success")
  assert.equal(jobs[0].historyEvents[0].name, "InProgress")
})

test("live status supersedes retained history with same transfer ID", () => {
  const jobs = fromSitecore([{
    Id: "consumed.example", SourceName: "content-transfer-example.raif",
    TransferState: "Failed", ConsumedDate: "2026-11-10T12:00:00Z",
    ValidationErrors: ["Validation failed"],
  }], [{
    Name: "consumed.example", SourceName: "content-transfer-example.raif",
    ConsumeDate: "2026-11-10T11:59:00Z",
  }], "destination.sitecorecloud.io")
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].status, "error")
  assert.equal(jobs[0].error, "Validation failed")
})

test("malformed records are skipped", () => {
  assert.deepEqual(fromSitecore([{ SourceName: "missing-id.raif" }], [
    { Name: "unknown" },
  ], "destination.sitecorecloud.io"), [])
})
