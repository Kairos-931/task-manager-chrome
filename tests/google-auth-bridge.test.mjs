import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import worker from '../backend/index.js'
import {
  GOOGLE_EXTENSION_CALLBACK_URI,
  GOOGLE_EXTENSION_ORIGIN,
  GOOGLE_WORKER_CALLBACK_URI,
  getTaskmasterSessionFromRequest,
  readGoogleExtensionAuthPending,
} from '../backend/google-auth.js'

const GOOGLE_CLIENT_ID = 'taskmaster-web-client'
const GOOGLE_CLIENT_SECRET = 'only-in-worker-secret'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

const makeAuthDb = () => {
  const flows = new Map()
  const codes = new Map()
  const sessions = new Map()
  const records = new Map()
  const changes = new Map()
  const statusChanges = (count) => ({ meta: { changes: count } })

  const execute = async (sql, args) => {
    if (sql.startsWith('DELETE FROM google_auth_flows')) {
      let count = 0
      for (const [key, row] of flows) if (row.expires_at <= args[0]) { flows.delete(key); count++ }
      return statusChanges(count)
    }
    if (sql.startsWith('DELETE FROM google_auth_codes')) {
      let count = 0
      for (const [key, row] of codes) {
        if (row.expires_at <= args[0] || row.consumed_id !== null) { codes.delete(key); count++ }
      }
      return statusChanges(count)
    }
    if (sql.startsWith('DELETE FROM google_auth_sessions')) {
      let count = 0
      for (const [key, row] of sessions) {
        if (row.expires_at <= args[0] || (row.revoked_at !== null && row.revoked_at <= args[1])) {
          sessions.delete(key)
          count++
        }
      }
      return statusChanges(count)
    }
    if (sql.includes('INSERT INTO google_auth_flows')) {
      const [stateHash, nonce, clientType, codeChallenge, createdAt, expiresAt] = args
      flows.set(stateHash, { state_hash: stateHash, nonce, client_type: clientType, code_challenge: codeChallenge, created_at: createdAt, expires_at: expiresAt, status: 'started', consumed_id: null })
      return statusChanges(1)
    }
    if (sql.includes("UPDATE google_auth_flows SET status = 'processing'")) {
      const [stateHash, now] = args
      const row = flows.get(stateHash)
      if (!row || row.client_type !== 'extension' || row.status !== 'started' || row.expires_at <= now) return statusChanges(0)
      row.status = 'processing'
      return statusChanges(1)
    }
    if (sql.includes("UPDATE google_auth_flows SET status = 'failed'")) {
      const row = flows.get(args[0])
      if (!row || row.status !== 'processing') return statusChanges(0)
      row.status = 'failed'
      return statusChanges(1)
    }
    if (sql.includes("UPDATE google_auth_flows SET status = 'completed'")) {
      const [stateHash, now] = args
      const row = flows.get(stateHash)
      if (!row || row.client_type !== 'extension' || row.status !== 'processing' || row.expires_at <= now) return statusChanges(0)
      row.status = 'completed'
      return statusChanges(1)
    }
    if (sql.includes("UPDATE google_auth_flows SET status = 'consumed'")) {
      const [consumedId, stateHash, now] = args
      const row = flows.get(stateHash)
      if (!row || row.client_type !== 'mobile' || row.status !== 'started' || row.expires_at <= now) return statusChanges(0)
      row.status = 'consumed'
      row.consumed_id = consumedId
      return statusChanges(1)
    }
    if (sql.includes('INSERT INTO google_auth_codes')) {
      const [codeHash, userSub, email, name, createdAt, expiresAt, stateHash] = args
      const flow = flows.get(stateHash)
      if (!flow || flow.status !== 'completed' || flow.client_type !== 'extension') return statusChanges(0)
      codes.set(codeHash, {
        code_hash: codeHash, state_hash: stateHash, user_sub: userSub, email, name,
        code_challenge: flow.code_challenge, created_at: createdAt, expires_at: expiresAt, consumed_id: null,
      })
      return statusChanges(1)
    }
    if (sql.includes('UPDATE google_auth_codes SET consumed_id')) {
      const [consumedId, codeHash, stateHash, challenge, now] = args
      const row = codes.get(codeHash)
      if (!row || row.state_hash !== stateHash || row.code_challenge !== challenge || row.expires_at <= now || row.consumed_id !== null) return statusChanges(0)
      row.consumed_id = consumedId
      return statusChanges(1)
    }
    if (sql.includes('INSERT INTO google_auth_sessions')) {
      let tokenHash, userSub, clientType, createdAt, expiresAt, sourceHash, consumedId
      if (sql.includes("'extension'")) {
        [tokenHash, createdAt, expiresAt, sourceHash, , consumedId] = args
        const code = codes.get(sourceHash)
        if (!code || code.state_hash !== args[4] || code.consumed_id !== consumedId) return statusChanges(0)
        userSub = code.user_sub
        clientType = 'extension'
      } else {
        [tokenHash, userSub, createdAt, expiresAt, sourceHash, consumedId] = args
        const flow = flows.get(sourceHash)
        if (!flow || flow.status !== 'consumed' || flow.consumed_id !== consumedId) return statusChanges(0)
        clientType = 'mobile'
      }
      sessions.set(tokenHash, { token_hash: tokenHash, user_sub: userSub, client_type: clientType, created_at: createdAt, expires_at: expiresAt, revoked_at: null })
      return statusChanges(1)
    }
    if (sql.includes('UPDATE google_auth_sessions SET revoked_at')) {
      const [revokedAt, tokenHash] = args
      const row = sessions.get(tokenHash)
      if (!row || row.revoked_at !== null) return statusChanges(0)
      row.revoked_at = revokedAt
      return statusChanges(1)
    }
    return statusChanges(0)
  }

  const query = (sql, args) => ({
    async first() {
      if (sql.includes('FROM google_auth_flows')) {
        const row = flows.get(args[0])
        const requiredStatus = sql.includes("status = 'processing'") ? 'processing' : 'started'
        if (!row || row.status !== requiredStatus || row.expires_at <= args[1]) return null
        if (sql.includes("client_type = 'extension'")) {
          if (row.client_type !== 'extension') return null
          return { nonce: row.nonce, code_challenge: row.code_challenge }
        }
        if (sql.includes("client_type = 'mobile'")) {
          return row.client_type === 'mobile' ? { nonce: row.nonce } : null
        }
        return null
      }
      if (sql.includes('FROM google_auth_codes')) {
        const [codeHash, stateHash, challenge, now] = args
        const row = codes.get(codeHash)
        if (!row || row.state_hash !== stateHash || row.code_challenge !== challenge || row.expires_at <= now || row.consumed_id !== null) return null
        return { user_sub: row.user_sub, email: row.email, name: row.name }
      }
      if (sql.includes('FROM google_auth_sessions')) return sessions.get(args[0]) || null
      return null
    },
    async run() { return execute(sql, args) },
    async all() {
      if (sql.includes('FROM account_sync_records')) return { results: [] }
      if (sql.includes('FROM account_sync_changes')) return { results: changes.get(args[0]) || [] }
      return { results: [] }
    },
  })

  let batchQueue = Promise.resolve()
  return {
    flows, codes, sessions, records, changes,
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

const makeSqliteAuthDb = (migration) => {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(migration)
  const prepare = sql => {
    let args = []
    return {
      bind(...values) { args = values; return this },
      async first() { return sqlite.prepare(sql).get(...args) || null },
      async all() { return { results: sqlite.prepare(sql).all(...args) } },
      async run() {
        const result = sqlite.prepare(sql).run(...args)
        return { meta: { changes: Number(result.changes) } }
      },
    }
  }
  return {
    sqlite,
    prepare,
    async batch(statements) {
      const results = []
      sqlite.exec('BEGIN')
      try {
        for (const statement of statements) results.push(await statement.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
}

const keyPair = await crypto.subtle.generateKey({
  name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
}, true, ['sign', 'verify'])
const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
publicKey.kid = 'bridge-google-key'
publicKey.alg = 'RS256'
const encode = value => Buffer.from(typeof value === 'string' ? value : new Uint8Array(value)).toString('base64url')
const makeIdToken = async (claims) => {
  const header = encode(JSON.stringify({ alg: 'RS256', kid: publicKey.kid, typ: 'JWT' }))
  const payload = encode(JSON.stringify(claims))
  const signed = `${header}.${payload}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(signed))
  return `${signed}.${encode(signature)}`
}
const hash = async value => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex')
const challengeFor = async verifier => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url')
const opaque = () => crypto.getRandomValues(new Uint8Array(32)).reduce((value, byte) => value + String.fromCharCode(byte), '')
const base64url = value => Buffer.from(value, 'binary').toString('base64url')
const verifier = base64url(opaque())
const extensionHeaders = { Origin: GOOGLE_EXTENSION_ORIGIN, 'Content-Type': 'application/json' }
const env = { DB: makeAuthDb(), GOOGLE_WEB_CLIENT_ID: GOOGLE_CLIENT_ID, GOOGLE_WEB_CLIENT_SECRET: GOOGLE_CLIENT_SECRET }
const originalFetch = globalThis.fetch
let currentIdToken = ''
let googleTokenExchangeCount = 0
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  if (url === JWKS_URL) {
    return Response.json({ keys: [publicKey] }, { headers: { 'Cache-Control': 'public, max-age=300' } })
  }
  if (url === TOKEN_URL) {
    googleTokenExchangeCount++
    const body = new URLSearchParams(init.body)
    assert.equal(body.get('client_id'), GOOGLE_CLIENT_ID)
    assert.equal(body.get('client_secret'), GOOGLE_CLIENT_SECRET)
    assert.equal(body.get('redirect_uri'), GOOGLE_WORKER_CALLBACK_URI)
    assert.equal(body.get('grant_type'), 'authorization_code')
    assert.equal(body.has('refresh_token'), false)
    return Response.json({ access_token: 'discarded-google-access-token', id_token: currentIdToken, expires_in: 3600 })
  }
  throw new Error(`Unexpected outbound request: ${url}`)
}

try {
  const migration = await readFile(new URL('../backend/migrations/0004-google-auth-sessions.sql', import.meta.url), 'utf8')
  const accountMigration = await readFile(new URL('../backend/migrations/0002-google-account-sync.sql', import.meta.url), 'utf8')
  const schema = await readFile(new URL('../backend/schema.sql', import.meta.url), 'utf8')
  const extensionStorage = await readFile(new URL('../shared/storage.ts', import.meta.url), 'utf8')
  for (const table of ['google_auth_flows', 'google_auth_codes', 'google_auth_sessions']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
  }
  assert.doesNotMatch(migration, /refresh_token|google_access_token/i)
  assert.match(extensionStorage, /launchWebAuthFlow/)
  assert.match(extensionStorage, /extension-auth\/exchange/)
  assert.doesNotMatch(extensionStorage, /getAuthToken/)
  const migrationDb = new DatabaseSync(':memory:')
  migrationDb.exec(migration)
  const migratedTables = migrationDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name)
  for (const table of ['google_auth_flows', 'google_auth_codes', 'google_auth_sessions']) assert.ok(migratedTables.includes(table))
  migrationDb.close()
  env.DB = makeSqliteAuthDb(`${accountMigration}\n${migration}`)

  const badOrigin = await worker.fetch(new Request('https://taskmaster.test/api/google/extension-auth/start', {
    method: 'POST', headers: { ...extensionHeaders, Origin: 'https://attacker.test' },
    body: JSON.stringify({ codeChallenge: await challengeFor(verifier) }),
  }), env)
  assert.equal(badOrigin.status, 403)
  assert.equal((await worker.fetch(new Request('https://taskmaster.test/api/google/extension-auth/start', {
    method: 'POST', headers: extensionHeaders,
    body: JSON.stringify({ codeChallenge: await challengeFor(verifier) }),
  }), { DB: env.DB, GOOGLE_WEB_CLIENT_ID: GOOGLE_CLIENT_ID })).status, 503, 'extension login fails closed without the Worker secret')

  const start = await worker.fetch(new Request('https://taskmaster.test/api/google/extension-auth/start', {
    method: 'POST', headers: extensionHeaders,
    body: JSON.stringify({ codeChallenge: await challengeFor(verifier), redirectUri: 'https://attacker.test/capture' }),
  }), env)
  assert.equal(start.status, 200)
  const flow = await start.json()
  const state = flow.state
  const authorize = new URL(flow.authorizeUrl)
  assert.equal(authorize.origin, 'https://taskmaster.test')
  assert.equal(authorize.pathname, '/api/google/extension-auth/authorize')
  const authorizeResponse = await worker.fetch(new Request(flow.authorizeUrl), env)
  assert.equal(authorizeResponse.status, 302)
  const googleAuthorize = new URL(authorizeResponse.headers.get('Location'))
  assert.equal(googleAuthorize.origin, 'https://accounts.google.com')
  assert.equal(googleAuthorize.searchParams.get('client_id'), GOOGLE_CLIENT_ID)
  assert.equal(googleAuthorize.searchParams.get('redirect_uri'), GOOGLE_WORKER_CALLBACK_URI)
  assert.equal(googleAuthorize.searchParams.get('response_type'), 'code')
  assert.equal(googleAuthorize.searchParams.get('scope'), 'openid email profile')
  assert.equal(googleAuthorize.searchParams.get('state'), state)
  assert.equal(googleAuthorize.searchParams.get('access_type'), 'online')
  assert.equal(googleAuthorize.searchParams.has('prompt'), false)
  const nonce = googleAuthorize.searchParams.get('nonce')
  assert.ok(nonce)

  const nowSeconds = Math.floor(Date.now() / 1000)
  currentIdToken = await makeIdToken({
    iss: 'https://accounts.google.com', aud: GOOGLE_CLIENT_ID, sub: 'extension-google-sub',
    email: 'extension@example.test', name: 'Extension User', nonce,
    iat: nowSeconds, exp: nowSeconds + 3600,
  })
  const callback = await worker.fetch(new Request(`https://taskmaster.test/api/google/callback?${new URLSearchParams({ code: 'google-authorization-code', state })}`), env)
  assert.equal(callback.status, 302)
  const extensionCallback = new URL(callback.headers.get('Location'))
  assert.equal(`${extensionCallback.origin}${extensionCallback.pathname}`, GOOGLE_EXTENSION_CALLBACK_URI)
  assert.equal(extensionCallback.searchParams.get('state'), state)
  const code = extensionCallback.searchParams.get('code')
  assert.ok(code)
  assert.equal(extensionCallback.searchParams.has('access_token'), false)
  assert.equal(extensionCallback.searchParams.has('id_token'), false)
  assert.equal(extensionCallback.searchParams.has('sessionToken'), false)
  const authCodes = (await env.DB.prepare('SELECT * FROM google_auth_codes').all()).results
  assert.equal(authCodes.length, 1)
  assert.equal(authCodes[0].code_hash, await hash(code))

  const grant = { code, state, codeVerifier: verifier }
  assert.equal(authCodes[0].code_challenge, await challengeFor(verifier), 'the Worker stores the extension PKCE challenge')
  assert.equal(authCodes[0].state_hash, await hash(state), 'the Worker stores a hash of OAuth state')
  const wrongVerifier = { ...grant, codeVerifier: `${verifier.slice(0, -1)}${verifier.endsWith('A') ? 'B' : 'A'}` }
  const pendingWrongVerifier = await readGoogleExtensionAuthPending(new Request('https://taskmaster.test/api/google/extension-auth/pending', {
    method: 'POST', headers: extensionHeaders, body: JSON.stringify(wrongVerifier),
  }), env)
  assert.equal(pendingWrongVerifier.status, 401)
  const pending = await readGoogleExtensionAuthPending(new Request('https://taskmaster.test/api/google/extension-auth/pending', {
    method: 'POST', headers: extensionHeaders, body: JSON.stringify(grant),
  }), env)
  assert.equal(pending.status, 200, await pending.clone().text())
  assert.deepEqual((await pending.json()).user, {
    sub: 'extension-google-sub', email: 'extension@example.test', name: 'Extension User',
  })
  const pendingAfterExpiry = await readGoogleExtensionAuthPending(new Request('https://taskmaster.test/api/google/extension-auth/pending', {
    method: 'POST', headers: extensionHeaders, body: JSON.stringify(grant),
  }), env, Date.now() + 61_000)
  assert.equal(pendingAfterExpiry.status, 401, 'one-time exchange code expires after 60 seconds')

  const exchangeRequest = () => new Request('https://taskmaster.test/api/google/extension-auth/exchange', {
    method: 'POST', headers: extensionHeaders, body: JSON.stringify(grant),
  })
  const exchangeResponses = await Promise.all([
    worker.fetch(exchangeRequest(), env), worker.fetch(exchangeRequest(), env),
  ])
  assert.deepEqual(exchangeResponses.map(response => response.status).sort(), [200, 401])
  const exchange = await exchangeResponses.find(response => response.status === 200).json()
  assert.equal(exchange.user.sub, 'extension-google-sub')
  assert.match(exchange.sessionToken, /^[A-Za-z0-9_-]{43}$/)
  const sessions = (await env.DB.prepare('SELECT * FROM google_auth_sessions').all()).results
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].token_hash, await hash(exchange.sessionToken))
  assert.equal(sessions.some(session => session.token_hash === exchange.sessionToken), false, 'the database stores only a hash of the session token')
  assert.doesNotMatch(JSON.stringify({ authCodes, sessions }), /discarded-google-access-token/)
  assert.equal(googleTokenExchangeCount, 1)
  const replayedCallback = await worker.fetch(new Request(`https://taskmaster.test/api/google/callback?${new URLSearchParams({ code: 'google-authorization-code', state })}`), env)
  assert.equal(new URL(replayedCallback.headers.get('Location')).searchParams.get('error'), 'auth_failed')
  assert.equal(googleTokenExchangeCount, 1, 'a replayed OAuth state is rejected before Google code exchange')

  const extensionAccountRequest = () => new Request('https://taskmaster.test/api/account/categories', {
    headers: {
      Authorization: `Bearer ${exchange.sessionToken}`,
      'X-TaskMaster-Client': 'extension',
      Origin: GOOGLE_EXTENSION_ORIGIN,
    },
  })
  assert.equal((await worker.fetch(extensionAccountRequest(), env)).status, 200)
  assert.equal((await worker.fetch(new Request('https://taskmaster.test/api/account/categories', {
    headers: { Authorization: `Bearer ${currentIdToken}`, 'X-TaskMaster-Client': 'extension', Origin: GOOGLE_EXTENSION_ORIGIN },
  }), env)).status, 401, 'a Google ID token cannot directly authorize account APIs')
  assert.equal((await worker.fetch(new Request('https://taskmaster.test/api/account/categories', {
    headers: { Authorization: `Bearer ${exchange.sessionToken}`, 'X-TaskMaster-Client': 'mobile', Origin: 'https://taskmaster.test' },
  }), env)).status, 401, 'extension sessions cannot be used as mobile sessions')

  const logout = await worker.fetch(new Request('https://taskmaster.test/api/google/session/logout', {
    method: 'POST', headers: {
      Authorization: `Bearer ${exchange.sessionToken}`,
      'X-TaskMaster-Client': 'extension', Origin: GOOGLE_EXTENSION_ORIGIN,
    },
  }), env)
  assert.equal(logout.status, 200)
  assert.equal((await worker.fetch(extensionAccountRequest(), env)).status, 401)

  const mobileStart = await worker.fetch(new Request('https://taskmaster.test/api/google/mobile-auth/start', {
    method: 'POST', headers: { Origin: 'https://taskmaster.test' },
  }), env)
  assert.equal(mobileStart.status, 200)
  const mobileFlow = await mobileStart.json()
  const mobileIdToken = await makeIdToken({
    iss: 'https://accounts.google.com', aud: GOOGLE_CLIENT_ID, sub: 'mobile-google-sub',
    email: 'mobile@example.test', name: 'Mobile User', nonce: mobileFlow.nonce,
    iat: nowSeconds, exp: nowSeconds + 3600,
  })
  const mobileWrongNonceToken = await makeIdToken({
    iss: 'https://accounts.google.com', aud: GOOGLE_CLIENT_ID, sub: 'mobile-google-sub',
    email: 'mobile@example.test', nonce: 'wrong-flow-nonce', iat: nowSeconds, exp: nowSeconds + 3600,
  })
  const mobileLoginRequest = credential => new Request('https://taskmaster.test/api/google/identity', {
    method: 'POST', headers: { Origin: 'https://taskmaster.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: mobileFlow.state, credential }),
  })
  assert.equal((await worker.fetch(mobileLoginRequest(mobileWrongNonceToken), env)).status, 401)
  const mobileLogin = await worker.fetch(mobileLoginRequest(mobileIdToken), env)
  assert.equal(mobileLogin.status, 200)
  const mobileSession = await mobileLogin.json()
  assert.equal(mobileSession.user.sub, 'mobile-google-sub')
  const mobileAccountRequest = () => new Request('https://taskmaster.test/api/account/categories', {
    headers: {
      Authorization: `Bearer ${mobileSession.sessionToken}`,
      'X-TaskMaster-Client': 'mobile',
      Origin: 'https://taskmaster.test',
    },
  })
  const mobileAccountResponse = await worker.fetch(mobileAccountRequest(), env)
  assert.equal(mobileAccountResponse.status, 200)
  assert.equal((await mobileAccountResponse.json()).userSub, 'mobile-google-sub', 'the mobile page can confirm the restored session owner')
  await assert.rejects(getTaskmasterSessionFromRequest(mobileAccountRequest(), env, mobileSession.expiresAt), /expired/)
  assert.equal((await worker.fetch(new Request('https://taskmaster.test/api/google/mobile-auth/start', {
    method: 'POST', headers: { Origin: 'https://attacker.test' },
  }), env)).status, 403)
  const mobileLogout = await worker.fetch(new Request('https://taskmaster.test/api/google/session/logout', {
    method: 'POST', headers: {
      Authorization: `Bearer ${mobileSession.sessionToken}`,
      'X-TaskMaster-Client': 'mobile', Origin: 'https://taskmaster.test',
    },
  }), env)
  assert.equal(mobileLogout.status, 200)
  assert.equal((await worker.fetch(mobileAccountRequest(), env)).status, 401)

  const expiryRequest = new Request('https://taskmaster.test/api/account/categories', {
    headers: { Authorization: `Bearer ${exchange.sessionToken}`, 'X-TaskMaster-Client': 'extension', Origin: GOOGLE_EXTENSION_ORIGIN },
  })
  await assert.rejects(getTaskmasterSessionFromRequest(expiryRequest, env, exchange.expiresAt), /expired/)

  const badNonceStart = await worker.fetch(new Request('https://taskmaster.test/api/google/extension-auth/start', {
    method: 'POST', headers: extensionHeaders,
    body: JSON.stringify({ codeChallenge: await challengeFor(verifier) }),
  }), env)
  const badNonceFlow = await badNonceStart.json()
  const badNonceAuthorize = await worker.fetch(new Request(badNonceFlow.authorizeUrl), env)
  const badNonce = new URL(badNonceAuthorize.headers.get('Location')).searchParams.get('nonce')
  currentIdToken = await makeIdToken({
    iss: 'https://accounts.google.com', aud: GOOGLE_CLIENT_ID, sub: 'forged-nonce-sub', nonce: `${badNonce}-wrong`,
    iat: nowSeconds, exp: nowSeconds + 3600,
  })
  const badNonceCallback = await worker.fetch(new Request(`https://taskmaster.test/api/google/callback?${new URLSearchParams({ code: 'bad-nonce-code', state: badNonceFlow.state })}`), env)
  const badNonceLocation = new URL(badNonceCallback.headers.get('Location'))
  assert.equal(`${badNonceLocation.origin}${badNonceLocation.pathname}`, GOOGLE_EXTENSION_CALLBACK_URI)
  assert.equal(badNonceLocation.searchParams.get('error'), 'auth_failed')
  assert.equal(badNonceLocation.searchParams.has('code'), false)

  console.log('Google extension OAuth bridge and finite session tests passed')
} finally {
  globalThis.fetch = originalFetch
  env.DB.sqlite.close()
}
