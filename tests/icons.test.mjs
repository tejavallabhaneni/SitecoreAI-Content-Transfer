import test from "node:test"
import assert from "node:assert/strict"
import { iconSources } from "../src/lib/marketplace.ts"

const CM = "https://xmc-sample-cm.sitecorecloud.io"

test("themed icons try the CM icon cache first, then /-/icon, at 16x16", () => {
  assert.deepEqual(iconSources("/-/icon/Office/32x32/document.png", CM), [
    `${CM}/temp/iconcache/office/16x16/document.png`,
    `${CM}/-/icon/Office/16x16/document.png`,
  ])
})

test("a bare themed path resolves against the learned host", () => {
  assert.deepEqual(iconSources("Applications/16x16/folder.png", CM), [
    `${CM}/temp/iconcache/applications/16x16/folder.png`,
    `${CM}/-/icon/Applications/16x16/folder.png`,
  ])
})

test("media thumbnails are unwrapped to the form that needs no sign-in", () => {
  assert.deepEqual(iconSources("/-/icon/-/media/abc123.ashx?thn=1&h=16&w=16", CM), [`${CM}/-/media/abc123.ashx?thn=1&h=16&w=16`])
})

test("absolute icon URLs keep their own host", () => {
  const sources = iconSources("https://other-cm.sitecorecloud.io/-/icon/Office/24x24/box.png", "")
  assert.equal(sources.at(-1), "https://other-cm.sitecorecloud.io/-/icon/Office/16x16/box.png")
  assert.equal(sources[0], "https://other-cm.sitecorecloud.io/temp/iconcache/office/16x16/box.png")
})

test("without a host or an icon there is nothing to try", () => {
  assert.deepEqual(iconSources("/-/icon/Office/16x16/document.png", ""), [])
  assert.deepEqual(iconSources("", CM), [])
})
