/* eslint-disable @typescript-eslint/no-require-imports -- tests use compiled Node output */
const test = require('node:test')
const assert = require('node:assert/strict')
const api = require('../dist-worker/src/lib/sitecore/public-transfer.js')
const browser = require('../dist-worker/src/lib/browser-session.js')
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
const connections = {
  source: { baseUrl: 'https://test-source.sitecorecloud.io', accessToken: 'source-user-token' },
  destination: { baseUrl: 'https://test-target.sitecorecloud.io', accessToken: 'target-user-token' },
}
async function withFetch(mock, run) {
  const original = global.fetch
  global.fetch = mock
  try { await run() } finally { global.fetch = original; browser.setConnection(null) }
}

test('public requests require user-owned tokens and reject arbitrary origins', () => {
  process.env.SITECORE_SOURCE_CLIENT_SECRET = 'owner-secret-must-not-be-used'
  assert.throws(() => api.parseConnections({ source: { baseUrl: connections.source.baseUrl }, destination: connections.destination }))
  for (const host of ['http://localhost','https://127.0.0.1','https://evil.example','https://good.sitecorecloud.io.evil.example','https://good.sitecorecloud.io@evil.example','https://good.sitecorecloud.io/path']) {
    assert.throws(() => api.configFor({ baseUrl: host, accessToken: 'some-visitor-token' }))
  }
  assert.deepEqual(api.parseConnections(connections), connections)
  delete process.env.SITECORE_SOURCE_CLIENT_SECRET
})

test('plans block tree deletion, unsafe paths, and overlapping descendants', () => {
  const plan = { itemPaths: ['/sitecore/content/Home'], scope: 'ItemAndDescendants', mergeStrategy: 'KeepExistingItem' }
  assert.deepEqual(api.parsePlan(plan), plan)
  assert.throws(() => api.parsePlan({ ...plan, mergeStrategy: 'OverrideExistingTree' }))
  assert.throws(() => api.parsePlan({ ...plan, itemPaths: ['/sitecore/content/Home','/sitecore/content/Home/Child'] }))
  assert.throws(() => api.parsePlan({ ...plan, itemPaths: ['/sitecore/content/../system'] }))
})

test('history uses Sitecore paging and HistoryResult.Sources, without a database', async () => {
  const paths = []
  await withFetch(async (url, init) => {
    paths.push(String(url))
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer target-user-token')
    return String(url).includes('/history?') ? json({ Sources: [{ Name: 'consumed.id', SourceName: 'one.raif', Events: [] }], TotalCount: 120 }) : json({ Transfers: [], TotalCount: 80 })
  }, async () => {
    const result = await api.listNativeTransfers(connections, 2)
    assert.equal(result.history[0].Name, 'consumed.id')
    assert.equal(result.totalCount, 120)
    assert.ok(paths.every(path => path.includes('page=2&pageSize=50')))
  })
})

test('history failures are errors rather than fabricated empty success', async () => {
  await withFetch(async () => new Response('', { status: 403 }), async () => {
    await assert.rejects(api.listNativeTransfers(connections, 1), /HTTP 403/)
  })
})

test('history adapter preserves native events and marks unknown counts unavailable', () => {
  browser.setConnection(connections)
  const job = browser.nativeJob(undefined, { Name: 'consumed.2026.id', SourceName: 'real.raif', Events: [{ Name: 'InProgress', Date: '2026-11-12T12:00:00Z' }, { Name: 'Finished', Date: '2026-11-12T12:01:00Z' }] })
  assert.equal(job.status, 'success')
  assert.equal(job.itemCount, undefined)
  assert.equal(job.progressKnown, false)
  assert.equal(job.source, null)
  assert.equal(job.createdAt, '')
  assert.equal(job.history.length, 2)
  assert.equal(job.updatedAt, '2026-11-12T12:01:00Z')
  assert.equal(browser.nativeJob({ Id: 'a', SourceName: 'a.raif', TransferState: 'Finished', ValidationErrors: ['Partial import'] }).status, 'error')
  browser.setConnection(null)
})

test('connect always exchanges credentials and does not reuse another visitor token', async () => {
  let exchanges = 0
  await withFetch(async (url, init) => {
    if (String(url).includes('/oauth/token')) {
      exchanges++
      const body = new URLSearchParams(init.body)
      if (body.get('client_secret') !== 'correct') return new Response('', { status: 401 })
      return json({ access_token: 'only-this-users-token', expires_in: 3600 })
    }
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer only-this-users-token')
    return json({ Transfers: [] })
  }, async () => {
    const first = await api.connectEnvironment({ host: connections.source.baseUrl, clientId: 'same-id', clientSecret: 'correct' })
    assert.equal(first.accessToken, 'only-this-users-token')
    await assert.rejects(api.connectEnvironment({ host: connections.source.baseUrl, clientId: 'same-id', clientSecret: 'wrong' }), /HTTP 401/)
    assert.equal(exchanges, 2)
  })
})

test('binary forwarding preserves bytes and false media flag', async () => {
  const bytes = new Uint8Array([0,255,1,2,13,10,128])
  const id = '11111111-1111-4111-8111-111111111111'
  await withFetch(async (url, init) => {
    if (init.method !== 'PUT') return new Response(bytes, { headers: { 'Content-Disposition': 'attachment; IsMedia=false' } })
    assert.ok(String(url).endsWith('?isMedia=false'))
    assert.deepEqual(new Uint8Array(await new Response(init.body).arrayBuffer()), bytes)
    return new Response(null, { status: 201 })
  }, async () => { assert.deepEqual(await api.performStep(connections, 'copyChunk', { operationId:id, chunkSetId:id, chunk:0 }), { copied:true }) })
})

test('an import uses native non-UUID identifiers from Sitecore responses', async () => {
  await withFetch(async url => {
    const path = String(url)
    if (path.includes('/transfers?page=')) return json({ Transfers:[{ Id:'consumed.20261112 120000.real-id', SourceName:'real.raif', TransferState:'InProgress' }], TotalCount:1 })
    assert.ok(path.endsWith('/transfers/consumed.20261112%20120000.real-id'))
    return json({ Id:'consumed.20261112 120000.real-id', SourceName:'real.raif', TransferState:'Finished', ValidationErrors:[] })
  }, async () => {
    const state = await api.performStep(connections, 'importStatus', { file:'real.raif' })
    assert.equal(state.TransferState, 'Finished')
  })
})

test('destination writes cannot start without explicit approval', async () => {
  let called = false
  await withFetch(async () => { called = true; throw new Error('unexpected network') }, async () => {
    await assert.rejects(api.performStep(connections, 'start', { plan:{ itemPaths:['/sitecore/content/Home'], scope:'SingleItem', mergeStrategy:'KeepExistingItem' }, approved:false }), /approve/)
    assert.equal(called, false)
  })
})

test('connection changes clear drafts and reject stale prior-user responses', async () => {
  browser.setConnection(connections)
  browser.createDraft({ name:'Private draft', itemPaths:['/sitecore/content/Home'], scope:'SingleItem', mergeStrategy:'KeepExistingItem' })
  let release
  await withFetch(() => new Promise(resolve => { release = resolve }), async () => {
    const pending = browser.sitecoreAction('history')
    browser.setConnection({ ...connections, destination:{ ...connections.destination, accessToken:'different-users-token' } })
    release(json({ data:{ current:[], history:[], totalCount:0 } }))
    await assert.rejects(pending, /connection changed/)
    browser.setConnection(null)
    assert.equal((await browser.loadJobs()).jobs.length, 0)
  })
})

test('signed-in environment discovery is paginated and strips context IDs and secrets', async () => {
  await withFetch(async (url, init) => {
    assert.equal(String(url), 'https://xmclouddeploy-api.sitecorecloud.io/api/environments/v1?PageNumber=2&PageSize=50')
    assert.equal(init.headers.Authorization, 'Bearer visitor-login-token')
    return json({ totalCount:70, data:[{ id:'one', name:'Staging', projectName:'Project', host:'test-target.sitecorecloud.io', previewContextId:'private-context', clientSecret:'must-not-return' }, { id:'deleted', host:'gone.sitecorecloud.io', isDeleted:true }] })
  }, async () => {
    const data = await api.discoverEnvironments('visitor-login-token', 2)
    assert.equal(data.page, 2)
    assert.equal(data.environments.length, 1)
    assert.equal(JSON.stringify(data).includes('private-context'), false)
    assert.equal(JSON.stringify(data).includes('must-not-return'), false)
  })
})

test('interactive sign-in cannot bypass a denied native transfer permission', async () => {
  await withFetch(async url => {
    if (String(url).includes('xmclouddeploy-api')) return json({ id:'authorized-env', host:String(url).endsWith('/source') ? 'test-source.sitecorecloud.io' : 'test-target.sitecorecloud.io' })
    return new Response('', {status:403})
  }, async () => {
    await assert.rejects(api.connectSignedInEnvironments('visitor-login-token','source','target'), /HTTP 403/)
  })
})

test('interactive requests refresh their own token without replacing environments or drafts', async () => {
  browser.setConnection(connections, async () => 'refreshed-user-token')
  await withFetch(async (_url, init) => {
    const body = JSON.parse(init.body)
    assert.equal(body.connections.source.accessToken, 'refreshed-user-token')
    assert.equal(body.connections.destination.accessToken, 'refreshed-user-token')
    assert.equal(body.connections.destination.baseUrl, connections.destination.baseUrl)
    return json({data:{current:[],history:[],totalCount:0}})
  }, async () => { await browser.sitecoreAction('history') })
})
