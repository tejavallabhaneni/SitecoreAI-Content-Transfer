import test from "node:test"
import assert from "node:assert/strict"
import { parseTransferInput } from "../src/lib/transfers/validation.ts"
import { readLimitedJson } from "../src/lib/transfers/read-json.ts"

test("valid native transfer draft", () => {
  assert.deepEqual(parseTransferInput({
    itemPath: "/sitecore/content/Home",
    scope: "SingleItem",
    mergeStrategy: "KeepExistingItem",
  }), {
    itemPath: "/sitecore/content/Home",
    scope: "SingleItem",
    mergeStrategy: "KeepExistingItem",
  })
})

for (const path of [
  "/etc/passwd", "/sitecore/content/../system", 
  "/sitecore/content/Home?x", "/sitecore/content/Home#x",
  "/sitecore/content/Home\\secret", "/sitecore/content/",
]) {
  test(`rejects unsafe item path: ${path}`, () => {
    // Sitecore/content/ is a scope root, not an individual content item.
    assert.throws(() => parseTransferInput({
      itemPath: path, scope: "SingleItem", mergeStrategy: "KeepExistingItem",
    }), /Invalid Sitecore item path/)
  })
}

test("destructive tree override is not accepted", () => {
  assert.throws(() => parseTransferInput({
    itemPath: "/sitecore/content/Home",
    scope: "ItemAndDescendants",
    mergeStrategy: "OverrideExistingTree",
  }), /non-destructive/)
})

test("request body size is bounded without content-length", async () => {
  const request = new Request("https://example.com/", {
    method: "POST",
    body: JSON.stringify({ text: "x".repeat(20_000) }),
  })
  await assert.rejects(() => readLimitedJson(request), /Request too large/)
})

test("request body accepts bounded JSON", async () => {
  const request = new Request("https://example.com/", {
    method: "POST",
    body: JSON.stringify({ itemPath: "/sitecore/content/Home" }),
  })
  assert.deepEqual(await readLimitedJson(request), { itemPath: "/sitecore/content/Home" })
})
