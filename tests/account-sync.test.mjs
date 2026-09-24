import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import worker from '../backend/index.js'

globalThis.crypto ||= webcrypto

const toBase64Url = value => Buffer.from(value).toString('base64url')
const keyPair = await crypto.subtle.generateKey({
  name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
}, true, ['sign', 'verify'])
const publicJwk = { ...await crypto.subtle.exportKey('jwk', keyPair.publicKey), kid: 'test-google-key', alg: 'RS256', use: 'sig' }

const createIdToken = async ({ sub, nonce, aud = 'test-client', emailVerified = true }) => {
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', kid: publicJwk.kid, typ: 'JWT' }))
  const claims = toBase64Url(JSON.stringify({
    iss: 'https://accounts.google.com', aud, azp: aud, sub,
    email: `${sub}@example.test`, email_verified: emailVerified,
    name: `User ${sub}`, iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300, nonce
  }))
  const signingInput = `${header}.${claims}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(signingInput))
  return `${signingInput}.${toBase64Url(signature)}`
}

class FakeD1 {
  sessions = new Map()
  accountRecords = new Map()
  accountChanges = []

  prepare(sql) {
    let args = []
    const db = this
    return {
      bind(...values) { args = values; return this },
      async first() {
        if (sql.includes('FROM account_sessions') && sql.includes('session_hash = ?')) {
          const [hash, now] = args
          const session = db.sessions.get(hash)
          return session && !session.revoked_at && session.expires_at > now
            ? { user_sub: session.user_sub, email: session.email, expires_at: session.expires_at }
            : null
        }
        if (sql.includes('FROM account_legacy_claims')) return null
        if (sql.includes('COALESCE(MAX(revision), 0)')) {
          const userSub = args[0]
          return { cursor: Math.max(0, ...db.accountChanges.filter(row => row.user_sub === userSub).map(row => row.revision)) }
        }
        if (sql.includes('FROM account_sync_records') && sql.includes('record_key = ?')) {
          return db.accountRecords.get(`${args[0]}:${args[1]}`) || null
        }
        return null
      },
      async run() {
        if (sql.includes('INSERT INTO account_sessions')) {
          const [session_hash, user_sub, email, created_at, expires_at] = args
          db.sessions.set(session_hash, { session_hash, user_sub, email, created_at, expires_at, revoked_at: null })
          return { meta: {} }
        }
        if (sql.includes('DELETE FROM account_sessions')) return { meta: {} }
        if (sql.includes('UPDATE account_sessions SET revoked_at')) {
          const [revoked_at, hash] = args
          const row = db.sessions.get(hash)
          if (row) row.revoked_at = revoked_at
          return { meta: {} }
        }
        if (sql.includes('INSERT INTO account_sync_changes')) {
          const [user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device] = args
          const revision = db.accountChanges.length + 1
          db.accountChanges.push({ user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision })
          return { meta: { last_row_id: revision } }
        }
        if (sql.includes('INSERT INTO account_sync_records')) {
          const [user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision] = args
          db.accountRecords.set(`${user_sub}:${record_key}`, { user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision })
          return { meta: {} }
        }
        return { meta: {} }
      },
      async all() {
        if (sql.includes('FROM account_sync_records')) {
          const userSub = args[0]
          return { results: [...db.accountRecords.values()].filter(row => row.user_sub === userSub && (!sql.includes("record_type = 'task'") || (row.record_type === 'task' && row.deleted === 0))) }
        }
        if (sql.includes('FROM account_sync_changes')) {
          const [userSub, cursor, limit] = args
          return { results: db.accountChanges.filter(row => row.user_sub === userSub && row.revision > cursor).sort((a, b) => a.revision - b.revision).slice(0, limit) }
        }
        if (sql.includes('FROM pending_tasks')) return { results: [] }
        return { results: [] }
      }
    }
  }
}

const db = new FakeD1()
const env = {
  DB: db,
  API_TOKEN: 'legacy-global-token',
  GOOGLE_CLIENT_ID: 'test-client',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_EXTENSION_REDIRECT_URI: 'https://extension.chromiumapp.org/'
}
const originalFetch = globalThis.fetch
let nextIdToken = ''
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  if (url === 'https://www.googleapis.com/oauth2/v3/certs') {
    return new Response(JSON.stringify({ keys: [publicJwk] }), { headers: { 'Cache-Control': 'max-age=300' } })
  }
  if (url === 'https://oauth2.googleapis.com/token') {
    const body = new URLSearchParams(init.body)
    assert.equal(body.get('client_id'), env.GOOGLE_CLIENT_ID)
    assert.equal(body.get('redirect_uri'), env.GOOGLE_EXTENSION_REDIRECT_URI)
    return new Response(JSON.stringify({ id_token: nextIdToken }), { headers: { 'Content-Type': 'application/json' } })
  }
  return originalFetch(input, init)
}

const login = async (sub, nonce, options = {}) => {
  nextIdToken = await createIdToken({ sub, nonce, ...options })
  const response = await worker.fetch(new Request('https://taskmaster.test/api/auth/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'test-code', codeVerifier: 'v'.repeat(43), redirectUri: env.GOOGLE_EXTENSION_REDIRECT_URI, nonce })
  }), env)
  return { response, body: await response.json() }
}

try {
  const configResponse = await worker.fetch(new Request('https://taskmaster.test/api/auth/config'), env)
  assert.equal(configResponse.status, 200)
  assert.equal((await configResponse.json()).clientId, env.GOOGLE_CLIENT_ID)

  const userA = await login('google-user-a', 'nonce-for-user-a-0123456789')
  assert.equal(userA.response.status, 200)
  assert.equal(userA.body.session.user.sub, 'google-user-a')
  assert.equal(typeof userA.body.session.token, 'string')

  const task = {
    id: 'private-task-a', title: 'A-only task', description: '', priority: 'high',
    category: 'default-work', dueDate: '2026-09-24', duration: 60,
    repeatType: 'none', repeatDays: [], repeatInterval: 1, completed: false,
    completedDates: [], createdAt: Date.now(), updatedAt: Date.now(), noTimeLimit: false
  }
  const syncA = await worker.fetch(new Request('https://taskmaster.test/api/account/sync/incremental', {
    method: 'POST', headers: { Authorization: `Bearer ${userA.body.session.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'device-a', cursor: 0, userSub: 'forged-user-b',
      changes: [{ type: 'task', id: task.id, payload: task, updatedAt: task.updatedAt, deleted: false }]
    })
  }), env)
  assert.equal(syncA.status, 200)

  const userB = await login('google-user-b', 'nonce-for-user-b-0123456789')
  assert.equal(userB.response.status, 200)
  const tasksB = await worker.fetch(new Request('https://taskmaster.test/api/account/tasks', {
    headers: { Authorization: `Bearer ${userB.body.session.token}` }
  }), env)
  assert.deepEqual((await tasksB.json()).tasks, [])

  const tasksA = await worker.fetch(new Request('https://taskmaster.test/api/account/tasks', {
    headers: { Authorization: `Bearer ${userA.body.session.token}` }
  }), env)
  assert.equal((await tasksA.json()).tasks[0].id, task.id)
  assert.equal(db.accountRecords.has(`google-user-b:task:${task.id}`), false, 'client-sub spoofing must not change account ownership')

  const legacyRead = await worker.fetch(new Request('https://taskmaster.test/api/tasks', {
    headers: { Authorization: 'Bearer legacy-global-token' }
  }), env)
  assert.deepEqual((await legacyRead.json()).tasks, [], 'legacy global APIs must not expose account records')

  const legacyCredentialOnAccountRoute = await worker.fetch(new Request('https://taskmaster.test/api/account/snapshot', {
    headers: { Authorization: 'Bearer legacy-global-token' }
  }), env)
  assert.equal(legacyCredentialOnAccountRoute.status, 401, 'legacy API_TOKEN is not a Google account credential')

  nextIdToken = await createIdToken({ sub: 'google-user-spoof', nonce: 'nonce-for-spoof-0123456789', aud: 'attacker-client' })
  const spoofedIdentity = await worker.fetch(new Request('https://taskmaster.test/api/auth/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'test-code', codeVerifier: 'v'.repeat(43), redirectUri: env.GOOGLE_EXTENSION_REDIRECT_URI, nonce: 'nonce-for-spoof-0123456789' })
  }), env)
  assert.equal(spoofedIdentity.status, 401, 'a signed token with an untrusted audience must be rejected')

  const mobilePage = await worker.fetch(new Request('https://taskmaster.test/'), env)
  const mobileHtml = await mobilePage.text()
  assert.match(mobileHtml, /googleSignInButton/)
  assert.match(mobileHtml, /\/api\/account\/tasks/)
  assert.doesNotMatch(mobileHtml, /id="apiToken"/, 'the mobile page must not ask end users for the global API token')

  const disabledLegacy = await worker.fetch(new Request('https://taskmaster.test/api/tasks'), { ...env, LEGACY_API_DISABLED: 'true' })
  assert.equal(disabledLegacy.status, 410)
} finally {
  globalThis.fetch = originalFetch
}

console.log('Google account-isolated sync tests passed')
