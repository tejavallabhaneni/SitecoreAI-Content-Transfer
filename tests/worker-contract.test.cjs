const test = require("node:test")
const assert = require("node:assert/strict")
const { verifyPreflight } = require("../dist-worker/src/lib/sitecore/preflight.js")
const { executeNativeTransfer } = require("../dist-worker/src/lib/sitecore/native-transfer.js")

const source = {
  baseUrl: "https://source-example.sitecorecloud.io",
  clientId: "source-test",
  clientSecret: "test",
}
const destination = {
  baseUrl: "https://destination-example.sitecorecloud.io",
  clientId: "destination-test",
  clientSecret: "test",
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

function mockGraphql(mismatch = false) {
  return async (url, init) => {
    const href = String(url)
    if (href.includes("auth.sitecorecloud.io/oauth/token")) {
      return json({ access_token: "mock-token", expires_in: 3600 })
    }
    if (!href.endsWith("/sitecore/api/authoring/graphql/v1/")) {
      throw new Error("Unexpected URL " + href)
    }
    const query = JSON.parse(init.body).query
    const match = query.match(/path:\s*("(?:\\.|[^"\\])*")/)
    assert.ok(match, "GraphQL item lookup must include a path")
    const path = JSON.parse(match[1])
    const ids = {
      "/sitecore/content": "11111111-1111-1111-1111-111111111111",
      "/sitecore/content/Home": "22222222-2222-2222-2222-222222222222",
      "/sitecore/content/Home/Article": "33333333-3333-3333-3333-333333333333",
    }
    const id = ids[path]
    if (!id) return json({ data: { item: null } })
    const isTarget = href.includes("destination-example.sitecorecloud.io")
    return json({
      data: {
        item: {
          itemId: mismatch && isTarget && path === "/sitecore/content/Home"
            ? "44444444-4444-4444-4444-444444444444" : id,
          path,
        },
      },
    })
  }
}

test("preflight verifies source and destination parent IDs", async () => {
  const original = global.fetch
  global.fetch = mockGraphql()
  try {
    const result = await verifyPreflight(source, destination, {
      item_path: "/sitecore/content/Home/Article",
    })
    assert.equal(result.ready, true)
    assert.equal(result.parentChecks.length, 2)
    assert.equal(result.sourceItem.itemId, result.targetItem.itemId)
  } finally {
    global.fetch = original
  }
})

test("preflight blocks mismatched parent IDs", async () => {
  const original = global.fetch
  global.fetch = mockGraphql(true)
  try {
    await assert.rejects(
      () => verifyPreflight(source, destination, {
        item_path: "/sitecore/content/Home/Article",
      }),
      /Parent item ID mismatch/,
    )
  } finally {
    global.fetch = original
  }
})

function mockTransfer(missingLocation = false) {
  const calls = []
  return {
    calls,
    fetch: async (url, init = {}) => {
      const href = String(url)
      const method = init.method ?? "GET"
      calls.push({ href, method })
      if (href.includes("auth.sitecorecloud.io/oauth/token")) {
        return json({ access_token: "mock-token", expires_in: 3600 })
      }
      if (method === "POST" &&
          href.endsWith("/sitecore/api/content/transfer/v1/transfers")) {
        const body = JSON.parse(init.body)
        assert.equal(body.Configuration.Database, "master")
        return new Response(null, { status: 202 })
      }
      if (method === "GET" && href.endsWith("/status")) {
        return json({
          State: "Completed",
          ChunkSetsMetadata: [{
            ChunkSetId: "12345678-1234-1234-1234-123456789abc",
            ChunkCount: 1,
          }],
        })
      }
      if (method === "GET" && href.includes("/chunks/0")) {
        return new Response(Buffer.from("binary-content"), {
          headers: { "Content-Disposition": "attachment; IsMedia=true" },
        })
      }
      if (method === "PUT" && href.includes("/chunks/0?isMedia=true")) {
        assert.equal(init.headers.get("Content-Type"), "application/octet-stream")
        const bytes = Buffer.from(await new Response(init.body).arrayBuffer())
        assert.equal(bytes.toString(), "binary-content")
        return new Response(null, { status: 201 })
      }
      if (method === "POST" && href.endsWith("/complete")) {
        return json({ ContentTransferFileName: "example.raif" })
      }
      if (method === "GET" && href.endsWith("/sources/blobs/example.raif")) {
        return json({ BlobState: "Uploaded" })
      }
      if (method === "POST" && href.includes("/transfers/databases/master/sources?blobName=")) {
        return new Response(null, {
          status: 201,
          headers: missingLocation ? {} : {
            Location: "/sitecore/shell/api/v3/ItemsTransfer/transfers/55555555-5555-5555-5555-555555555555",
          },
        })
      }
      if (method === "GET" && href.endsWith("/transfers/55555555-5555-5555-5555-555555555555")) {
        return json({ TransferState: "Finished", ValidationErrors: [] })
      }
      throw new Error("Unexpected mocked transfer request " + method + " " + href)
    },
  }
}

test("native transfer streams unmodified bytes and verifies exact import ID", async () => {
  const original = global.fetch
  const mock = mockTransfer()
  const updates = []
  global.fetch = mock.fetch
  try {
    const result = await executeNativeTransfer(source, destination, {
      preflightApproved: true,
      trees: [{
        ItemPath: "/sitecore/content/Home",
        Scope: "SingleItem",
        MergeStrategy: "KeepExistingItem",
      }],
    }, { onProgress: async progress => updates.push(progress.stage) })
    assert.equal(result.completedChunks, 1)
    assert.deepEqual(result.files, ["example.raif"])
    assert.equal(updates.at(-1), "done")
    assert.ok(mock.calls.some(call => call.href.endsWith("/transfers/55555555-5555-5555-5555-555555555555")))
  } finally {
    global.fetch = original
  }
})

test("missing import Location cannot be reported as success", async () => {
  const original = global.fetch
  global.fetch = mockTransfer(true).fetch
  try {
    await assert.rejects(() => executeNativeTransfer(source, destination, {
      preflightApproved: true,
      trees: [{
        ItemPath: "/sitecore/content/Home",
        Scope: "SingleItem",
        MergeStrategy: "KeepExistingItem",
      }],
    }), /Location header/)
  } finally {
    global.fetch = original
  }
})

test("native transfer blocks destructive merge by default", async () => {
  await assert.rejects(() => executeNativeTransfer(source, destination, {
    preflightApproved: true,
    trees: [{
      ItemPath: "/sitecore/content/Home",
      Scope: "ItemAndDescendants",
      MergeStrategy: "OverrideExistingTree",
    }],
  }), /separate confirmation/)
})
