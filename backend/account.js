const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])
const ACCOUNT_RECORD_TYPES = new Set(['task', 'category', 'settings'])
const MAX_ACCOUNT_CHANGES = 100
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const SESSION_COOKIE = 'tm_session'

let googleJwksCache = { expiresAt: 0, keys: [] }

const response = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  },
})

const errorResponse = (error, status) => response({ error }, status)

const base64UrlToBytes = value => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

const base64UrlEncode = bytes => {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const parseBase64UrlJson = value => JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)))

const sha256Hex = async value => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const randomToken = (length = 32) => base64UrlEncode(crypto.getRandomValues(new Uint8Array(length)))

const parseCookie = (request, name) => {
  const cookies = request.headers.get('Cookie') || ''
  for (const item of cookies.split(';')) {
    const separator = item.indexOf('=')
    if (separator < 0) continue
    if (item.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(item.slice(separator + 1).trim()) } catch { return '' }
    }
  }
  return ''
}

const getPresentedSession = request => {
  const authorization = request.headers.get('Authorization') || ''
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  const token = bearer || parseCookie(request, SESSION_COOKIE)
  return token.length <= 512 ? token : ''
}

const createSessionCookie = token => `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`
const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`

const verifyGoogleIdToken = async (token, expectedNonce, env) => {
  if (typeof token !== 'string' || token.length > 8192) throw new Error('invalid_google_token')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('invalid_google_token')
  const header = parseBase64UrlJson(parts[0])
  const claims = parseBase64UrlJson(parts[1])
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('invalid_google_token')

  const now = Math.floor(Date.now() / 1000)
  if (!GOOGLE_ISSUERS.has(claims.iss) || claims.aud !== env.GOOGLE_CLIENT_ID ||
      (claims.azp && claims.azp !== env.GOOGLE_CLIENT_ID) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
      typeof claims.sub !== 'string' || claims.sub.length < 1 || claims.sub.length > 255 ||
      claims.email_verified !== true || typeof claims.email !== 'string' || !claims.email) {
    throw new Error('invalid_google_claims')
  }
  if (expectedNonce && claims.nonce !== expectedNonce) throw new Error('invalid_google_nonce')

  let keys = googleJwksCache.keys
  if (googleJwksCache.expiresAt <= Date.now() || !keys.some(key => key.kid === header.kid)) {
    const keyResponse = await fetch(GOOGLE_JWKS_URL, { cache: 'no-store' })
    if (!keyResponse.ok) throw new Error('google_keys_unavailable')
    const keySet = await keyResponse.json()
    if (!Array.isArray(keySet.keys)) throw new Error('google_keys_invalid')
    keys = keySet.keys
    const maxAge = Number(keyResponse.headers.get('Cache-Control')?.match(/max-age=(\d+)/i)?.[1] || 3600)
    googleJwksCache = { keys, expiresAt: Date.now() + Math.min(Math.max(maxAge, 60), 3600) * 1000 }
  }

  const signingKey = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig')
  if (!signingKey) throw new Error('google_key_not_found')
  const cryptoKey = await crypto.subtle.importKey('jwk', signingKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', cryptoKey, base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  )
  if (!valid) throw new Error('invalid_google_signature')
  return { sub: claims.sub, email: claims.email, name: typeof claims.name === 'string' ? claims.name : '' }
}

const createAccountSession = async (env, user) => {
  const sessionToken = randomToken(32)
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  const sessionHash = await sha256Hex(sessionToken)
  await env.DB.prepare('DELETE FROM account_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL')
    .bind(Math.floor(Date.now() / 1000)).run()
  await env.DB.prepare(
    `INSERT INTO account_sessions (session_hash, user_sub, email, created_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).bind(sessionHash, user.sub, user.email, Math.floor(Date.now() / 1000), expiresAt).run()
  return { sessionToken, user: { sub: user.sub, email: user.email, name: user.name }, expiresAt }
}

export const authenticateAccount = async (request, env) => {
  const token = getPresentedSession(request)
  if (!token) return null
  const sessionHash = await sha256Hex(token)
  const now = Math.floor(Date.now() / 1000)
  const session = await env.DB.prepare(
    `SELECT user_sub, email, expires_at FROM account_sessions
     WHERE session_hash = ? AND revoked_at IS NULL AND expires_at > ?`
  ).bind(sessionHash, now).first()
  if (!session?.user_sub) return null
  return { sub: session.user_sub, email: session.email || '', expiresAt: Number(session.expires_at), sessionHash }
}

const exchangeGoogleCode = async (request, env) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_EXTENSION_REDIRECT_URI) {
    return errorResponse('Google 登录服务尚未配置', 503)
  }
  const body = await request.json().catch(() => ({}))
  if (typeof body.code !== 'string' || body.code.length > 4096 ||
      typeof body.codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.codeVerifier) ||
      typeof body.nonce !== 'string' || body.nonce.length < 16 ||
      body.redirectUri !== env.GOOGLE_EXTENSION_REDIRECT_URI) {
    return errorResponse('Google 授权参数无效', 400)
  }

  let tokenResult
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: body.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: body.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: body.codeVerifier,
      }),
    })
    tokenResult = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || typeof tokenResult.id_token !== 'string') return errorResponse('Google 授权代码无效或已过期', 401)
  } catch {
    return errorResponse('暂时无法连接 Google，请检查网络后重试', 502)
  }

  try {
    const user = await verifyGoogleIdToken(tokenResult.id_token, body.nonce, env)
    const session = await createAccountSession(env, user)
    return response({ session: { token: session.sessionToken, user: session.user, expiresAt: session.expiresAt } })
  } catch (error) {
    if (error.message === 'google_keys_unavailable') return errorResponse('暂时无法验证 Google 身份，请稍后重试', 502)
    return errorResponse('Google 身份验证失败，请重新登录', 401)
  }
}

const acceptMobileGoogleToken = async (request, env) => {
  if (!env.GOOGLE_CLIENT_ID) return errorResponse('Google 登录服务尚未配置', 503)
  const body = await request.json().catch(() => ({}))
  if (typeof body.idToken !== 'string' || typeof body.nonce !== 'string' || body.nonce.length < 16 || body.nonce.length > 256) {
    return errorResponse('Google 登录参数无效，请重新登录', 400)
  }
  try {
    const user = await verifyGoogleIdToken(body.idToken, body.nonce, env)
    const session = await createAccountSession(env, user)
    return response({ user: session.user, expiresAt: session.expiresAt }, 200, { 'Set-Cookie': createSessionCookie(session.sessionToken) })
  } catch (error) {
    if (error.message === 'google_keys_unavailable') return errorResponse('暂时无法验证 Google 身份，请稍后重试', 502)
    return errorResponse('Google 身份验证失败，请重新登录', 401)
  }
}

export const handleGoogleAuthRoute = async (request, env) => {
  const { pathname } = new URL(request.url)
  const method = request.method

  if (pathname === '/api/auth/config' && method === 'GET') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_EXTENSION_REDIRECT_URI) {
      return errorResponse('Google 登录服务尚未配置', 503)
    }
    return response({ clientId: env.GOOGLE_CLIENT_ID })
  }
  if (pathname === '/api/auth/mobile-config' && method === 'GET') {
    if (!env.GOOGLE_CLIENT_ID) return errorResponse('Google 登录服务尚未配置', 503)
    return response({ clientId: env.GOOGLE_CLIENT_ID })
  }
  if (pathname === '/api/auth/exchange' && method === 'POST') return exchangeGoogleCode(request, env)
  if (pathname === '/api/auth/google' && method === 'POST') return acceptMobileGoogleToken(request, env)

  if (pathname === '/api/auth/session' && method === 'GET') {
    const user = await authenticateAccount(request, env)
    return user ? response({ user: { sub: user.sub, email: user.email }, expiresAt: user.expiresAt }) : errorResponse('登录已过期，请重新登录', 401)
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = getPresentedSession(request)
    if (token) {
      await env.DB.prepare('UPDATE account_sessions SET revoked_at = ? WHERE session_hash = ? AND revoked_at IS NULL')
        .bind(Math.floor(Date.now() / 1000), await sha256Hex(token)).run()
    }
    return response({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
  }
  return errorResponse('Not Found', 404)
}

const getAccountClaimLock = async (env, userSub) => {
  const claim = await env.DB.prepare(
    'SELECT target_sub, status FROM account_legacy_claims WHERE singleton = 1'
  ).first()
  return claim?.target_sub === userSub && ['in_progress', 'failed'].includes(claim.status)
}

const normalizeAccountRecord = (raw, sourceDevice) => {
  if (!raw || !ACCOUNT_RECORD_TYPES.has(raw.type) || typeof raw.id !== 'string' || !raw.id || raw.id.length > 255) return null
  const updatedAt = Number(raw.updatedAt)
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null
  if (raw.deleted !== true && (!raw.payload || typeof raw.payload !== 'object' || Array.isArray(raw.payload))) return null
  const payload = raw.deleted === true ? null : JSON.stringify(raw.payload)
  if (payload && payload.length > 256 * 1024) return null
  return {
    key: `${raw.type}:${raw.id}`,
    type: raw.type,
    id: raw.id,
    payload,
    deleted: raw.deleted === true ? 1 : 0,
    updatedAt: Math.floor(updatedAt),
    sourceDevice,
  }
}

const canonicalAccountRecord = row => ({
  type: row.record_type,
  id: row.record_id,
  payload: row.payload ? JSON.parse(row.payload) : null,
  deleted: row.deleted === 1,
  updatedAt: Number(row.updated_at),
  sourceDevice: row.source_device || '',
})

const applyAccountRecord = async (env, userSub, record) => {
  const existing = await env.DB.prepare(
    `SELECT record_type, record_id, payload, deleted, updated_at, source_device
     FROM account_sync_records WHERE user_sub = ? AND record_key = ?`
  ).bind(userSub, record.key).first()
  if (existing) {
    const existingUpdatedAt = Number(existing.updated_at)
    const existingDevice = existing.source_device || ''
    if (existingUpdatedAt > record.updatedAt ||
        (existingUpdatedAt === record.updatedAt && existingDevice >= record.sourceDevice)) {
      return { accepted: false, canonical: canonicalAccountRecord(existing) }
    }
  }

  const change = await env.DB.prepare(
    `INSERT INTO account_sync_changes (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(userSub, record.key, record.type, record.id, record.payload, record.deleted, record.updatedAt, record.sourceDevice).run()
  const revision = Number(change.meta?.last_row_id || 0)
  if (!revision) throw new Error('account_revision_unavailable')
  await env.DB.prepare(
    `INSERT INTO account_sync_records (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_sub, record_key) DO UPDATE SET
       record_type = excluded.record_type, record_id = excluded.record_id, payload = excluded.payload,
       deleted = excluded.deleted, updated_at = excluded.updated_at, source_device = excluded.source_device,
       revision = excluded.revision`
  ).bind(userSub, record.key, record.type, record.id, record.payload, record.deleted, record.updatedAt, record.sourceDevice, revision).run()
  return { accepted: true }
}

const getAccountRows = async (env, userSub) => {
  const result = await env.DB.prepare(
    `SELECT record_type, record_id, payload, deleted, updated_at, source_device, revision
     FROM account_sync_records WHERE user_sub = ? ORDER BY record_type, record_id`
  ).bind(userSub).all()
  return result.results || []
}

const getAccountSnapshot = async (env, userSub) => {
  const rows = await getAccountRows(env, userSub)
  const tasks = []
  const categories = []
  let settings = {}
  let settingsUpdatedAt = 0
  let cursor = 0
  for (const row of rows) {
    cursor = Math.max(cursor, Number(row.revision) || 0)
    if (row.deleted === 1 || !row.payload) continue
    let payload
    try { payload = JSON.parse(row.payload) } catch { continue }
    if (row.record_type === 'task' && payload?.id) tasks.push(payload)
    if (row.record_type === 'category' && payload?.id && payload?.name) categories.push(payload)
    if (row.record_type === 'settings' && row.record_id === 'app' && payload && typeof payload === 'object') {
      settings = payload
      settingsUpdatedAt = Number(row.updated_at) || 0
    }
  }
  const normalizedCategories = categories.filter(category => category.id !== 'default-starred')
  const defaults = [
    { id: 'default-work', name: '工作', color: '#3b82f6' },
    { id: 'default-life', name: '生活', color: '#10b981' },
    { id: 'default-learning', name: '学习', color: '#8b5cf6' },
  ]
  for (const category of defaults.reverse()) {
    if (!normalizedCategories.some(current => current.name === category.name)) normalizedCategories.unshift(category)
  }
  const defaultCategory = normalizedCategories.some(category => category.id === settings.defaultCategory)
    ? settings.defaultCategory : normalizedCategories[0]?.id || ''
  return {
    cursor,
    data: {
      tasks,
      categories: normalizedCategories,
      defaultCategory,
      hideCompleted: !!settings.hideCompleted,
      hideOverdue: !!settings.hideOverdue,
      showNoTimeLimitOnly: !!settings.showNoTimeLimitOnly,
      darkMode: !!settings.darkMode,
      weeklyGoalMinutes: settings.weeklyGoalMinutes,
      weeklyGoalAnchor: settings.weeklyGoalAnchor,
      syncSettingsUpdatedAt: settingsUpdatedAt,
    },
  }
}

const handleAccountIncrementalSync = async (request, env, user) => {
  if (await getAccountClaimLock(env, user.sub)) return errorResponse('账号数据迁移正在进行，请稍后重试', 423)
  const body = await request.json().catch(() => null)
  if (!body || typeof body.deviceId !== 'string' || !body.deviceId || body.deviceId.length > 160 ||
      !Number.isSafeInteger(body.cursor) || body.cursor < 0 || !Array.isArray(body.changes)) {
    return errorResponse('invalid sync request', 400)
  }
  const rejectedChanges = []
  for (const raw of body.changes.slice(0, MAX_ACCOUNT_CHANGES)) {
    const record = normalizeAccountRecord(raw, body.deviceId)
    if (!record) continue
    const applied = await applyAccountRecord(env, user.sub, record)
    if (!applied.accepted) rejectedChanges.push(applied.canonical)
  }

  const selected = await env.DB.prepare(
    `SELECT revision, record_type, record_id, payload, deleted, updated_at, source_device
     FROM account_sync_changes WHERE user_sub = ? AND revision > ? ORDER BY revision ASC LIMIT ?`
  ).bind(user.sub, body.cursor, MAX_ACCOUNT_CHANGES + 1).all()
  const rows = selected.results || []
  const hasMore = rows.length > MAX_ACCOUNT_CHANGES
  const changes = rows.slice(0, MAX_ACCOUNT_CHANGES).map(row => ({
    type: row.record_type,
    id: row.record_id,
    payload: row.payload ? JSON.parse(row.payload) : null,
    deleted: row.deleted === 1,
    updatedAt: Number(row.updated_at),
    sourceDevice: row.source_device || '',
  }))
  const latest = await env.DB.prepare(
    'SELECT COALESCE(MAX(revision), 0) AS cursor FROM account_sync_changes WHERE user_sub = ?'
  ).bind(user.sub).first()
  const cursor = hasMore ? Number(rows[MAX_ACCOUNT_CHANGES - 1].revision) : Number(latest?.cursor || body.cursor)
  return response({ changes, rejectedChanges, cursor, hasMore })
}

const getLegacyRecords = async env => {
  const current = await env.DB.prepare(
    `SELECT record_key, record_type, record_id, payload, deleted, updated_at, source_device
     FROM sync_records ORDER BY record_key`
  ).all()
  const records = []
  let source = 'sync_records'
  for (const row of current.results || []) {
    let payload = null
    if (row.deleted !== 1) {
      try { payload = JSON.parse(row.payload || 'null') } catch { throw new Error('legacy_record_malformed') }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('legacy_record_malformed')
    }
    records.push({
      type: row.record_type,
      id: String(row.record_id),
      payload,
      deleted: row.deleted === 1,
      updatedAt: Number(row.updated_at) || Date.now(),
      sourceDevice: String(row.source_device || 'legacy'),
    })
  }

  if (records.length === 0) {
    const legacy = await env.DB.prepare("SELECT value, updated_at FROM user_data WHERE key = 'full_sync'").first()
    if (legacy) {
      source = 'user_data.full_sync'
      let data
      try { data = JSON.parse(legacy.value) } catch { throw new Error('legacy_snapshot_malformed') }
      if (!data || typeof data !== 'object') throw new Error('legacy_snapshot_malformed')
      const fallback = Date.parse(legacy.updated_at || '') || Date.now()
      for (const task of Array.isArray(data.tasks) ? data.tasks : []) {
        if (task?.id) records.push({ type: 'task', id: String(task.id), payload: task, deleted: false, updatedAt: Number(task.updatedAt) || fallback, sourceDevice: 'legacy-full-sync' })
      }
      for (const category of Array.isArray(data.categories) ? data.categories : []) {
        if (category?.id) records.push({ type: 'category', id: String(category.id), payload: category, deleted: false, updatedAt: Number(category.updatedAt) || fallback, sourceDevice: 'legacy-full-sync' })
      }
      records.push({
        type: 'settings', id: 'app', deleted: false, sourceDevice: 'legacy-full-sync',
        updatedAt: Number(data.syncSettingsUpdatedAt) || fallback,
        payload: {
          defaultCategory: data.defaultCategory || '', hideCompleted: !!data.hideCompleted,
          hideOverdue: !!data.hideOverdue, showNoTimeLimitOnly: !!data.showNoTimeLimitOnly,
          darkMode: !!data.darkMode, weeklyGoalMinutes: data.weeklyGoalMinutes,
          weeklyGoalAnchor: data.weeklyGoalAnchor,
        },
      })
    }
  }

  if (!records.some(record => record.type === 'category' && !record.deleted)) {
    const legacyCategories = await env.DB.prepare("SELECT value, updated_at FROM user_data WHERE key = 'categories'").first()
    if (legacyCategories) {
      let categories
      try { categories = JSON.parse(legacyCategories.value) } catch { throw new Error('legacy_categories_malformed') }
      if (!Array.isArray(categories)) throw new Error('legacy_categories_malformed')
      const fallback = Date.parse(legacyCategories.updated_at || '') || Date.now()
      for (const category of categories) {
        if (category?.id && category?.name) records.push({ type: 'category', id: String(category.id), payload: category, deleted: false, updatedAt: Number(category.updatedAt) || fallback, sourceDevice: 'legacy-categories' })
      }
    }
  }

  const byKey = new Map()
  for (const record of records) {
    if (!ACCOUNT_RECORD_TYPES.has(record.type) || !record.id) throw new Error('legacy_record_malformed')
    byKey.set(`${record.type}:${record.id}`, record)
  }
  const sortedRecords = [...byKey.values()].sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`))
  const fingerprintSource = JSON.stringify(sortedRecords.map(record => [record.type, record.id, record.payload, record.deleted, record.updatedAt, record.sourceDevice]))
  return { records: sortedRecords, source, fingerprint: await sha256Hex(fingerprintSource) }
}

const legacyClaimCounts = records => records.reduce((counts, record) => {
  if (record.deleted) counts.tombstones++
  else if (record.type === 'task') counts.tasks++
  else if (record.type === 'category') counts.categories++
  else if (record.type === 'settings') counts.settings++
  return counts
}, { tasks: 0, categories: 0, settings: 0, tombstones: 0 })

const ensureLegacyClaimAdmin = (request, env, user) => {
  if (!env.LEGACY_CLAIM_GOOGLE_SUB) return errorResponse('旧数据认领未启用', 404)
  if (user.sub !== env.LEGACY_CLAIM_GOOGLE_SUB) return errorResponse('此 Google 账号无权认领旧数据', 403)
  return null
}

const handleLegacyClaimPreview = async (env, user) => {
  const existing = await env.DB.prepare(
    'SELECT target_sub, fingerprint, status, record_count FROM account_legacy_claims WHERE singleton = 1'
  ).first()
  if (existing && existing.target_sub !== user.sub) return errorResponse('旧数据已指派给另一个账号', 409)
  const snapshot = await getLegacyRecords(env)
  return response({
    source: snapshot.source,
    counts: legacyClaimCounts(snapshot.records),
    recordCount: snapshot.records.length,
    fingerprint: snapshot.fingerprint,
    claimStatus: existing?.status || 'not_started',
  })
}

const handleLegacyClaim = async (request, env, user) => {
  const body = await request.json().catch(() => ({}))
  if (body.backupConfirmed !== true || typeof body.expectedFingerprint !== 'string') {
    return errorResponse('请先备份 D1，并确认预览指纹', 400)
  }
  let snapshot
  try { snapshot = await getLegacyRecords(env) } catch (error) {
    return errorResponse(error.message || '无法读取旧数据', 422)
  }
  if (snapshot.records.length === 0) return errorResponse('没有可认领的旧同步数据', 409)
  if (snapshot.fingerprint !== body.expectedFingerprint) return errorResponse('旧数据在预览后发生变化，请重新预览并备份', 409)

  let claim = await env.DB.prepare(
    'SELECT target_sub, fingerprint, status FROM account_legacy_claims WHERE singleton = 1'
  ).first()
  if (claim && claim.target_sub !== user.sub) return errorResponse('旧数据已指派给另一个账号', 409)
  if (claim && claim.fingerprint !== snapshot.fingerprint) return errorResponse('旧数据与认领记录不一致，请联系管理员检查', 409)
  if (claim?.status === 'complete') return errorResponse('旧数据已认领；不会重复导入', 409)
  if (!claim) {
    await env.DB.prepare(
      `INSERT INTO account_legacy_claims (singleton, target_sub, fingerprint, status, record_count, started_at, completed_at)
       VALUES (1, ?, ?, 'in_progress', ?, ?, NULL)`
    ).bind(user.sub, snapshot.fingerprint, snapshot.records.length, Math.floor(Date.now() / 1000)).run()
  } else {
    await env.DB.prepare(
      `UPDATE account_legacy_claims SET status = 'in_progress', started_at = ?, completed_at = NULL
       WHERE singleton = 1 AND target_sub = ? AND fingerprint = ?`
    ).bind(Math.floor(Date.now() / 1000), user.sub, snapshot.fingerprint).run()
  }

  // Pause old global sync writes before taking the final source fingerprint.
  let finalSnapshot
  try { finalSnapshot = await getLegacyRecords(env) } catch (error) {
    return errorResponse(error.message || '无法读取旧数据', 422)
  }
  if (finalSnapshot.fingerprint !== snapshot.fingerprint) {
    await env.DB.prepare("UPDATE account_legacy_claims SET status = 'failed' WHERE singleton = 1 AND status = 'in_progress'").run()
    return errorResponse('旧数据在认领开始时发生变化；已暂停认领，请重新备份和预览', 409)
  }

  try {
    const existingRows = await env.DB.prepare(
      'SELECT record_key FROM account_sync_records WHERE user_sub = ?'
    ).bind(user.sub).all()
    const existingKeys = new Set((existingRows.results || []).map(row => row.record_key))
    const importable = snapshot.records.filter(record => !existingKeys.has(`${record.type}:${record.id}`))
    const sourceDevice = `legacy-claim:${snapshot.fingerprint}`
    for (let offset = 0; offset < importable.length; offset += 40) {
      const batch = importable.slice(offset, offset + 40)
      const changeResults = await env.DB.batch(batch.map(record => env.DB.prepare(
        `INSERT INTO account_sync_changes (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(user.sub, `${record.type}:${record.id}`, record.type, record.id,
        record.deleted ? null : JSON.stringify(record.payload), record.deleted ? 1 : 0,
        Math.floor(Number(record.updatedAt) || Date.now()), sourceDevice)))
      await env.DB.batch(batch.map((record, index) => {
        const revision = Number(changeResults[index]?.meta?.last_row_id || 0)
        if (!revision) throw new Error('account_revision_unavailable')
        return env.DB.prepare(
          `INSERT OR IGNORE INTO account_sync_records (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(user.sub, `${record.type}:${record.id}`, record.type, record.id,
          record.deleted ? null : JSON.stringify(record.payload), record.deleted ? 1 : 0,
          Math.floor(Number(record.updatedAt) || Date.now()), sourceDevice, revision)
      }))
    }
    await env.DB.prepare(
      `UPDATE account_legacy_claims SET status = 'complete', completed_at = ?
       WHERE singleton = 1 AND target_sub = ? AND fingerprint = ?`
    ).bind(Math.floor(Date.now() / 1000), user.sub, snapshot.fingerprint).run()
    return response({ ok: true, importedRecords: importable.length, preservedAccountRecords: snapshot.records.length - importable.length })
  } catch {
    return errorResponse('认领中断，数据仍被隔离。管理员可用相同预览指纹安全重试', 503)
  }
}

const handleLegacyClaimRoute = async (request, env, user) => {
  const denied = ensureLegacyClaimAdmin(request, env, user)
  if (denied) return denied
  if (request.method === 'GET') return handleLegacyClaimPreview(env, user)
  if (request.method === 'POST') return handleLegacyClaim(request, env, user)
  return errorResponse('Method Not Allowed', 405)
}

export const handleAccountRoute = async (request, env) => {
  const user = await authenticateAccount(request, env)
  if (!user) return errorResponse('登录已过期，请重新登录', 401)
  const { pathname } = new URL(request.url)

  if (pathname === '/api/admin/legacy-claim') return handleLegacyClaimRoute(request, env, user)
  if (await getAccountClaimLock(env, user.sub)) return errorResponse('账号数据迁移正在进行，请稍后重试', 423)

  if (pathname === '/api/account/snapshot' && request.method === 'GET') {
    return response(await getAccountSnapshot(env, user.sub))
  }

  if (pathname === '/api/account/sync/incremental' && request.method === 'POST') {
    return handleAccountIncrementalSync(request, env, user)
  }

  if (pathname === '/api/account/tasks' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT payload FROM account_sync_records WHERE user_sub = ? AND record_type = 'task' AND deleted = 0 ORDER BY updated_at ASC`
    ).bind(user.sub).all()
    const tasks = (rows.results || []).flatMap(row => {
      try { const task = JSON.parse(row.payload || 'null'); return task?.id ? [task] : [] } catch { return [] }
    })
    return response({ tasks })
  }

  if (pathname === '/api/account/categories' && request.method === 'GET') {
    const snapshot = await getAccountSnapshot(env, user.sub)
    return response({ categories: snapshot.data.categories, defaultCategory: snapshot.data.defaultCategory })
  }

  if (pathname === '/api/account/tasks' && request.method === 'POST') {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const duration = Number(body?.duration)
    const priority = ['high', 'medium', 'low'].includes(body?.priority) ? body.priority : 'medium'
    const dueDate = typeof body?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : ''
    if (!title || title.length > 1000 || !Number.isFinite(duration) || duration < 0 || duration > 100000) {
      return errorResponse('任务标题或预计时长无效', 400)
    }
    const now = Date.now()
    const task = {
      id: crypto.randomUUID(), title,
      description: typeof body.description === 'string' ? body.description.slice(0, 10000) : '',
      priority,
      category: typeof body.category === 'string' ? body.category.slice(0, 255) : '',
      dueDate,
      duration: Math.round(duration),
      noTimeLimit: body.noTimeLimit === true || !dueDate,
      completed: body.completed === true,
      completedAt: body.completed === true ? now : undefined,
      repeatType: 'none', repeatDays: [], repeatInterval: 1, completedDates: [],
      source: 'web', createdAt: now, updatedAt: now,
    }
    const record = normalizeAccountRecord({ type: 'task', id: task.id, payload: task, updatedAt: now, deleted: false }, `mobile-${crypto.randomUUID()}`)
    await applyAccountRecord(env, user.sub, record)
    return response({ id: task.id, ok: true }, 201)
  }

  return errorResponse('Not Found', 404)
}

export const shouldPauseLegacyWrites = async env => {
  try {
    const claim = await env.DB.prepare(
      "SELECT status FROM account_legacy_claims WHERE singleton = 1"
    ).first()
    return claim?.status === 'in_progress' || claim?.status === 'failed'
  } catch {
    // Existing legacy-only test/development databases may not have received
    // the additive account migration yet. Deployment must apply it first.
    return false
  }
}
