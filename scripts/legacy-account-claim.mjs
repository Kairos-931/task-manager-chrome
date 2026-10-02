import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

export const LEGACY_EXTENSION_SOURCE_ID = 'legacy-extension-sync-v1'
export const DEFAULT_WORKER_URL = 'https://taskmaster-api.yx9391.workers.dev'

const RECORD_TYPES = new Set(['task', 'category', 'settings'])
const SOURCE_RECORD_COLUMNS = 'record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision'
const STAGED_RECORD_COLUMNS = 'record_key, record_type, record_id, payload, deleted, updated_at, source_device, source_revision'

export class LegacyClaimBlockedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'LegacyClaimBlockedError'
  }
}

const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => value[key] !== undefined)
      .map(key => [key, stableValue(value[key])]))
  }
  return value
}

const stableJson = value => JSON.stringify(stableValue(value))
const sha256 = value => createHash('sha256').update(value).digest('hex')

const parsePayload = (value, label) => {
  let parsed
  try { parsed = typeof value === 'string' ? JSON.parse(value) : value } catch {
    throw new LegacyClaimBlockedError(`${label} contains invalid JSON`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LegacyClaimBlockedError(`${label} must be a JSON object`)
  }
  return stableValue(parsed)
}

const validTimestamp = (value, fallback, label) => {
  const timestamp = Number(value) || fallback
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new LegacyClaimBlockedError(`${label} has no reliable update time`)
  }
  return timestamp
}

const normalizedAccountRecord = row => ({
  recordKey: String(row.record_key),
  type: String(row.record_type),
  id: String(row.record_id),
  payload: Number(row.deleted) === 1 ? null : parsePayload(row.payload, 'A legacy sync record'),
  deleted: Number(row.deleted) === 1,
  updatedAt: Number(row.updated_at),
  sourceDevice: typeof row.source_device === 'string' ? row.source_device : '',
})

const accountRecordsHash = records => sha256(stableJson(records.map(normalizedAccountRecord)
  .sort((left, right) => left.recordKey.localeCompare(right.recordKey))))

export const buildLegacyClaimPlan = (fullSyncRow, syncRows) => {
  if (!fullSyncRow || typeof fullSyncRow.value !== 'string' || !Array.isArray(syncRows)) {
    throw new LegacyClaimBlockedError('Both the legacy full-sync snapshot and its incremental records are required')
  }

  const sourceUpdatedAt = Date.parse(fullSyncRow.updated_at || '')
  if (!Number.isSafeInteger(sourceUpdatedAt) || sourceUpdatedAt <= 0) {
    throw new LegacyClaimBlockedError('The legacy full-sync snapshot has no reliable version timestamp')
  }

  let fullSync
  try { fullSync = JSON.parse(fullSyncRow.value) } catch {
    throw new LegacyClaimBlockedError('The legacy full-sync snapshot is invalid JSON')
  }
  if (!fullSync || typeof fullSync !== 'object' || Array.isArray(fullSync) || !Array.isArray(fullSync.tasks)) {
    throw new LegacyClaimBlockedError('The legacy full-sync snapshot has an invalid task list')
  }
  if (!Array.isArray(fullSync.categories)) {
    throw new LegacyClaimBlockedError('The legacy full-sync snapshot has no verifiable category list')
  }

  const expected = new Map()
  const addExpected = (type, rawId, payload, updatedAt) => {
    const id = String(rawId || '')
    if (!id || id.length > 255) throw new LegacyClaimBlockedError('The legacy snapshot contains an invalid record ID')
    const key = `${type}:${id}`
    if (expected.has(key)) throw new LegacyClaimBlockedError('The legacy snapshot contains duplicate record IDs')
    expected.set(key, {
      recordKey: key,
      type,
      id,
      payload: stableValue(payload),
      deleted: false,
      updatedAt: validTimestamp(updatedAt, sourceUpdatedAt, 'A legacy snapshot record'),
    })
  }

  for (const task of fullSync.tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      throw new LegacyClaimBlockedError('The legacy snapshot contains an invalid task')
    }
    addExpected('task', task.id, task, task.updatedAt)
  }
  for (const category of Array.isArray(fullSync.categories) ? fullSync.categories : []) {
    if (!category || typeof category !== 'object' || Array.isArray(category)) {
      throw new LegacyClaimBlockedError('The legacy snapshot contains an invalid category')
    }
    addExpected('category', category.id, category, category.updatedAt)
  }

  const settingsPayload = {
    defaultCategory: fullSync.defaultCategory || '',
    hideCompleted: !!fullSync.hideCompleted,
    hideOverdue: !!fullSync.hideOverdue,
    showNoTimeLimitOnly: !!fullSync.showNoTimeLimitOnly,
    darkMode: !!fullSync.darkMode,
    weeklyGoalMinutes: fullSync.weeklyGoalMinutes,
    weeklyGoalAnchor: fullSync.weeklyGoalAnchor,
  }
  addExpected('settings', 'app', settingsPayload, fullSync.syncSettingsUpdatedAt)

  const actual = new Map()
  const sortedSourceRows = [...syncRows].sort((left, right) => String(left.record_key).localeCompare(String(right.record_key)))
  for (const row of sortedSourceRows) {
    const type = String(row.record_type || '')
    const id = String(row.record_id || '')
    const key = String(row.record_key || '')
    const revision = Number(row.revision)
    const deleted = Number(row.deleted)
    const updatedAt = Number(row.updated_at)
    if (!RECORD_TYPES.has(type) || !id || id.length > 255 || key !== `${type}:${id}` ||
        !Number.isSafeInteger(revision) || revision < 0 || ![0, 1].includes(deleted) ||
        !Number.isSafeInteger(updatedAt) || updatedAt <= 0 || actual.has(key)) {
      throw new LegacyClaimBlockedError('The legacy incremental records are invalid or incomplete')
    }
    const payload = deleted === 1 ? null : parsePayload(row.payload, 'A legacy incremental record')
    actual.set(key, {
      recordKey: key, type, id, payload, deleted: deleted === 1, updatedAt,
      sourceDevice: typeof row.source_device === 'string' ? row.source_device : '',
    })
  }

  for (const [key, expectedRecord] of expected) {
    const actualRecord = actual.get(key)
    if (!actualRecord || actualRecord.deleted || actualRecord.updatedAt !== expectedRecord.updatedAt ||
        stableJson(actualRecord.payload) !== stableJson(expectedRecord.payload)) {
      throw new LegacyClaimBlockedError('The legacy full-sync snapshot and incremental records do not match')
    }
  }
  for (const [key, actualRecord] of actual) {
    if (actualRecord.deleted) {
      if (expected.has(key)) {
        throw new LegacyClaimBlockedError('The legacy snapshot conflicts with a deletion record')
      }
    } else if (!expected.has(key)) {
      throw new LegacyClaimBlockedError('The legacy incremental records contain data missing from the full-sync snapshot')
    }
  }

  const records = [...actual.values()].sort((left, right) => left.recordKey.localeCompare(right.recordKey))
  if (records.length === 0) throw new LegacyClaimBlockedError('There is no legacy extension data to claim')
  const sourceSnapshotHash = sha256(stableJson({
    fullSync: { value: fullSyncRow.value, updatedAt: fullSyncRow.updated_at },
    syncRecords: sortedSourceRows,
  }))
  const recordsHash = accountRecordsHash(sortedSourceRows)
  return {
    fullSyncRow,
    sourceRows: sortedSourceRows,
    records,
    sourceSnapshotHash,
    recordsHash,
    counts: {
      recordCount: records.length,
      tasks: records.filter(record => record.type === 'task' && !record.deleted).length,
      categories: records.filter(record => record.type === 'category' && !record.deleted).length,
      settings: records.filter(record => record.type === 'settings' && !record.deleted).length,
      tombstones: records.filter(record => record.deleted).length,
    },
  }
}

const countValue = rows => Number(rows?.[0]?.count || 0)

const loadClaimSnapshot = async (db, targetSub, operationId) => {
  const [fullSyncRows, sourceRows, targetRows, targetStateRows, targetChangeCountRows,
    sourceClaimRows, operationClaimRows, targetClaimRows, categoryRows, pendingRows, telegramRows] = await Promise.all([
    db.query("SELECT value, updated_at FROM user_data WHERE key = 'full_sync'"),
    db.query(`SELECT ${SOURCE_RECORD_COLUMNS} FROM sync_records ORDER BY record_key`),
    db.query(`SELECT record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision
      FROM account_sync_records WHERE user_sub = ? ORDER BY record_key`, [targetSub]),
    db.query('SELECT revision FROM account_sync_state WHERE user_sub = ?', [targetSub]),
    db.query('SELECT COUNT(*) AS count FROM account_sync_changes WHERE user_sub = ?', [targetSub]),
    db.query('SELECT * FROM account_data_claims WHERE source_id = ?', [LEGACY_EXTENSION_SOURCE_ID]),
    db.query('SELECT * FROM account_data_claims WHERE operation_id = ?', [operationId]),
    db.query('SELECT * FROM account_data_claims WHERE target_sub = ?', [targetSub]),
    db.query("SELECT value FROM user_data WHERE key = 'categories'"),
    db.query('SELECT COUNT(*) AS count FROM pending_tasks'),
    db.query('SELECT COUNT(*) AS count FROM telegram_users'),
  ])
  let independentCategoryCount = 0
  let independentCategoriesUnreadable = false
  if (categoryRows[0]?.value) {
    try {
      const categories = JSON.parse(categoryRows[0].value)
      if (Array.isArray(categories)) independentCategoryCount = categories.length
      else independentCategoriesUnreadable = true
    } catch { independentCategoriesUnreadable = true }
  }
  return {
    fullSyncRow: fullSyncRows[0] || null,
    sourceRows,
    targetRows,
    targetRevision: Number(targetStateRows[0]?.revision || 0),
    targetChangeCount: countValue(targetChangeCountRows),
    sourceClaim: sourceClaimRows[0] || null,
    operationClaim: operationClaimRows[0] || null,
    targetClaims: targetClaimRows,
    excludedCounts: {
      independentCategories: independentCategoryCount,
      independentCategoriesUnreadable,
      pendingTasks: countValue(pendingRows),
      telegramBindings: countValue(telegramRows),
    },
  }
}

export const previewLegacyClaim = async ({ db, targetSub, operationId }) => {
  const snapshot = await loadClaimSnapshot(db, targetSub, operationId)
  const blockers = []
  let plan = null
  try {
    plan = buildLegacyClaimPlan(snapshot.fullSyncRow, snapshot.sourceRows)
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : 'Legacy source data cannot be verified')
  }
  if (snapshot.targetRows.length > 0 || snapshot.targetChangeCount > 0 || snapshot.targetRevision > 0 || snapshot.targetClaims.length > 0) {
    blockers.push('The target Google account already contains records or claim history')
  }
  if (snapshot.sourceClaim) blockers.push('This legacy source already has a permanent claim record')
  if (snapshot.operationClaim) blockers.push('This operation ID is already in use')
  return {
    eligible: blockers.length === 0,
    blockers,
    targetSub,
    operationId,
    sourceSnapshotHash: plan?.sourceSnapshotHash || null,
    recordsHash: plan?.recordsHash || null,
    counts: plan?.counts || { recordCount: 0, tasks: 0, categories: 0, settings: 0, tombstones: 0 },
    targetRecords: snapshot.targetRows.length,
    targetRevision: snapshot.targetRevision,
    excludedCounts: snapshot.excludedCounts,
    _plan: plan,
    _snapshot: snapshot,
  }
}

export const createD1ApiClient = ({ accountId, databaseId, apiToken, fetchImpl = fetch }) => {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`
  const request = async body => {
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })
    } catch {
      throw new Error('Cloudflare D1 could not be reached')
    }
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.success !== true) {
      throw new Error(`Cloudflare D1 request failed (HTTP ${response.status})`)
    }
    return result.result || []
  }
  return {
    async query(sql, params = []) {
      const results = await request({ sql, params })
      return results[0]?.results || []
    },
    batch(statements) {
      return request({ batch: statements })
    },
  }
}

export const verifyTargetGoogleIdentity = async (token, _workerUrl = DEFAULT_WORKER_URL, fetchImpl = fetch) => {
  if (typeof token !== 'string' || !token || /\s/.test(token)) {
    throw new Error('TASKMASTER_GOOGLE_ACCESS_TOKEN is required for verified account identity')
  }
  let response
  try {
    response = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new Error('Google could not verify the target account')
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok || typeof result.sub !== 'string' || !result.sub) {
    throw new Error(`Google rejected the target Google identity (HTTP ${response.status})`)
  }
  return { sub: result.sub }
}

const sourceVersionGuardSql = `
  EXISTS (
    SELECT 1 FROM user_data AS source_full_sync
    JOIN account_data_claim_staging AS staged_full_sync
      ON staged_full_sync.operation_id = ? AND staged_full_sync.row_type = 'full_sync'
     AND staged_full_sync.full_sync_value = source_full_sync.value
     AND staged_full_sync.full_sync_updated_at = source_full_sync.updated_at
    WHERE source_full_sync.key = 'full_sync'
  )
  AND NOT EXISTS (
    SELECT ${SOURCE_RECORD_COLUMNS} FROM sync_records
    EXCEPT
    SELECT ${STAGED_RECORD_COLUMNS}
    FROM account_data_claim_staging
    WHERE operation_id = ? AND row_type = 'sync_record'
  )
  AND NOT EXISTS (
    SELECT ${STAGED_RECORD_COLUMNS}
    FROM account_data_claim_staging
    WHERE operation_id = ? AND row_type = 'sync_record'
    EXCEPT
    SELECT ${SOURCE_RECORD_COLUMNS} FROM sync_records
  )
  AND (SELECT COUNT(*) FROM account_data_claim_staging
       WHERE operation_id = ? AND row_type = 'sync_record') = ?
`

const claimStatements = ({ preview, operationId, targetSub, operatorId, ownerConfirmationRef,
  backupReference, backupSha256, claimedAt }) => {
  const plan = preview._plan
  const stage = [{
    sql: `INSERT INTO account_data_claim_staging
      (operation_id, row_type, record_key, full_sync_value, full_sync_updated_at)
      VALUES (?, 'full_sync', '', ?, ?)`,
    params: [operationId, plan.fullSyncRow.value, plan.fullSyncRow.updated_at],
  }, ...plan.sourceRows.map(row => ({
    sql: `INSERT INTO account_data_claim_staging
      (operation_id, row_type, record_key, record_type, record_id, payload, deleted, updated_at, source_device, source_revision)
      VALUES (?, 'sync_record', ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [operationId, row.record_key, row.record_type, row.record_id, row.payload,
      Number(row.deleted), Number(row.updated_at), row.source_device || '', Number(row.revision)],
  }))]

  const claimSql = `INSERT INTO account_data_claims
    (operation_id, source_id, source_snapshot_hash, records_hash, target_sub, operator_id,
     owner_confirmation_ref, backup_reference, backup_sha256, record_count, imported_revision, status, claimed_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applying', ?
    WHERE NOT EXISTS (SELECT 1 FROM account_data_claims WHERE source_id = ? OR operation_id = ?)
      AND NOT EXISTS (SELECT 1 FROM account_sync_records WHERE user_sub = ?)
      AND NOT EXISTS (SELECT 1 FROM account_sync_changes WHERE user_sub = ?)
      AND COALESCE((SELECT revision FROM account_sync_state WHERE user_sub = ?), 0) = 0
      AND ${sourceVersionGuardSql}`
  const claimParams = [operationId, LEGACY_EXTENSION_SOURCE_ID, plan.sourceSnapshotHash,
    plan.recordsHash, targetSub, operatorId, ownerConfirmationRef, backupReference,
    backupSha256, plan.records.length, plan.records.length, claimedAt,
    LEGACY_EXTENSION_SOURCE_ID, operationId, targetSub, targetSub, targetSub,
    operationId, operationId, operationId, operationId, plan.sourceRows.length]
  const claimIndex = stage.length

  const statements = [...stage, { sql: claimSql, params: claimParams }, {
    sql: `INSERT INTO account_sync_state (user_sub, revision)
      SELECT ?, 0 WHERE EXISTS (SELECT 1 FROM account_data_claims WHERE operation_id = ? AND status = 'applying')
      ON CONFLICT(user_sub) DO NOTHING`,
    params: [targetSub, operationId],
  }, {
    sql: `INSERT INTO account_sync_records
      (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision)
      SELECT ?, record_key, record_type, record_id, payload, deleted, updated_at, source_device,
        ROW_NUMBER() OVER (ORDER BY record_key)
      FROM account_data_claim_staging
      WHERE operation_id = ? AND row_type = 'sync_record'
        AND EXISTS (SELECT 1 FROM account_data_claims WHERE operation_id = ? AND status = 'applying')`,
    params: [targetSub, operationId, operationId],
  }, {
    sql: `INSERT INTO account_sync_changes
      (user_sub, revision, record_key, record_type, record_id, payload, deleted, updated_at, source_device)
      SELECT ?, ROW_NUMBER() OVER (ORDER BY record_key), record_key, record_type, record_id,
        payload, deleted, updated_at, source_device
      FROM account_data_claim_staging
      WHERE operation_id = ? AND row_type = 'sync_record'
        AND EXISTS (SELECT 1 FROM account_data_claims WHERE operation_id = ? AND status = 'applying')`,
    params: [targetSub, operationId, operationId],
  }, {
    sql: `UPDATE account_sync_state
      SET revision = (SELECT COUNT(*) FROM account_data_claim_staging
        WHERE operation_id = ? AND row_type = 'sync_record')
      WHERE user_sub = ? AND EXISTS (
        SELECT 1 FROM account_data_claims WHERE operation_id = ? AND status = 'applying')`,
    params: [operationId, targetSub, operationId],
  }, {
    sql: `UPDATE account_data_claims SET status = 'applied'
      WHERE operation_id = ? AND status = 'applying'
        AND (SELECT revision FROM account_sync_state WHERE user_sub = target_sub) = imported_revision`,
    params: [operationId],
  }, {
    sql: 'DELETE FROM account_data_claim_staging WHERE operation_id = ?',
    params: [operationId],
  }]
  return { statements, claimIndex }
}

const writeSnapshotBackup = async (preview, backupPath) => {
  if (!backupPath) throw new Error('--backup-file is required before apply')
  const absolutePath = resolve(backupPath)
  await mkdir(dirname(absolutePath), { recursive: true })
  const contents = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceId: LEGACY_EXTENSION_SOURCE_ID,
    sourceSnapshotHash: preview.sourceSnapshotHash,
    fullSync: preview._snapshot.fullSyncRow,
    syncRecords: preview._snapshot.sourceRows,
    targetSub: preview.targetSub,
    targetRecords: preview._snapshot.targetRows,
    targetRevision: preview._snapshot.targetRevision,
  }, null, 2)
  let handle
  try {
    handle = await open(absolutePath, 'wx', 0o600)
    await handle.writeFile(contents, 'utf8')
    await handle.sync()
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('Backup file already exists; choose a new path')
    throw new Error('Could not create the local claim backup')
  } finally {
    await handle?.close()
  }
  return { path: absolutePath, sha256: sha256(contents) }
}

const claimBySourceOrOperation = async (db, operationId) => {
  const [sourceRows, operationRows] = await Promise.all([
    db.query('SELECT * FROM account_data_claims WHERE source_id = ?', [LEGACY_EXTENSION_SOURCE_ID]),
    db.query('SELECT * FROM account_data_claims WHERE operation_id = ?', [operationId]),
  ])
  return { sourceClaim: sourceRows[0] || null, operationClaim: operationRows[0] || null }
}

const verifyTargetAfterClaim = async (db, targetSub, operationId, plan) => {
  const [rows, stateRows, claimRows] = await Promise.all([
    db.query(`SELECT record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision
      FROM account_sync_records WHERE user_sub = ? ORDER BY record_key`, [targetSub]),
    db.query('SELECT revision FROM account_sync_state WHERE user_sub = ?', [targetSub]),
    db.query('SELECT status FROM account_data_claims WHERE operation_id = ?', [operationId]),
  ])
  if (rows.length !== plan.records.length || accountRecordsHash(rows) !== plan.recordsHash ||
      Number(stateRows[0]?.revision) !== plan.records.length || claimRows[0]?.status !== 'applied') {
    throw new Error(`Claim ${operationId} committed but verification failed; preserve the source and inspect this operation ID`)
  }
  return rows
}

export const applyLegacyClaim = async ({ db, verifyTargetToken, googleToken, operationId = randomUUID(),
  expectedSourceHash, operatorId, ownerConfirmationRef, backupReference, backupFile,
  sourceWritesPaused = false, production = false, productionAuthorized = false,
  confirmOwner, backupWriter = writeSnapshotBackup }) => {
  if (production && !productionAuthorized) throw new Error('Production writes require separate explicit authorization')
  if (!sourceWritesPaused) throw new Error('Confirm that legacy writes are paused before applying a claim')
  if (!operationId || operationId.length > 128) throw new Error('A valid operation ID is required')
  if (!operatorId || operatorId.length > 200) throw new Error('An operator ID is required for the audit record')
  if (!ownerConfirmationRef || ownerConfirmationRef.length > 500) throw new Error('An actual owner-confirmation reference is required')
  if (!backupReference || backupReference.length > 500) throw new Error('A pre-write D1 backup reference is required')
  if (typeof expectedSourceHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedSourceHash)) {
    throw new Error('Run a dry-run first and provide its source SHA-256')
  }
  if (typeof verifyTargetToken !== 'function') throw new Error('A Worker identity verifier is required')
  const identity = await verifyTargetToken(googleToken)
  if (typeof identity?.sub !== 'string' || !identity.sub) throw new Error('The target Google identity was not verified')
  const targetSub = identity.sub

  const prior = await claimBySourceOrOperation(db, operationId)
  if (prior.sourceClaim || prior.operationClaim) {
    const claim = prior.operationClaim || prior.sourceClaim
    if (claim.operation_id === operationId && claim.source_id === LEGACY_EXTENSION_SOURCE_ID &&
        claim.target_sub === targetSub && claim.source_snapshot_hash === expectedSourceHash) {
      if (claim.status === 'applied') return { status: 'already_applied', operationId, targetSub }
      if (claim.status === 'rolled_back') return { status: 'already_rolled_back', operationId, targetSub }
      throw new LegacyClaimBlockedError('This claim has an incomplete state and requires operator inspection')
    }
    throw new LegacyClaimBlockedError('The source or operation ID is already bound to a different claim')
  }

  const initialPreview = await previewLegacyClaim({ db, targetSub, operationId })
  if (!initialPreview.eligible) throw new LegacyClaimBlockedError(initialPreview.blockers.join('; '))
  if (initialPreview.sourceSnapshotHash !== expectedSourceHash) {
    throw new LegacyClaimBlockedError('The source changed after dry-run; create a new dry-run before applying')
  }
  if (typeof confirmOwner !== 'function' || !(await confirmOwner({
    sourceSnapshotHash: expectedSourceHash,
    targetSub,
    operationId,
  }))) {
    throw new LegacyClaimBlockedError('The actual data owner did not confirm this exact source and target')
  }

  const backup = await backupWriter(initialPreview, backupFile)
  const latestPreview = await previewLegacyClaim({ db, targetSub, operationId })
  if (!latestPreview.eligible || latestPreview.sourceSnapshotHash !== expectedSourceHash) {
    throw new LegacyClaimBlockedError('The source or target changed before apply; no account data was written')
  }

  const { statements, claimIndex } = claimStatements({
    preview: latestPreview,
    operationId,
    targetSub,
    operatorId,
    ownerConfirmationRef,
    backupReference,
    backupSha256: backup.sha256,
    claimedAt: new Date().toISOString(),
  })
  const results = await db.batch(statements)
  if (Number(results?.[claimIndex]?.meta?.changes) !== 1) {
    throw new LegacyClaimBlockedError('Source or target version changed at commit; no claim was applied')
  }
  await verifyTargetAfterClaim(db, targetSub, operationId, latestPreview._plan)
  return {
    status: 'applied',
    operationId,
    targetSub,
    sourceSnapshotHash: expectedSourceHash,
    recordsHash: latestPreview.recordsHash,
    counts: latestPreview.counts,
    backup: { path: backup.path, sha256: backup.sha256 },
  }
}

const rollbackStatements = ({ operationId, claim, now, operatorId }) => {
  const targetSub = claim.target_sub
  const count = Number(claim.record_count)
  const revision = Number(claim.imported_revision)
  const rollbackDevice = `claim-rollback:${operationId}`
  return {
    rollbackDevice,
    statements: [{
      sql: `UPDATE account_sync_state SET revision = revision + ?
        WHERE user_sub = ? AND revision = ?
          AND (SELECT COUNT(*) FROM account_sync_records WHERE user_sub = ?) = ?
          AND NOT EXISTS (SELECT 1 FROM account_sync_records WHERE user_sub = ? AND revision > ?)`,
      params: [count, targetSub, revision, targetSub, count, targetSub, revision],
    }, {
      sql: `UPDATE account_sync_records SET payload = NULL, deleted = 1, updated_at = ?, source_device = ?,
        revision = ? + 1 + (SELECT COUNT(*) FROM account_sync_records AS earlier
          WHERE earlier.user_sub = account_sync_records.user_sub
            AND earlier.record_key < account_sync_records.record_key)
        WHERE user_sub = ?
          AND (SELECT revision FROM account_sync_state WHERE user_sub = ?) = ?
          AND (SELECT COUNT(*) FROM account_sync_records WHERE user_sub = ?) = ?
          AND NOT EXISTS (SELECT 1 FROM account_sync_records WHERE user_sub = ? AND revision > ?)`,
      params: [now, rollbackDevice, revision, targetSub, targetSub, revision + count,
        targetSub, count, targetSub, revision],
    }, {
      sql: `INSERT INTO account_sync_changes
        (user_sub, revision, record_key, record_type, record_id, payload, deleted, updated_at, source_device)
        SELECT user_sub, revision, record_key, record_type, record_id, NULL, 1, updated_at, source_device
        FROM account_sync_records
        WHERE user_sub = ? AND source_device = ? AND revision > ? AND deleted = 1`,
      params: [targetSub, rollbackDevice, revision],
    }, {
      sql: `UPDATE account_data_claims SET status = 'rolled_back', rollback_operator_id = ?,
        rolled_back_at = ?, rollback_revision = ?
        WHERE operation_id = ? AND status = 'applied'
          AND (SELECT revision FROM account_sync_state WHERE user_sub = target_sub) = ?
          AND (SELECT COUNT(*) FROM account_sync_records WHERE user_sub = target_sub
            AND source_device = ? AND revision > ? AND deleted = 1) = ?`,
      params: [operatorId, now, revision + count, operationId, revision + count,
        rollbackDevice, revision, count],
    }],
  }
}

export const rollbackLegacyClaim = async ({ db, operationId, operatorId,
  production = false, productionAuthorized = false, now = new Date().toISOString() }) => {
  if (production && !productionAuthorized) throw new Error('Production rollback requires separate explicit authorization')
  if (!operationId) throw new Error('A claim operation ID is required')
  if (!operatorId || operatorId.length > 200) throw new Error('An operator ID is required for the rollback audit')
  const claimRows = await db.query('SELECT * FROM account_data_claims WHERE operation_id = ?', [operationId])
  const claim = claimRows[0]
  if (!claim) throw new LegacyClaimBlockedError('The claim operation does not exist')
  if (claim.status === 'rolled_back') return { status: 'already_rolled_back', operationId, targetSub: claim.target_sub }
  if (claim.status !== 'applied') throw new LegacyClaimBlockedError('The claim is not in a rollback-ready state')

  const targetSub = claim.target_sub
  const [stateRows, records] = await Promise.all([
    db.query('SELECT revision FROM account_sync_state WHERE user_sub = ?', [targetSub]),
    db.query(`SELECT record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision
      FROM account_sync_records WHERE user_sub = ? ORDER BY record_key`, [targetSub]),
  ])
  const count = Number(claim.record_count)
  const importedRevision = Number(claim.imported_revision)
  if (Number(stateRows[0]?.revision) !== importedRevision || records.length !== count ||
      accountRecordsHash(records) !== claim.records_hash) {
    throw new LegacyClaimBlockedError('Target data changed after claim; rollback refused to protect user data')
  }

  const { statements, rollbackDevice } = rollbackStatements({ operationId, claim, now, operatorId })
  const results = await db.batch(statements)
  if (Number(results?.[1]?.meta?.changes) !== count || Number(results?.[3]?.meta?.changes) !== 1) {
    throw new LegacyClaimBlockedError('Target changed during rollback; no destructive rollback was accepted')
  }
  const [finalStateRows, finalRows, finalClaimRows] = await Promise.all([
    db.query('SELECT revision FROM account_sync_state WHERE user_sub = ?', [targetSub]),
    db.query(`SELECT record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision
      FROM account_sync_records WHERE user_sub = ? ORDER BY record_key`, [targetSub]),
    db.query('SELECT status FROM account_data_claims WHERE operation_id = ?', [operationId]),
  ])
  if (Number(finalStateRows[0]?.revision) !== importedRevision + count || finalRows.length !== count ||
      finalRows.some(row => Number(row.deleted) !== 1 || row.source_device !== rollbackDevice) ||
      finalClaimRows[0]?.status !== 'rolled_back') {
    throw new Error(`Rollback ${operationId} committed but verification failed; inspect this operation ID`)
  }
  return { status: 'rolled_back', operationId, targetSub, tombstones: count, revision: importedRevision + count }
}

export const summarizeLegacyClaim = preview => ({
  status: preview.eligible ? 'dry-run' : 'blocked',
  eligible: preview.eligible,
  operationId: preview.operationId,
  targetSub: preview.targetSub,
  sourceSnapshotHash: preview.sourceSnapshotHash,
  recordsHash: preview.recordsHash,
  counts: preview.counts,
  targetRecords: preview.targetRecords,
  targetRevision: preview.targetRevision,
  excludedCounts: preview.excludedCounts,
  blockers: preview.blockers,
})

const parseArgs = argv => {
  const args = { apply: false, legacyWritesPaused: false, productionAuthorized: false }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--help') args.help = true
    else if (value === '--apply') args.apply = true
    else if (value === '--legacy-writes-paused') args.legacyWritesPaused = true
    else if (value === '--production-authorized') args.productionAuthorized = true
    else if (value.startsWith('--')) {
      const name = value.slice(2)
      if (!['operation-id', 'rollback', 'environment', 'source-sha256', 'operator',
        'owner-confirmation-ref', 'backup-reference', 'backup-file',
        'production-authorization-ref'].includes(name)) {
        throw new Error(`Unknown option: ${value}`)
      }
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new Error(`Missing value for ${value}`)
      args[name] = next
      index += 1
    } else throw new Error(`Unexpected argument: ${value}`)
  }
  args.operationId ||= randomUUID()
  args.environment ||= 'non-production'
  if (!['non-production', 'production'].includes(args.environment)) {
    throw new Error('--environment must be non-production or production')
  }
  return args
}

const askExactConfirmation = async expected => {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Apply requires an interactive owner confirmation in a terminal')
  const terminal = createInterface({ input: stdin, output: stdout })
  try {
    const answer = await terminal.question(`Type exactly to confirm: ${expected}\n> `)
    return answer === expected
  } finally {
    terminal.close()
  }
}

const usage = `Legacy Google account claim tool

Dry-run (default):
  node scripts/legacy-account-claim.mjs --operation-id <uuid>

Apply to a non-production database:
  node scripts/legacy-account-claim.mjs --apply --environment non-production --operation-id <uuid> \\
    --source-sha256 <dry-run-hash> --operator <operator-id> \\
    --owner-confirmation-ref <owner-approval-reference> --backup-reference <D1-backup-reference> \\
    --backup-file <private-local-backup.json> --legacy-writes-paused

Rollback:
  node scripts/legacy-account-claim.mjs --rollback <operation-id> --operator <operator-id>

Production requires --production-authorized, a production authorization reference, and a separate exact terminal confirmation.
Credentials are read only from CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, TASKMASTER_CLAIM_DATABASE_ID,
TASKMASTER_GOOGLE_ACCESS_TOKEN, and optional TASKMASTER_WORKER_URL. Never pass tokens as command-line arguments.`

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    stdout.write(`${usage}\n`)
    return
  }
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const databaseId = process.env.TASKMASTER_CLAIM_DATABASE_ID
  if (!accountId || !apiToken || !databaseId) {
    throw new Error('Set Cloudflare account, API token, and explicitly selected D1 database ID in environment variables')
  }
  const db = createD1ApiClient({ accountId, databaseId, apiToken })
  const production = args.environment === 'production'
  if (production && (!args.productionAuthorized || !args['production-authorization-ref'])) {
    throw new Error('Production requires separate user authorization and --production-authorization-ref')
  }

  if (args.rollback) {
    const result = await rollbackLegacyClaim({
      db,
      operationId: args.rollback,
      operatorId: args.operator,
      production,
      productionAuthorized: args.productionAuthorized,
    })
    stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  const googleToken = process.env.TASKMASTER_GOOGLE_ACCESS_TOKEN
  const identity = await verifyTargetGoogleIdentity(googleToken, process.env.TASKMASTER_WORKER_URL || DEFAULT_WORKER_URL)
  const preview = await previewLegacyClaim({ db, targetSub: identity.sub, operationId: args.operationId })
  stdout.write(`${JSON.stringify(summarizeLegacyClaim(preview), null, 2)}\n`)
  if (!args.apply) return
  if (!preview.eligible) throw new LegacyClaimBlockedError(preview.blockers.join('; '))

  const result = await applyLegacyClaim({
    db,
    verifyTargetToken: token => verifyTargetGoogleIdentity(token, process.env.TASKMASTER_WORKER_URL || DEFAULT_WORKER_URL),
    googleToken,
    operationId: args.operationId,
    expectedSourceHash: args['source-sha256'],
    operatorId: args.operator,
    ownerConfirmationRef: args['owner-confirmation-ref'],
    backupReference: args['backup-reference'],
    backupFile: args['backup-file'],
    sourceWritesPaused: args.legacyWritesPaused,
    production,
    productionAuthorized: args.productionAuthorized,
    confirmOwner: ({ sourceSnapshotHash, targetSub }) => askExactConfirmation(
      `I AM THE DATA OWNER AND CONFIRM ${sourceSnapshotHash} FOR GOOGLE SUB ${targetSub}`
    ),
  })
  stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    stdout.write(`${JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Claim failed' }, null, 2)}\n`)
    process.exitCode = 1
  })
}
