import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import {
  applyLegacyClaim,
  LEGACY_EXTENSION_SOURCE_ID,
  previewLegacyClaim,
  rollbackLegacyClaim,
  summarizeLegacyClaim,
  verifyTargetGoogleIdentity,
} from '../scripts/legacy-account-claim.mjs'

const schema = await readFile(new URL('../backend/schema.sql', import.meta.url), 'utf8')
const claimMigration = await readFile(new URL('../backend/migrations/0003-legacy-account-claim.sql', import.meta.url), 'utf8')

const makeDatabase = ({ sqlite = new DatabaseSync(':memory:'), failAtBatchIndex = -1, beforeBatch } = {}) => {
  sqlite.exec(schema)
  sqlite.exec(claimMigration)
  const client = {
    sqlite,
    async query(sql, params = []) {
      return sqlite.prepare(sql).all(...params)
    },
    async batch(statements) {
      await beforeBatch?.()
      sqlite.exec('BEGIN IMMEDIATE')
      try {
        const results = []
        for (let index = 0; index < statements.length; index += 1) {
          if (index === failAtBatchIndex) throw new Error('simulated D1 batch failure')
          const { sql, params = [] } = statements[index]
          const result = sqlite.prepare(sql).run(...params)
          results.push({ meta: { changes: Number(result.changes) } })
        }
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
  return client
}

const seedLegacyData = (db, { taskTitle = 'Legacy task', includeExcludedRows = false } = {}) => {
  const fullSync = {
    tasks: [{ id: 'legacy-task', title: taskTitle, category: 'legacy-category', updatedAt: 100 }],
    categories: [{ id: 'legacy-category', name: 'Legacy category', color: '#345678', updatedAt: 101 }],
    defaultCategory: 'legacy-category',
    hideCompleted: false,
    hideOverdue: false,
    showNoTimeLimitOnly: false,
    darkMode: false,
    weeklyGoalMinutes: 120,
    weeklyGoalAnchor: '2026-09-28',
    syncSettingsUpdatedAt: 102,
  }
  const updatedAt = '2026-10-01T00:00:00.000Z'
  db.sqlite.prepare("INSERT INTO user_data (key, value, updated_at) VALUES ('full_sync', ?, ?)")
    .run(JSON.stringify(fullSync), updatedAt)
  const sourceRecords = [
    ['task:legacy-task', 'task', 'legacy-task', fullSync.tasks[0], 0, 100, 'desktop-a'],
    ['category:legacy-category', 'category', 'legacy-category', fullSync.categories[0], 0, 101, 'desktop-a'],
    ['settings:app', 'settings', 'app', {
      defaultCategory: fullSync.defaultCategory,
      hideCompleted: false,
      hideOverdue: false,
      showNoTimeLimitOnly: false,
      darkMode: false,
      weeklyGoalMinutes: 120,
      weeklyGoalAnchor: '2026-09-28',
    }, 0, 102, 'desktop-a'],
    ['task:legacy-deleted', 'task', 'legacy-deleted', null, 1, 150, 'desktop-b'],
  ]
  const insertSource = db.sqlite.prepare(`INSERT INTO sync_records
    (record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  sourceRecords.forEach((row, index) => insertSource.run(
    row[0], row[1], row[2], row[3] === null ? null : JSON.stringify(row[3]), row[4], row[5], row[6], index + 1
  ))
  if (includeExcludedRows) {
    db.sqlite.prepare("INSERT INTO user_data (key, value, updated_at) VALUES ('categories', ?, ?)")
      .run(JSON.stringify([{ id: 'excluded-category', name: 'Separate data' }]), updatedAt)
    db.sqlite.prepare(`INSERT INTO pending_tasks (id, title, source) VALUES ('pending-legacy', 'Keep in old queue', 'web')`).run()
    db.sqlite.prepare('INSERT INTO telegram_users (telegram_user_id, api_token) VALUES (?, ?)').run(81, 'test-only-token')
  }
  return { fullSync, updatedAt, sourceRecords }
}

const count = (db, table) => Number(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)
const verifiedToken = async token => {
  if (token !== 'valid-owner-token') throw new Error('Worker verification rejected token')
  return { sub: 'verified-google-sub' }
}
const apply = (db, preview, options = {}) => applyLegacyClaim({
  db,
  verifyTargetToken: options.verifyTargetToken || verifiedToken,
  googleToken: options.googleToken || 'valid-owner-token',
  operationId: options.operationId || preview.operationId,
  expectedSourceHash: options.expectedSourceHash || preview.sourceSnapshotHash,
  operatorId: options.operatorId || 'ops-user-1',
  ownerConfirmationRef: options.ownerConfirmationRef || 'owner-approval-ticket-42',
  backupReference: options.backupReference || 'nonprod-snapshot-2026-10-01',
  backupFile: options.backupFile || 'test-backup.json',
  sourceWritesPaused: options.sourceWritesPaused ?? true,
  production: options.production ?? false,
  productionAuthorized: options.productionAuthorized ?? false,
  confirmOwner: options.confirmOwner || (async () => true),
  backupWriter: options.backupWriter || (async () => ({ path: 'test-backup.json', sha256: 'b'.repeat(64) })),
})

const db = makeDatabase()
const original = seedLegacyData(db, { includeExcludedRows: true })
const preview = await previewLegacyClaim({ db, targetSub: 'verified-google-sub', operationId: 'claim-basic-0001' })
assert.equal(preview.eligible, true)
assert.deepEqual(preview.counts, { recordCount: 4, tasks: 1, categories: 1, settings: 1, tombstones: 1 })
assert.deepEqual(preview.excludedCounts, {
  independentCategories: 1,
  independentCategoriesUnreadable: false,
  pendingTasks: 1,
  telegramBindings: 1,
})
assert.equal(count(db, 'account_data_claims'), 0, 'dry-run must not write audit rows')
assert.equal(count(db, 'account_data_claim_staging'), 0, 'dry-run must not stage rows')
assert.equal(count(db, 'account_sync_records'), 0, 'dry-run must not write account records')
const dryRunReport = JSON.stringify(summarizeLegacyClaim(preview))
assert.equal(dryRunReport.includes('Legacy task'), false, 'dry-run output must not include task titles')
assert.equal(dryRunReport.includes('legacy-task'), false, 'dry-run output must not include task IDs')
assert.equal(dryRunReport.includes('test-only-token'), false, 'dry-run output must not include Telegram tokens')

await assert.rejects(
  verifyTargetGoogleIdentity('forged-token', 'https://worker.test', async () => new Response('{}', { status: 401 })),
  /rejected the target Google identity/
)
await assert.rejects(apply(db, preview, { verifyTargetToken: async () => ({ email: 'owner@example.test' }) }), /not verified/)
assert.equal(count(db, 'account_data_claims'), 0)

await assert.rejects(
  apply(db, preview, { confirmOwner: async () => false }),
  /did not confirm this exact source and target/
)
assert.equal(count(db, 'account_data_claims'), 0)

const result = await apply(db, preview)
assert.equal(result.status, 'applied')
assert.equal(result.targetSub, 'verified-google-sub')
assert.equal(count(db, 'account_data_claims'), 1)
assert.equal(count(db, 'account_data_claim_staging'), 0)
assert.equal(count(db, 'account_sync_records'), 4)
assert.equal(count(db, 'account_sync_changes'), 4)
assert.equal(Number(db.sqlite.prepare('SELECT revision FROM account_sync_state WHERE user_sub = ?').get('verified-google-sub').revision), 4)
assert.equal(Number(db.sqlite.prepare('SELECT deleted FROM account_sync_records WHERE user_sub = ? AND record_key = ?')
  .get('verified-google-sub', 'task:legacy-deleted').deleted), 1)
assert.equal(Number(db.sqlite.prepare('SELECT COUNT(*) AS count FROM account_sync_changes WHERE user_sub = ? AND deleted = 1')
  .get('verified-google-sub').count), 1)
assert.equal(db.sqlite.prepare('SELECT value FROM user_data WHERE key = ?').get('full_sync').value, JSON.stringify(original.fullSync))
assert.equal(count(db, 'pending_tasks'), 1, 'legacy mobile/Telegram queue remains untouched')
assert.equal(count(db, 'telegram_users'), 1, 'Telegram bindings remain untouched')
assert.equal(db.sqlite.prepare('SELECT value FROM user_data WHERE key = ?').get('categories').value,
  JSON.stringify([{ id: 'excluded-category', name: 'Separate data' }]))
const audit = db.sqlite.prepare('SELECT * FROM account_data_claims WHERE operation_id = ?').get('claim-basic-0001')
assert.equal(audit.source_id, LEGACY_EXTENSION_SOURCE_ID)
assert.equal(audit.target_sub, 'verified-google-sub')
assert.equal(audit.owner_confirmation_ref, 'owner-approval-ticket-42')
assert.equal(audit.backup_sha256, 'b'.repeat(64))
assert.equal(Object.hasOwn(audit, 'payload'), false, 'audit rows must not contain task contents')

const idempotent = await apply(db, preview)
assert.equal(idempotent.status, 'already_applied')
assert.equal(count(db, 'account_sync_changes'), 4, 'repeat apply must not duplicate records')
await assert.rejects(apply(db, { ...preview, operationId: 'claim-basic-0002' }), /already bound to a different claim/)

const rollback = await rollbackLegacyClaim({ db, operationId: 'claim-basic-0001', operatorId: 'ops-user-1' })
assert.equal(rollback.status, 'rolled_back')
assert.equal(rollback.tombstones, 4)
assert.equal(count(db, 'account_sync_changes'), 8, 'rollback must publish tombstones for already-synced devices')
assert.equal(Number(db.sqlite.prepare('SELECT revision FROM account_sync_state WHERE user_sub = ?').get('verified-google-sub').revision), 8)
assert.equal(Number(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM account_sync_records
  WHERE user_sub = ? AND deleted = 1 AND source_device = ?`).get('verified-google-sub', 'claim-rollback:claim-basic-0001').count), 4)
assert.equal(db.sqlite.prepare('SELECT status FROM account_data_claims WHERE operation_id = ?').get('claim-basic-0001').status, 'rolled_back')
assert.equal((await rollbackLegacyClaim({ db, operationId: 'claim-basic-0001', operatorId: 'ops-user-1' })).status, 'already_rolled_back')
assert.equal(db.sqlite.prepare('SELECT value FROM user_data WHERE key = ?').get('full_sync').value, JSON.stringify(original.fullSync))

const conflictDb = makeDatabase()
seedLegacyData(conflictDb)
conflictDb.sqlite.prepare("UPDATE sync_records SET payload = ? WHERE record_key = 'task:legacy-task'")
  .run(JSON.stringify({ id: 'legacy-task', title: 'Conflict', category: 'legacy-category', updatedAt: 100 }))
const conflictPreview = await previewLegacyClaim({ db: conflictDb, targetSub: 'verified-google-sub', operationId: 'claim-conflict-0001' })
assert.equal(conflictPreview.eligible, false)
assert.match(conflictPreview.blockers.join(' '), /do not match/)
assert.equal(count(conflictDb, 'account_sync_records'), 0)

const missingCategoriesDb = makeDatabase()
const missingCategories = seedLegacyData(missingCategoriesDb)
const invalidSnapshot = { ...missingCategories.fullSync }
delete invalidSnapshot.categories
missingCategoriesDb.sqlite.prepare("UPDATE user_data SET value = ? WHERE key = 'full_sync'")
  .run(JSON.stringify(invalidSnapshot))
const missingCategoriesPreview = await previewLegacyClaim({ db: missingCategoriesDb, targetSub: 'verified-google-sub', operationId: 'claim-missing-categories-0001' })
assert.equal(missingCategoriesPreview.eligible, false, 'missing source categories must not be interpreted as an empty list')
assert.match(missingCategoriesPreview.blockers.join(' '), /no verifiable category list/)

const nonEmptyDb = makeDatabase()
seedLegacyData(nonEmptyDb)
nonEmptyDb.sqlite.prepare(`INSERT INTO account_sync_state (user_sub, revision) VALUES ('verified-google-sub', 1)`).run()
nonEmptyDb.sqlite.prepare(`INSERT INTO account_sync_records
  (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision)
  VALUES ('verified-google-sub', 'task:old-tombstone', 'task', 'old-tombstone', NULL, 1, 150, 'old-device', 1)`).run()
const nonEmptyPreview = await previewLegacyClaim({ db: nonEmptyDb, targetSub: 'verified-google-sub', operationId: 'claim-nonempty-0001' })
assert.equal(nonEmptyPreview.eligible, false)
await assert.rejects(apply(nonEmptyDb, nonEmptyPreview), /already contains records or claim history/)
assert.equal(count(nonEmptyDb, 'account_data_claims'), 0)

const staleDb = makeDatabase()
seedLegacyData(staleDb)
const stalePreview = await previewLegacyClaim({ db: staleDb, targetSub: 'verified-google-sub', operationId: 'claim-stale-0001' })
staleDb.sqlite.prepare("UPDATE user_data SET updated_at = '2026-10-01T00:01:00.000Z' WHERE key = 'full_sync'").run()
await assert.rejects(apply(staleDb, stalePreview), /source changed after dry-run/)
assert.equal(count(staleDb, 'account_data_claims'), 0)

let raced = false
const raceDb = makeDatabase({
  beforeBatch: async () => {
    if (raced) return
    raced = true
    raceDb.sqlite.prepare("UPDATE sync_records SET revision = revision + 10 WHERE record_key = 'task:legacy-task'").run()
  },
})
seedLegacyData(raceDb)
const racePreview = await previewLegacyClaim({ db: raceDb, targetSub: 'verified-google-sub', operationId: 'claim-race-0001' })
await assert.rejects(apply(raceDb, racePreview), /changed at commit/)
assert.equal(count(raceDb, 'account_data_claims'), 0)
assert.equal(count(raceDb, 'account_data_claim_staging'), 0)
assert.equal(count(raceDb, 'account_sync_records'), 0)

const failedDb = makeDatabase({ failAtBatchIndex: 8 })
seedLegacyData(failedDb)
const failedPreview = await previewLegacyClaim({ db: failedDb, targetSub: 'verified-google-sub', operationId: 'claim-fail-0001' })
await assert.rejects(apply(failedDb, failedPreview), /simulated D1 batch failure/)
assert.equal(count(failedDb, 'account_data_claims'), 0, 'failed batch must roll back the audit marker')
assert.equal(count(failedDb, 'account_data_claim_staging'), 0, 'failed batch must roll back staging rows')
assert.equal(count(failedDb, 'account_sync_records'), 0, 'failed batch must not expose partial account data')
assert.equal(count(failedDb, 'account_sync_changes'), 0)

const changedAfterClaimDb = makeDatabase()
seedLegacyData(changedAfterClaimDb)
const changedPreview = await previewLegacyClaim({ db: changedAfterClaimDb, targetSub: 'verified-google-sub', operationId: 'claim-changed-0001' })
await apply(changedAfterClaimDb, changedPreview)
changedAfterClaimDb.sqlite.prepare(`UPDATE account_sync_state SET revision = revision + 1 WHERE user_sub = ?`)
  .run('verified-google-sub')
changedAfterClaimDb.sqlite.prepare(`INSERT INTO account_sync_records
  (user_sub, record_key, record_type, record_id, payload, deleted, updated_at, source_device, revision)
  VALUES (?, 'task:new-user-task', 'task', 'new-user-task', ?, 0, 300, 'new-device', 5)`)
  .run('verified-google-sub', JSON.stringify({ id: 'new-user-task', title: 'User work' }))
await assert.rejects(
  rollbackLegacyClaim({ db: changedAfterClaimDb, operationId: 'claim-changed-0001', operatorId: 'ops-user-1' }),
  /changed after claim/
)
assert.equal(count(changedAfterClaimDb, 'account_sync_changes'), 4)
assert.equal(changedAfterClaimDb.sqlite.prepare('SELECT status FROM account_data_claims WHERE operation_id = ?')
  .get('claim-changed-0001').status, 'applied')

const failedRollbackDb = makeDatabase()
seedLegacyData(failedRollbackDb)
const failedRollbackPreview = await previewLegacyClaim({ db: failedRollbackDb, targetSub: 'verified-google-sub', operationId: 'claim-rollback-fail-0001' })
await apply(failedRollbackDb, failedRollbackPreview)
const failingRollbackClient = makeDatabase({ sqlite: failedRollbackDb.sqlite, failAtBatchIndex: 1 })
await assert.rejects(
  rollbackLegacyClaim({ db: failingRollbackClient, operationId: 'claim-rollback-fail-0001', operatorId: 'ops-user-1' }),
  /simulated D1 batch failure/
)
assert.equal(Number(failedRollbackDb.sqlite.prepare('SELECT revision FROM account_sync_state WHERE user_sub = ?')
  .get('verified-google-sub').revision), 4, 'failed rollback must restore the account revision')
assert.equal(count(failedRollbackDb, 'account_sync_changes'), 4, 'failed rollback must not publish tombstones')
assert.equal(failedRollbackDb.sqlite.prepare('SELECT status FROM account_data_claims WHERE operation_id = ?')
  .get('claim-rollback-fail-0001').status, 'applied', 'failed rollback must preserve the claim state')
assert.equal(Number(failedRollbackDb.sqlite.prepare('SELECT COUNT(*) AS count FROM account_sync_records WHERE user_sub = ? AND deleted = 0')
  .get('verified-google-sub').count), 3, 'failed rollback must preserve live imported records')
