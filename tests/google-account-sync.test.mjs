import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { applyAccountSyncRecord, GoogleAuthError, normalizeAccountSyncRecord, resolveGoogleIdentity } from '../backend/account-sync.js'
import worker from '../backend/index.js'

const makeAccountDb = () => {
  const records = new Map()
  const changes = new Map()
  const revisions = new Map()
  const sessions = new Map()
  const recordKey = (sub, key) => `${sub}\u0000${key}`
  const query = (sql, args) => ({
    async first() {
      if (sql.includes('FROM google_auth_sessions')) return sessions.get(args[0]) || null
      if (sql.includes('FROM account_sync_records')) {
        const value = records.get(recordKey(args[0], args[1]))
        return value ? {
          record_type: value.type,
          record_id: value.id,
          payload: value.payload,
          deleted: value.deleted,
          updated_at: value.updatedAt,
          source_device: value.sourceDevice,
        } : null
      }
      return null
    },
    async run() {
      if (sql.includes('INSERT INTO account_sync_state')) {
        if (!revisions.has(args[0])) revisions.set(args[0], 0)
      } else if (sql.includes('UPDATE account_sync_state SET revision = revision + 1')) {
        const [, sub, key, updatedAt, , sourceDevice] = args
        const current = records.get(recordKey(sub, key))
        const accepted = !current || current.updatedAt < updatedAt ||
          (current.updatedAt === updatedAt && current.sourceDevice < sourceDevice)
        if (accepted) revisions.set(sub, (revisions.get(sub) || 0) + 1)
        return { meta: { changes: accepted ? 1 : 0 } }
      } else if (sql.includes('INSERT INTO account_sync_records')) {
        const [sub, key, type, id, payload, deleted, updatedAt, sourceDevice, stateSub, guardSub] = args
        const current = records.get(recordKey(guardSub, args[10]))
        const accepted = !current || current.updatedAt < args[11] ||
          (current.updatedAt === args[11] && current.sourceDevice < args[13])
        if (!accepted || sub !== stateSub) return { meta: { changes: 0 } }
        const revision = revisions.get(sub)
        records.set(recordKey(sub, key), { sub, key, type, id, payload, deleted, updatedAt, sourceDevice, revision })
      } else if (sql.includes('INSERT INTO account_sync_changes')) {
        const [sub, key, type, id, payload, deleted, updatedAt, sourceDevice, stateSub, guardSub] = args
        const current = records.get(recordKey(guardSub, args[10]))
        const accepted = !current || current.updatedAt < args[11] ||
          (current.updatedAt === args[11] && current.sourceDevice < args[13])
        if (!accepted || sub !== stateSub) return { meta: { changes: 0 } }
        const revision = revisions.get(sub)
        const accountChanges = changes.get(sub) || []
        accountChanges.push({ user_sub: sub, revision, record_key: key, record_type: type, record_id: id, payload, deleted, updated_at: updatedAt, source_device: sourceDevice })
        changes.set(sub, accountChanges)
      }
      return { meta: { changes: 1 } }
    },
    async all() {
      if (sql.includes('FROM account_sync_records')) {
        return { results: [...records.values()].filter(row => row.sub === args[0] && row.type === 'category' && row.deleted === 0).map(row => ({ payload: row.payload })) }
      }
      if (sql.includes('FROM account_sync_changes')) {
        const [sub, cursor, limit] = args
        return { results: (changes.get(sub) || []).filter(change => change.revision > cursor).slice(0, limit) }
      }
      return { results: [] }
    },
  })
  let batchQueue = Promise.resolve()
  return {
    records,
    changes,
    revisions,
    sessions,
    prepare(sql) {
      let args = []
      return {
        bind(...values) { args = values; return this },
        first() { return query(sql, args).first() },
        run() { return query(sql, args).run() },
        all() { return query(sql, args).all() },
      }
    },
    async batch(statements) {
      const runBatch = async () => {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        return results
      }
      const next = batchQueue.then(runBatch, runBatch)
      batchQueue = next.then(() => undefined, () => undefined)
      return next
    },
  }
}

const originalFetch = globalThis.fetch
const db = makeAccountDb()
const migration = await readFile(new URL('../backend/migrations/0002-google-account-sync.sql', import.meta.url), 'utf8')
assert.match(migration, /CREATE TABLE IF NOT EXISTS account_sync_records/)
assert.match(migration, /PRIMARY KEY \(user_sub, record_key\)/)
assert.match(migration, /PRIMARY KEY \(user_sub, revision\)/)
assert.doesNotMatch(migration, /SELECT[\s\S]*(?:FROM\s+(?:sync_records|user_data|pending_tasks))/i)

const concurrentDb = makeAccountDb()
const toAccountRecord = (id, title, updatedAt, sourceDevice) => normalizeAccountSyncRecord({
  type: 'task', id, payload: { id, title }, updatedAt,
}, sourceDevice)
await Promise.all([
  applyAccountSyncRecord(concurrentDb, 'concurrent-sub', toAccountRecord('same', 'older tie-break', 200, 'device-a')),
  applyAccountSyncRecord(concurrentDb, 'concurrent-sub', toAccountRecord('same', 'winner', 200, 'device-z')),
  applyAccountSyncRecord(concurrentDb, 'concurrent-sub', toAccountRecord('other', 'independent', 201, 'device-b')),
])
const concurrentChanges = concurrentDb.changes.get('concurrent-sub') || []
const concurrentRevision = concurrentDb.records.size ? Math.max(...concurrentChanges.map(change => change.revision)) : 0
assert.deepEqual(concurrentChanges.map(change => change.revision), Array.from({ length: concurrentRevision }, (_, index) => index + 1))
assert.equal(concurrentDb.revisions.get('concurrent-sub'), concurrentRevision)
assert.equal(JSON.parse(concurrentDb.records.get('concurrent-sub\u0000task:same').payload).title, 'winner')
assert.equal(concurrentDb.records.size, 2)

const keyPair = await crypto.subtle.generateKey({
  name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
}, true, ['sign', 'verify'])
const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
publicKey.kid = 'test-google-key'
publicKey.alg = 'RS256'
const encode = value => Buffer.from(typeof value === 'string' ? value : new Uint8Array(value)).toString('base64url')
const makeIdToken = async (claims) => {
  const header = encode(JSON.stringify({ alg: 'RS256', kid: publicKey.kid, typ: 'JWT' }))
  const payload = encode(JSON.stringify(claims))
  const signed = `${header}.${payload}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(signed))
  return `${signed}.${encode(signature)}`
}
const now = Math.floor(Date.now() / 1000)
const fetchGoogleKeys = async () => new Response(JSON.stringify({ keys: [publicKey] }), {
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
})
const validIdToken = await makeIdToken({
  iss: 'https://accounts.google.com', aud: 'taskmaster-web-client',
  sub: 'verified-google-sub', iat: now, exp: now + 3600,
})
const verifiedIdentity = await resolveGoogleIdentity(validIdToken, { GOOGLE_WEB_CLIENT_ID: 'taskmaster-web-client' }, fetchGoogleKeys)
assert.equal(verifiedIdentity.sub, 'verified-google-sub')
const wrongAudienceToken = await makeIdToken({
  iss: 'https://accounts.google.com', aud: 'other-client',
  sub: 'verified-google-sub', iat: now, exp: now + 3600,
})
await assert.rejects(
  resolveGoogleIdentity(wrongAudienceToken, { GOOGLE_WEB_CLIENT_ID: 'taskmaster-web-client' }, fetchGoogleKeys),
  error => error instanceof GoogleAuthError && error.status === 401,
)
const extensionAudienceToken = await makeIdToken({
  iss: 'https://accounts.google.com', aud: 'taskmaster-extension-client',
  sub: 'verified-google-sub', iat: now, exp: now + 3600,
})
await assert.rejects(
  resolveGoogleIdentity(extensionAudienceToken, {
    GOOGLE_WEB_CLIENT_ID: 'taskmaster-web-client',
    GOOGLE_EXTENSION_CLIENT_ID: 'taskmaster-extension-client',
  }, fetchGoogleKeys),
  error => error instanceof GoogleAuthError && error.status === 401,
  'extension-audience tokens must not pass the mobile Web-client verifier',
)
const multiAudienceWithoutAzp = await makeIdToken({
  iss: 'https://accounts.google.com', aud: ['taskmaster-web-client', 'another-client'],
  sub: 'verified-google-sub', iat: now, exp: now + 3600,
})
await assert.rejects(
  resolveGoogleIdentity(multiAudienceWithoutAzp, { GOOGLE_WEB_CLIENT_ID: 'taskmaster-web-client' }, fetchGoogleKeys),
  error => error instanceof GoogleAuthError && error.status === 401,
  'a multi-audience ID token must include a matching azp',
)
const multiAudienceWithAzp = await makeIdToken({
  iss: 'https://accounts.google.com', aud: ['taskmaster-web-client', 'another-client'],
  azp: 'taskmaster-web-client', sub: 'verified-google-sub', iat: now, exp: now + 3600,
})
assert.equal((await resolveGoogleIdentity(multiAudienceWithAzp, {
  GOOGLE_WEB_CLIENT_ID: 'taskmaster-web-client',
}, fetchGoogleKeys)).sub, 'verified-google-sub')
await assert.rejects(
  resolveGoogleIdentity(validIdToken, {}, fetchGoogleKeys),
  error => error instanceof GoogleAuthError && error.status === 503,
  'ID-token sign-in must fail closed when GOOGLE_WEB_CLIENT_ID is not configured',
)

const configuredMobilePageResponse = await worker.fetch(new Request('https://taskmaster.test/'), {
  GOOGLE_WEB_CLIENT_ID: 'taskmaster-web-client',
})
assert.equal(configuredMobilePageResponse.status, 200)
assert.match(await configuredMobilePageResponse.text(), /const GOOGLE_WEB_CLIENT_ID = "taskmaster-web-client"/)
const unconfiguredMobilePageResponse = await worker.fetch(new Request('https://taskmaster.test/'), {})
assert.match(await unconfiguredMobilePageResponse.text(), /当前手机端还没有 Google 登录配置。/)

const hashToken = async token => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex')
const seedSession = async (token, sub, clientType) => db.sessions.set(await hashToken(token), {
  user_sub: sub, client_type: clientType, expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, revoked_at: null,
})
const accountAToken = 'account-a-session-token-for-tests-0001'
const accountBToken = 'account-b-session-token-for-tests-0002'
const mobileAToken = 'mobile-a-session-token-for-tests-0003'
await seedSession(accountAToken, 'google-sub-a', 'extension')
await seedSession(accountBToken, 'google-sub-b', 'extension')
await seedSession(mobileAToken, 'google-sub-a', 'mobile')

try {
  const sync = (token, body, clientType = 'extension') => worker.fetch(new Request('https://taskmaster.test/api/account/sync/incremental', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-TaskMaster-Client': clientType,
      Origin: clientType === 'extension' ? 'chrome-extension://gjifmpjgedleemhkikajgepickfphflo' : 'https://taskmaster.test',
    },
    body: JSON.stringify(body),
  }), { DB: db, API_TOKEN: 'legacy-admin-token' })

  const sameIdChange = (title, updatedAt) => ({
    type: 'task', id: 'same-local-id', payload: { id: 'same-local-id', title },
    updatedAt, deleted: false,
  })

  const aResponse = await sync(accountAToken, { deviceId: 'device-a', cursor: 0, changes: [sameIdChange('A task', 100)] })
  assert.equal(aResponse.status, 200)
  const aBody = await aResponse.json()
  assert.equal(aBody.changes.length, 1)
  assert.equal(aBody.changes[0].payload.title, 'A task')
  assert.equal(aBody.changes[0].sourceDevice, 'device-a')

  const bResponse = await sync(accountBToken, {
    userSub: 'google-sub-a', // must be ignored; only Google's verified token defines the account
    deviceId: 'device-b', cursor: 0, changes: [sameIdChange('B task', 200)],
  })
  assert.equal(bResponse.status, 200)
  const bBody = await bResponse.json()
  assert.equal(bBody.changes.length, 1)
  assert.equal(bBody.changes[0].payload.title, 'B task')
  assert.equal(bBody.cursor, 1)

  const aPull = await sync(accountAToken, { deviceId: 'device-a2', cursor: 0, changes: [] })
  assert.equal((await aPull.json()).changes[0].payload.title, 'A task')
  const bPull = await sync(accountBToken, { deviceId: 'device-b2', cursor: 0, changes: [] })
  assert.equal((await bPull.json()).changes[0].payload.title, 'B task')
  assert.equal(db.records.size, 2)

  const deleteA = await sync(accountAToken, {
    deviceId: 'device-a', cursor: 1,
    changes: [{ type: 'task', id: 'same-local-id', payload: null, updatedAt: 300, deleted: true }],
  })
  const deleteABody = await deleteA.json()
  assert.equal(deleteABody.changes.at(-1).deleted, true)
  const bStillExists = await sync(accountBToken, { deviceId: 'device-b3', cursor: 0, changes: [] })
  assert.equal((await bStillExists.json()).changes[0].payload.title, 'B task')
  assert.equal(db.records.size, 2)

  const mobileTaskResponse = await worker.fetch(new Request('https://taskmaster.test/api/account/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mobileAToken}`,
      'Content-Type': 'application/json',
      'X-TaskMaster-Client': 'mobile',
      Origin: 'https://taskmaster.test',
    },
    body: JSON.stringify({
      title: 'Phone task', category: 'default-life', priority: 'high', duration: 45,
      dueDate: '', noTimeLimit: true, completed: true, deviceId: 'mobile-device',
    }),
  }), { DB: db })
  assert.equal(mobileTaskResponse.status, 201)
  const mobileTask = (await mobileTaskResponse.json()).task
  assert.equal(mobileTask.noTimeLimit, true)
  assert.equal(mobileTask.completed, true)
  assert.equal(mobileTask.completedAt, mobileTask.updatedAt)
  assert.ok([...db.records.values()].some(record => record.sub === 'google-sub-a' && record.id === mobileTask.id))
  assert.equal(db.records.size, 3)

  const fakeIdentity = await sync('invalid', { deviceId: 'attacker', cursor: 0, changes: [sameIdChange('forged', 999)] })
  assert.equal(fakeIdentity.status, 401)
  assert.equal(db.records.size, 3)

  const rawGoogleAccessTokenOnAccountRoute = await sync('google-access-token-from-old-flow', { deviceId: 'attacker', cursor: 0, changes: [] })
  assert.equal(rawGoogleAccessTokenOnAccountRoute.status, 401)
  const rawGoogleIdTokenOnAccountRoute = await sync(validIdToken, { deviceId: 'attacker', cursor: 0, changes: [] })
  assert.equal(rawGoogleIdTokenOnAccountRoute.status, 401)

  const legacyTokenOnAccountRoute = await sync('legacy-admin-token', { deviceId: 'legacy', cursor: 0, changes: [] })
  assert.equal(legacyTokenOnAccountRoute.status, 401)

  const mobilePage = await worker.fetch(new Request('https://taskmaster.test/'), {})
  assert.equal(mobilePage.status, 200)
  const mobileHtml = await mobilePage.text()
  assert.match(mobileHtml, /尚未配置|尚未配置|未配置/)
  assert.doesNotMatch(mobileHtml, /API_TOKEN|id="apiToken"|your-worker\.workers\.dev/)
  assert.match(mobileHtml, /id="noTimeLimit"/)
  assert.match(mobileHtml, /id="completed"/)
  const legacyPage = await worker.fetch(new Request('https://taskmaster.test/legacy'), {})
  assert.match(await legacyPage.text(), /id="apiToken"/)

  console.log('Google account authentication and isolation tests passed')
} finally {
  globalThis.fetch = originalFetch
}
