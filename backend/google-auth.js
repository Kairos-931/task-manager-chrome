import { GoogleAuthError, verifyGoogleIdToken } from './account-sync.js'

export const GOOGLE_EXTENSION_ORIGIN = 'chrome-extension://gjifmpjgedleemhkikajgepickfphflo'
export const GOOGLE_EXTENSION_CALLBACK_URI = 'https://gjifmpjgedleemhkikajgepickfphflo.chromiumapp.org/google-auth'
export const GOOGLE_WORKER_CALLBACK_URI = 'https://taskmaster-api.yx9391.workers.dev/api/google/callback'

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_FLOW_TTL_MS = 10 * 60 * 1000
const MOBILE_FLOW_TTL_MS = 5 * 60 * 1000
const GOOGLE_CODE_TTL_MS = 60 * 1000
const TASKMASTER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const OPAQUE_VALUE_RE = /^[A-Za-z0-9_-]{32,128}$/
const PKCE_CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/

const base64Url = (bytes) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const randomOpaqueValue = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

const sha256 = async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
const hashOpaqueValue = async (value) => [...await sha256(value)].map(byte => byte.toString(16).padStart(2, '0')).join('')
const challengeForVerifier = async (verifier) => base64Url(await sha256(verifier))

const authJson = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
})

const readJson = async (request) => {
  const raw = await request.text()
  if (raw.length > 16_384) throw new GoogleAuthError('Google authorization request is invalid', 400)
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid JSON object')
    return value
  } catch {
    throw new GoogleAuthError('Google authorization request is invalid', 400)
  }
}

const requireDatabase = (env) => {
  if (!env.DB) throw new GoogleAuthError('Account authentication storage is not configured', 503)
  return env.DB
}

const requireWebClient = (env, includeSecret = false) => {
  if (typeof env.GOOGLE_WEB_CLIENT_ID !== 'string' || !env.GOOGLE_WEB_CLIENT_ID) {
    throw new GoogleAuthError('Google sign-in is not configured', 503)
  }
  if (includeSecret && (typeof env.GOOGLE_WEB_CLIENT_SECRET !== 'string' || !env.GOOGLE_WEB_CLIENT_SECRET)) {
    throw new GoogleAuthError('Google sign-in is not configured', 503)
  }
}

const requireExtensionOrigin = (request) => {
  if (request.headers.get('Origin') !== GOOGLE_EXTENSION_ORIGIN) {
    throw new GoogleAuthError('Google extension authorization is not allowed', 403)
  }
}

const requireSameOrigin = (request) => {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    throw new GoogleAuthError('Google authorization is not allowed from this origin', 403)
  }
}

const saveNewFlow = async (db, { state, nonce, clientType, codeChallenge, now, expiresAt }) => {
  const stateHash = await hashOpaqueValue(state)
  await db.batch([
    db.prepare('DELETE FROM google_auth_flows WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM google_auth_codes WHERE expires_at <= ? OR consumed_id IS NOT NULL').bind(now),
    db.prepare('DELETE FROM google_auth_sessions WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)').bind(now - 30 * 24 * 60 * 60 * 1000, now - 30 * 24 * 60 * 60 * 1000),
    db.prepare(
      `INSERT INTO google_auth_flows
        (state_hash, nonce, client_type, code_challenge, created_at, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'started')`
    ).bind(stateHash, nonce, clientType, codeChallenge, now, expiresAt),
  ])
  return stateHash
}

export const startGoogleExtensionAuth = async (request, env, now = Date.now()) => {
  try {
    requireExtensionOrigin(request)
    requireWebClient(env, true)
    const db = requireDatabase(env)
    const body = await readJson(request)
    if (typeof body.codeChallenge !== 'string' || !PKCE_CHALLENGE_RE.test(body.codeChallenge)) {
      throw new GoogleAuthError('Google authorization request is invalid', 400)
    }
    const state = randomOpaqueValue()
    const nonce = randomOpaqueValue()
    const expiresAt = now + AUTH_FLOW_TTL_MS
    await saveNewFlow(db, { state, nonce, clientType: 'extension', codeChallenge: body.codeChallenge, now, expiresAt })
    const authorizeUrl = new URL('/api/google/extension-auth/authorize', new URL(request.url).origin)
    authorizeUrl.searchParams.set('state', state)
    return authJson({ authorizeUrl: authorizeUrl.toString(), state })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export const authorizeGoogleExtension = async (request, env, now = Date.now()) => {
  try {
    requireWebClient(env, true)
    const db = requireDatabase(env)
    const state = new URL(request.url).searchParams.get('state') || ''
    if (!OPAQUE_VALUE_RE.test(state)) throw new GoogleAuthError('Google authorization request is invalid', 400)
    const stateHash = await hashOpaqueValue(state)
    const flow = await db.prepare(
      `SELECT nonce FROM google_auth_flows
       WHERE state_hash = ? AND client_type = 'extension' AND status = 'started' AND expires_at > ?`
    ).bind(stateHash, now).first()
    if (!flow) throw new GoogleAuthError('Google authorization request has expired', 401)

    const authorizeUrl = new URL(GOOGLE_AUTHORIZE_URL)
    authorizeUrl.searchParams.set('client_id', env.GOOGLE_WEB_CLIENT_ID)
    authorizeUrl.searchParams.set('redirect_uri', GOOGLE_WORKER_CALLBACK_URI)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', 'openid email profile')
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('nonce', flow.nonce)
    authorizeUrl.searchParams.set('access_type', 'online')
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizeUrl.toString(),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

const extensionCallback = (state, params = {}) => {
  const callback = new URL(GOOGLE_EXTENSION_CALLBACK_URI)
  callback.searchParams.set('state', state)
  for (const [key, value] of Object.entries(params)) callback.searchParams.set(key, value)
  return new Response(null, {
    status: 302,
    headers: {
      Location: callback.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

export const completeGoogleOAuthCallback = async (request, env, fetchImpl = fetch, now = Date.now()) => {
  const url = new URL(request.url)
  const state = url.searchParams.get('state') || ''
  if (!OPAQUE_VALUE_RE.test(state)) return new Response('Google authorization could not be completed', { status: 400 })
  try {
    requireWebClient(env, true)
    const db = requireDatabase(env)
    const stateHash = await hashOpaqueValue(state)
    const claim = await db.prepare(
      `UPDATE google_auth_flows SET status = 'processing'
       WHERE state_hash = ? AND client_type = 'extension' AND status = 'started' AND expires_at > ?`
    ).bind(stateHash, now).run()
    if (Number(claim?.meta?.changes) !== 1) return extensionCallback(state, { error: 'auth_failed' })

    if (url.searchParams.has('error')) {
      await db.prepare(
        `UPDATE google_auth_flows SET status = 'failed'
         WHERE state_hash = ? AND status = 'processing'`
      ).bind(stateHash).run()
      return extensionCallback(state, { error: 'access_denied' })
    }

    const googleCode = url.searchParams.get('code') || ''
    if (!googleCode || googleCode.length > 4096) {
      await db.prepare(
        `UPDATE google_auth_flows SET status = 'failed' WHERE state_hash = ? AND status = 'processing'`
      ).bind(stateHash).run()
      return extensionCallback(state, { error: 'auth_failed' })
    }
    const flow = await db.prepare(
      `SELECT nonce, code_challenge FROM google_auth_flows
       WHERE state_hash = ? AND client_type = 'extension' AND status = 'processing' AND expires_at > ?`
    ).bind(stateHash, now).first()
    if (!flow) return extensionCallback(state, { error: 'auth_failed' })

    let tokenResponse
    try {
      tokenResponse = await fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          code: googleCode,
          client_id: env.GOOGLE_WEB_CLIENT_ID,
          client_secret: env.GOOGLE_WEB_CLIENT_SECRET,
          redirect_uri: GOOGLE_WORKER_CALLBACK_URI,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      await db.prepare(
        `UPDATE google_auth_flows SET status = 'failed' WHERE state_hash = ? AND status = 'processing'`
      ).bind(stateHash).run()
      return extensionCallback(state, { error: 'temporarily_unavailable' })
    }
    const tokenBody = await tokenResponse.json().catch(() => null)
    if (!tokenResponse.ok || typeof tokenBody?.id_token !== 'string') {
      await db.prepare(
        `UPDATE google_auth_flows SET status = 'failed' WHERE state_hash = ? AND status = 'processing'`
      ).bind(stateHash).run()
      return extensionCallback(state, { error: 'auth_failed' })
    }

    let user
    try {
      user = await verifyGoogleIdToken(tokenBody.id_token, env.GOOGLE_WEB_CLIENT_ID, fetchImpl, now, flow.nonce)
    } catch {
      await db.prepare(
        `UPDATE google_auth_flows SET status = 'failed' WHERE state_hash = ? AND status = 'processing'`
      ).bind(stateHash).run()
      return extensionCallback(state, { error: 'auth_failed' })
    }

    const code = randomOpaqueValue()
    const codeHash = await hashOpaqueValue(code)
    const codeExpiresAt = now + GOOGLE_CODE_TTL_MS
    const results = await db.batch([
      db.prepare(
        `UPDATE google_auth_flows SET status = 'completed'
         WHERE state_hash = ? AND client_type = 'extension' AND status = 'processing' AND expires_at > ?`
      ).bind(stateHash, now),
      db.prepare(
        `INSERT INTO google_auth_codes
          (code_hash, state_hash, user_sub, email, name, code_challenge, created_at, expires_at)
         SELECT ?, state_hash, ?, ?, ?, code_challenge, ?, ?
         FROM google_auth_flows WHERE state_hash = ? AND status = 'completed' AND client_type = 'extension'`
      ).bind(codeHash, user.sub, user.email, user.name, now, codeExpiresAt, stateHash),
    ])
    if (Number(results?.[0]?.meta?.changes) !== 1 || Number(results?.[1]?.meta?.changes) !== 1) {
      return extensionCallback(state, { error: 'auth_failed' })
    }
    return extensionCallback(state, { code })
  } catch {
    return extensionCallback(state, { error: 'temporarily_unavailable' })
  }
}

const findExchangeCode = async (db, { code, state, codeVerifier, now }) => {
  if (!OPAQUE_VALUE_RE.test(code) || !OPAQUE_VALUE_RE.test(state) ||
      typeof codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) {
    throw new GoogleAuthError('Google authorization code is invalid')
  }
  const [codeHash, stateHash, codeChallenge] = await Promise.all([
    hashOpaqueValue(code), hashOpaqueValue(state), challengeForVerifier(codeVerifier),
  ])
  const row = await db.prepare(
    `SELECT user_sub, email, name FROM google_auth_codes
     WHERE code_hash = ? AND state_hash = ? AND code_challenge = ?
       AND expires_at > ? AND consumed_id IS NULL`
  ).bind(codeHash, stateHash, codeChallenge, now).first()
  if (!row) throw new GoogleAuthError('Google authorization code is invalid or expired')
  return { row, codeHash, stateHash, codeChallenge }
}

export const readGoogleExtensionAuthPending = async (request, env, now = Date.now()) => {
  try {
    requireExtensionOrigin(request)
    const db = requireDatabase(env)
    const body = await readJson(request)
    const { row } = await findExchangeCode(db, { ...body, now })
    return authJson({ user: { sub: row.user_sub, email: row.email || '', name: row.name || '' } })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export const exchangeGoogleExtensionAuthCode = async (request, env, now = Date.now()) => {
  try {
    requireExtensionOrigin(request)
    const db = requireDatabase(env)
    const body = await readJson(request)
    const { row, codeHash, stateHash, codeChallenge } = await findExchangeCode(db, { ...body, now })
    const consumedId = randomOpaqueValue()
    const sessionToken = randomOpaqueValue()
    const sessionTokenHash = await hashOpaqueValue(sessionToken)
    const expiresAt = now + TASKMASTER_SESSION_TTL_MS
    const results = await db.batch([
      db.prepare(
        `UPDATE google_auth_codes SET consumed_id = ?
         WHERE code_hash = ? AND state_hash = ? AND code_challenge = ?
           AND expires_at > ? AND consumed_id IS NULL`
      ).bind(consumedId, codeHash, stateHash, codeChallenge, now),
      db.prepare(
        `INSERT INTO google_auth_sessions (token_hash, user_sub, client_type, created_at, expires_at)
         SELECT ?, user_sub, 'extension', ?, ? FROM google_auth_codes
         WHERE code_hash = ? AND state_hash = ? AND consumed_id = ?`
      ).bind(sessionTokenHash, now, expiresAt, codeHash, stateHash, consumedId),
    ])
    if (Number(results?.[0]?.meta?.changes) !== 1 || Number(results?.[1]?.meta?.changes) !== 1) {
      throw new GoogleAuthError('Google authorization code is invalid or already used')
    }
    return authJson({
      user: { sub: row.user_sub, email: row.email || '', name: row.name || '' },
      sessionToken,
      expiresAt,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export const cancelGoogleExtensionAuthCode = async (request, env, now = Date.now()) => {
  try {
    requireExtensionOrigin(request)
    const db = requireDatabase(env)
    const body = await readJson(request)
    const { codeHash, stateHash, codeChallenge } = await findExchangeCode(db, { ...body, now })
    await db.prepare(
      `UPDATE google_auth_codes SET consumed_id = ?
       WHERE code_hash = ? AND state_hash = ? AND code_challenge = ?
         AND expires_at > ? AND consumed_id IS NULL`
    ).bind(`cancel_${randomOpaqueValue()}`, codeHash, stateHash, codeChallenge, now).run()
    return authJson({ ok: true })
  } catch (error) {
    // Cancel is best effort: a code that was already exchanged or expired is
    // already unusable, so do not reveal its state to the extension.
    if (error instanceof GoogleAuthError && error.status === 401) return authJson({ ok: true })
    return authErrorResponse(error)
  }
}

export const startMobileGoogleAuth = async (request, env, now = Date.now()) => {
  try {
    requireSameOrigin(request)
    requireWebClient(env)
    const db = requireDatabase(env)
    const state = randomOpaqueValue()
    const nonce = randomOpaqueValue()
    await saveNewFlow(db, {
      state, nonce, clientType: 'mobile', codeChallenge: '', now, expiresAt: now + MOBILE_FLOW_TTL_MS,
    })
    return authJson({ state, nonce })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export const createMobileGoogleSession = async (request, env, fetchImpl = fetch, now = Date.now()) => {
  try {
    requireSameOrigin(request)
    requireWebClient(env)
    const db = requireDatabase(env)
    const body = await readJson(request)
    if (typeof body.state !== 'string' || !OPAQUE_VALUE_RE.test(body.state) ||
        typeof body.credential !== 'string' || !body.credential || body.credential.length > 8192) {
      throw new GoogleAuthError('Google authorization is invalid')
    }
    const stateHash = await hashOpaqueValue(body.state)
    const flow = await db.prepare(
      `SELECT nonce FROM google_auth_flows
       WHERE state_hash = ? AND client_type = 'mobile' AND status = 'started' AND expires_at > ?`
    ).bind(stateHash, now).first()
    if (!flow) throw new GoogleAuthError('Google authorization has expired')
    const user = await verifyGoogleIdToken(body.credential, env.GOOGLE_WEB_CLIENT_ID, fetchImpl, now, flow.nonce)
    const consumedId = randomOpaqueValue()
    const sessionToken = randomOpaqueValue()
    const sessionTokenHash = await hashOpaqueValue(sessionToken)
    const expiresAt = now + TASKMASTER_SESSION_TTL_MS
    const results = await db.batch([
      db.prepare(
        `UPDATE google_auth_flows SET status = 'consumed', consumed_id = ?
         WHERE state_hash = ? AND client_type = 'mobile' AND status = 'started' AND expires_at > ?`
      ).bind(consumedId, stateHash, now),
      db.prepare(
        `INSERT INTO google_auth_sessions (token_hash, user_sub, client_type, created_at, expires_at)
         SELECT ?, ?, 'mobile', ?, ? FROM google_auth_flows
         WHERE state_hash = ? AND status = 'consumed' AND consumed_id = ?`
      ).bind(sessionTokenHash, user.sub, now, expiresAt, stateHash, consumedId),
    ])
    if (Number(results?.[0]?.meta?.changes) !== 1 || Number(results?.[1]?.meta?.changes) !== 1) {
      throw new GoogleAuthError('Google authorization has already been used')
    }
    return authJson({ user, sessionToken, expiresAt })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export const getTaskmasterSessionFromRequest = async (request, env, now = Date.now()) => {
  const clientType = request.headers.get('X-TaskMaster-Client')
  const origin = request.headers.get('Origin')
  if (clientType === 'extension') {
    if (origin !== GOOGLE_EXTENSION_ORIGIN) throw new GoogleAuthError('TaskMaster session is invalid')
  } else if (clientType === 'mobile') {
    const sameOriginGet = request.method === 'GET' && !origin &&
      request.headers.get('Sec-Fetch-Site') === 'same-origin'
    if (origin !== new URL(request.url).origin && !sameOriginGet) {
      throw new GoogleAuthError('TaskMaster session is invalid')
    }
  } else {
    throw new GoogleAuthError('TaskMaster session is invalid')
  }
  const match = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)
  if (!match) throw new GoogleAuthError('TaskMaster session is required')
  const db = requireDatabase(env)
  const tokenHash = await hashOpaqueValue(match[1])
  const session = await db.prepare(
    `SELECT user_sub, client_type, expires_at, revoked_at FROM google_auth_sessions
     WHERE token_hash = ?`
  ).bind(tokenHash).first()
  if (!session || session.client_type !== clientType || session.revoked_at !== null ||
      Number(session.expires_at) <= now) {
    throw new GoogleAuthError('TaskMaster session has expired')
  }
  return { sub: session.user_sub, clientType, tokenHash }
}

export const logoutTaskmasterSession = async (request, env, now = Date.now()) => {
  try {
    const session = await getTaskmasterSessionFromRequest(request, env, now)
    await env.DB.prepare(
      `UPDATE google_auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`
    ).bind(now, session.tokenHash).run()
    return authJson({ ok: true })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export const authErrorResponse = (error) => {
  if (error instanceof GoogleAuthError) return authJson({ error: error.message }, error.status)
  return authJson({ error: 'Google sign-in is temporarily unavailable' }, 503)
}
