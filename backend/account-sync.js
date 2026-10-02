const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ACCOUNT_RECORD_TYPES = new Set(['task', 'category', 'settings'])
export const MAX_ACCOUNT_SYNC_CHANGES = 500

let cachedGoogleKeys = null
let cachedGoogleKeysUntil = 0

export class GoogleAuthError extends Error {
  constructor(message, status = 401) {
    super(message)
    this.name = 'GoogleAuthError'
    this.status = status
  }
}

const decodeBase64Url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

const decodeJwtPart = (value) => {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)))
  } catch {
    throw new GoogleAuthError('Google authorization is invalid')
  }
}

const getGoogleKeys = async (fetchImpl) => {
  if (cachedGoogleKeys && cachedGoogleKeysUntil > Date.now()) return cachedGoogleKeys
  const response = await fetchImpl(GOOGLE_JWKS_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new GoogleAuthError('Google identity verification is unavailable', 503)
  const body = await response.json()
  if (!Array.isArray(body.keys)) throw new GoogleAuthError('Google identity verification is unavailable', 503)
  const cacheControl = response.headers.get('Cache-Control') || ''
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300)
  cachedGoogleKeys = body.keys
  cachedGoogleKeysUntil = Date.now() + Math.max(60, Math.min(maxAge, 86400)) * 1000
  return cachedGoogleKeys
}

export const verifyGoogleIdToken = async (token, clientId, fetchImpl = fetch, now = Date.now(), expectedNonce = null) => {
  if (!clientId) throw new GoogleAuthError('Google sign-in is not configured', 503)
  if (typeof token !== 'string' || token.length > 8192) throw new GoogleAuthError('Google authorization is invalid')
  const parts = token.split('.')
  if (parts.length !== 3) throw new GoogleAuthError('Google authorization is invalid')

  const header = decodeJwtPart(parts[0])
  const claims = decodeJwtPart(parts[1])
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new GoogleAuthError('Google authorization is invalid')
  }
  const keys = await getGoogleKeys(fetchImpl)
  let jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'))
  if (!jwk) {
    cachedGoogleKeys = null
    cachedGoogleKeysUntil = 0
    jwk = (await getGoogleKeys(fetchImpl)).find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'))
  }
  if (!jwk) throw new GoogleAuthError('Google authorization is invalid')

  let validSignature = false
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    )
    const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    validSignature = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', publicKey, decodeBase64Url(parts[2]), signedContent
    )
  } catch {
    throw new GoogleAuthError('Google authorization is invalid')
  }
  if (!validSignature) throw new GoogleAuthError('Google authorization is invalid')

  const nowSeconds = Math.floor(now / 1000)
  const audienceMatches = claims.aud === clientId ||
    (Array.isArray(claims.aud) && claims.aud.includes(clientId))
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) ||
      !audienceMatches || (claims.azp && claims.azp !== clientId) ||
      (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) ||
      (expectedNonce !== null && claims.nonce !== expectedNonce) ||
      !Number.isFinite(claims.exp) || claims.exp <= nowSeconds - 30 ||
      !Number.isFinite(claims.iat) || claims.iat > nowSeconds + 60 ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > nowSeconds + 30)) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) {
    throw new GoogleAuthError('Google authorization is invalid')
  }
  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.slice(0, 320) : '',
    name: typeof claims.name === 'string' ? claims.name.slice(0, 200) : '',
  }
}

export const resolveGoogleIdentity = async (token, env, fetchImpl = fetch) => {
  if (typeof token !== 'string' || !token || token.length > 8192 || /\s/.test(token)) {
    throw new GoogleAuthError('Google authorization is required')
  }
  return verifyGoogleIdToken(token, env.GOOGLE_WEB_CLIENT_ID, fetchImpl)
}

export const getGoogleIdentityFromRequest = async (request, env, fetchImpl = fetch) => {
  const match = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)
  if (!match) throw new GoogleAuthError('Google authorization is required')
  return resolveGoogleIdentity(match[1], env, fetchImpl)
}

export const normalizeAccountSyncRecord = (raw, sourceDevice) => {
  if (!raw || !ACCOUNT_RECORD_TYPES.has(raw.type) || typeof raw.id !== 'string' || !raw.id || raw.id.length > 255) {
    return null
  }
  const updatedAt = Number(raw.updatedAt)
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null
  if (raw.deleted !== true && (!raw.payload || typeof raw.payload !== 'object' || Array.isArray(raw.payload))) return null
  const serializedPayload = raw.deleted === true ? null : JSON.stringify(raw.payload)
  if (serializedPayload && serializedPayload.length > 256_000) return null
  return {
    key: `${raw.type}:${raw.id}`,
    type: raw.type,
    id: raw.id,
    payload: serializedPayload,
    deleted: raw.deleted === true ? 1 : 0,
    updatedAt: Math.floor(updatedAt),
    sourceDevice,
  }
}

export const applyAccountSyncRecord = async (db, userSub, record, { onlyIfMissing = false } = {}) => {
  const recordGuard = onlyIfMissing
    ? `NOT EXISTS (
        SELECT 1 FROM account_sync_records AS existing
        WHERE existing.user_sub = ? AND existing.record_key = ?
      )`
    : `NOT EXISTS (
        SELECT 1 FROM account_sync_records AS existing
        WHERE existing.user_sub = ? AND existing.record_key = ?
          AND (existing.updated_at > ? OR
            (existing.updated_at = ? AND existing.source_device >= ?))
      )`
  const guardArgs = onlyIfMissing
    ? [userSub, record.key]
    : [userSub, record.key, record.updatedAt, record.updatedAt, record.sourceDevice]
  const results = await db.batch([
    db.prepare(
      `INSERT INTO account_sync_state (user_sub, revision) VALUES (?, 0)
       ON CONFLICT(user_sub) DO NOTHING`
    ).bind(userSub),
    db.prepare(
      `UPDATE account_sync_state SET revision = revision + 1
       WHERE user_sub = ? AND ${recordGuard}`
    ).bind(userSub, ...guardArgs),
    db.prepare(
      `INSERT INTO account_sync_changes
        (user_sub, revision, record_key, record_type, record_id, payload, deleted, updated_at, source_device)
       SELECT ?, account_sync_state.revision, ?, ?, ?, ?, ?, ?, ?
       FROM account_sync_state
       WHERE account_sync_state.user_sub = ? AND ${recordGuard}`
    ).bind(userSub, record.key, record.type, record.id, record.payload, record.deleted,
      record.updatedAt, record.sourceDevice, userSub, ...guardArgs),
    db.prepare(
      `INSERT INTO account_sync_records
        (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, account_sync_state.revision
       FROM account_sync_state
       WHERE account_sync_state.user_sub = ? AND ${recordGuard}
       ON CONFLICT(user_sub, record_key) DO UPDATE SET
        record_type = excluded.record_type, record_id = excluded.record_id,
        payload = excluded.payload, deleted = excluded.deleted, updated_at = excluded.updated_at,
        source_device = excluded.source_device, revision = excluded.revision`
    ).bind(userSub, record.key, record.type, record.id, record.payload, record.deleted,
      record.updatedAt, record.sourceDevice, userSub, ...guardArgs),
  ])

  if (Number(results?.[1]?.meta?.changes) > 0) return { accepted: true }

  const existing = await db.prepare(
    `SELECT record_type, record_id, payload, deleted, updated_at, source_device
     FROM account_sync_records WHERE user_sub = ? AND record_key = ?`
  ).bind(userSub, record.key).first()
  if (!existing) throw new Error('Unable to confirm account sync record outcome')
  return {
    accepted: false,
    canonical: {
      type: existing.record_type,
      id: existing.record_id,
      payload: existing.payload ? JSON.parse(existing.payload) : null,
      deleted: existing.deleted === 1,
      updatedAt: Number(existing.updated_at),
      sourceDevice: existing.source_device || '',
    },
  }
}

export const listAccountCategories = async (db, userSub) => {
  const { results } = await db.prepare(
    `SELECT payload FROM account_sync_records
     WHERE user_sub = ? AND record_type = 'category' AND deleted = 0
     ORDER BY updated_at ASC`
  ).bind(userSub).all()
  return results.map(row => {
    try { return JSON.parse(row.payload) } catch { return null }
  }).filter(category => category && typeof category.id === 'string' && typeof category.name === 'string')
}

const isSameTaskCreation = (rawPayload, requestedTask) => {
  let savedTask = rawPayload
  if (typeof savedTask === 'string') {
    try { savedTask = JSON.parse(savedTask) } catch { return false }
  }
  if (!savedTask || typeof savedTask !== 'object' || Array.isArray(savedTask)) return false
  return ['id', 'title', 'description', 'priority', 'category', 'dueDate', 'duration', 'completed', 'noTimeLimit']
    .every(field => savedTask[field] === requestedTask[field])
}

export const createAccountTaskRecord = async (db, userSub, body, now = Date.now()) => {
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 500) return { error: 'A task title of 1 to 500 characters is required', status: 400 }
  const clientTaskId = body?.clientTaskId
  if (clientTaskId !== undefined &&
      (typeof clientTaskId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientTaskId))) {
    return { error: 'Invalid client task ID', status: 400 }
  }
  const priority = ['high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium'
  const duration = Number(body.duration)
  if (!Number.isInteger(duration) || duration < 0 || duration > 1440) {
    return { error: 'Task duration must be between 0 and 1440 minutes', status: 400 }
  }
  const dueDate = typeof body.dueDate === 'string' ? body.dueDate : ''
  if (dueDate) {
    const match = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return { error: 'Invalid task date', status: 400 }
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) {
      return { error: 'Invalid task date', status: 400 }
    }
  }
  const task = {
    id: clientTaskId || crypto.randomUUID(), title,
    description: typeof body.description === 'string' ? body.description.slice(0, 5000) : '',
    priority,
    category: typeof body.category === 'string' ? body.category.slice(0, 255) : '',
    dueDate,
    duration,
    repeatType: 'none', repeatDays: [], repeatInterval: 1,
    completed: body.completed === true, completedDates: [],
    ...(body.completed === true ? { completedAt: now } : {}),
    createdAt: now, updatedAt: now,
    noTimeLimit: body.noTimeLimit === true,
  }
  const sourceDevice = typeof body.deviceId === 'string' && body.deviceId.length <= 128
    ? `mobile:${body.deviceId}`
    : `mobile:${crypto.randomUUID()}`
  if (clientTaskId) {
    const existing = await db.prepare(
      `SELECT record_type, record_id, payload, deleted
       FROM account_sync_records WHERE user_sub = ? AND record_key = ?`
    ).bind(userSub, `task:${task.id}`).first()
    if (existing) {
      if (Number(existing.deleted) === 1) return { previouslyDeleted: true, taskId: task.id }
      if (Number(existing.deleted) === 0 && isSameTaskCreation(existing.payload, task)) {
        let savedTask = existing.payload
        if (typeof savedTask === 'string') savedTask = JSON.parse(savedTask)
        return { task: savedTask, alreadyProcessed: true }
      }
      return { error: 'Task request ID conflicts with an existing task', status: 409 }
    }
  }
  const outcome = await applyAccountSyncRecord(db, userSub, normalizeAccountSyncRecord({
    type: 'task', id: task.id, payload: task, updatedAt: task.updatedAt,
  }, sourceDevice), { onlyIfMissing: !!clientTaskId })
  if (!outcome.accepted) {
    if (clientTaskId && outcome.canonical?.deleted) {
      return { previouslyDeleted: true, taskId: task.id }
    }
    if (clientTaskId && outcome.canonical && isSameTaskCreation(outcome.canonical.payload, task)) {
      return { task: outcome.canonical.payload, alreadyProcessed: true }
    }
    if (clientTaskId && outcome.canonical) return { error: 'Task request ID conflicts with an existing task', status: 409 }
    return { error: 'Could not safely add the task', status: 409 }
  }
  return { task }
}
