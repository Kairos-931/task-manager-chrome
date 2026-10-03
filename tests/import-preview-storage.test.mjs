import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const output = await build({
  entryPoints: [fileURLToPath(new URL('../shared/storage.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})

const values = new Map()
const fetchCalls = []
let failNextBackupWrite = false
let serverChanges = []
globalThis.chrome = {
  runtime: {
    lastError: null,
    sendMessage: async () => undefined,
  },
  storage: {
    local: {
      get(keys, callback) {
        if (keys === null) {
          callback(Object.fromEntries(values))
          return
        }
        const keyList = Array.isArray(keys) ? keys : [keys]
        callback(Object.fromEntries(keyList.filter(key => values.has(key)).map(key => [key, values.get(key)])))
      },
      set(entries, callback) {
        if (failNextBackupWrite && Object.hasOwn(entries, 'tm_local_backup')) {
          failNextBackupWrite = false
          chrome.runtime.lastError = { message: 'synthetic disk full' }
          callback()
          chrome.runtime.lastError = null
          return
        }
        for (const [key, value] of Object.entries(entries)) values.set(key, value)
        callback()
      },
      remove(keys, callback) {
        for (const key of Array.isArray(keys) ? keys : [keys]) values.delete(key)
        callback()
      },
    },
  },
}

globalThis.fetch = async (url, init = {}) => {
  fetchCalls.push({ url: String(url), init })
  const body = JSON.parse(init.body || '{}')
  for (const change of body.changes || []) {
    serverChanges.push({
      ...change,
      revision: serverChanges.length + 1,
      source_device: body.deviceId,
    })
  }
  const cursor = Number(body.cursor) || 0
  const changes = serverChanges.filter(change => change.revision > cursor).slice(0, 500)
  const nextCursor = changes.length ? changes.at(-1).revision : cursor
  return new Response(JSON.stringify({ changes: changes.map(change => ({
    type: change.type,
    id: change.id,
    payload: change.payload,
    deleted: change.deleted,
    updatedAt: change.updatedAt,
    sourceDevice: change.source_device,
  })), cursor: nextCursor, hasMore: false }), { status: 200 })
}

const {
  confirmImportMerge,
  exportData,
  normalizeStorageData,
  prepareImportPreview,
} = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`)

const category = (id, name) => ({ id, name, color: '#123456', updatedAt: 1 })
const task = (id, title, categoryId = 'cat-a') => ({
  id, title, description: '', priority: 'medium', category: categoryId, dueDate: '', duration: 20,
  repeatType: 'none', repeatDays: [], repeatInterval: 1, completed: false, completedDates: [],
  createdAt: 10, updatedAt: 10, noTimeLimit: true,
})
const data = (tasks = [], categories = [category('cat-a', '工作')], settings = {}) => ({
  tasks, categories, defaultCategory: 'cat-a', hideCompleted: false, hideOverdue: false,
  showNoTimeLimitOnly: false, darkMode: true, weeklyGoalMinutes: 600, ...settings,
})
const writeBackup = value => values.set('tm_local_backup', JSON.stringify(value))
const readBackup = () => JSON.parse(values.get('tm_local_backup'))
const backup = (tasks, categories = [category('cat-a', '工作')], extra = {}) => ({
  formatVersion: 2,
  productVersion: '4.0.0',
  deletionHistory: { complete: false, tasks: [], categories: [] },
  data: data(tasks, categories),
  ...extra,
})
const file = value => ({ text: async () => JSON.stringify(value) })
const fakeAccount = (sub, email = `${sub}@example.test`) => ({ sub, email, connected: true })

const duplicatedCategoryData = normalizeStorageData(data([], [category('cat-a', '工作'), category('cat-b', '工作')]))
assert.equal(duplicatedCategoryData.categories.length, 2, 'same-name categories with different IDs survive normalization')
writeBackup(data([], [category('cat-a', '工作'), category('cat-b', '工作')]))
const taskBundle = await build({
  entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { getState, loadState } = await import(`data:text/javascript,${encodeURIComponent(taskBundle.outputFiles[0].text)}`)
await loadState()
assert.equal(getState().categories.length, 2, 'the live app state also keeps same-name category IDs separate')

writeBackup(data([task('local', '当前任务')], [category('cat-a', '工作'), category('cat-b', '工作')], { weeklyGoalMinutes: 750 }))
const oldBackup = { version: '3.10.0', data: data([task('imported', '备份任务')]) }
const guestPreviewResult = await prepareImportPreview(file(oldBackup))
assert.equal(guestPreviewResult.success, true)
assert.equal(guestPreviewResult.preview.requiresAcknowledgement, true, 'old backup requires a review acknowledgement')
assert.equal(guestPreviewResult.preview.plan.tasks.added, 1)
const missingAck = await confirmImportMerge(guestPreviewResult.preview, {}, new Set(), new Set(), false)
assert.equal(missingAck.success, false)
assert.match(missingAck.error, /检查待新增清单/)
assert.equal(readBackup().tasks.length, 1, 'preview alone does not write')
const guestCommit = await confirmImportMerge(guestPreviewResult.preview, {}, new Set(), new Set(), true)
assert.equal(guestCommit.success, true)
assert.deepEqual(readBackup().tasks.map(item => item.id).sort(), ['imported', 'local'])
assert.equal(readBackup().categories.length, 2, 'same-name categories do not collapse after import')
assert.equal(readBackup().weeklyGoalMinutes, 750, 'personal settings are preserved')
assert.equal(fetchCalls.length, 0, 'guest import remains local')

const repeatPreview = await prepareImportPreview(file(oldBackup))
assert.equal(repeatPreview.preview.plan.tasks.added, 0)
assert.equal(repeatPreview.preview.plan.tasks.skipped, 1)
const repeatCommit = await confirmImportMerge(repeatPreview.preview, {}, new Set(), new Set(), true)
assert.equal(repeatCommit.success, true)
assert.equal(readBackup().tasks.length, 2, 'repeating the same import remains idempotent')

const stalePreviewResult = await prepareImportPreview(file(backup([task('stale-add', '预览时新增')])) )
const newer = readBackup()
newer.tasks.push(task('concurrent-local', '预览期间本机新增'))
writeBackup(newer)
const staleCommit = await confirmImportMerge(stalePreviewResult.preview, {}, new Set(), new Set(), true)
assert.equal(staleCommit.stale, true, 'preview-time local changes require a fresh preview')
assert.ok(readBackup().tasks.some(item => item.id === 'concurrent-local'))
assert.ok(!readBackup().tasks.some(item => item.id === 'stale-add'), 'stale preview never overwrites or commits')

values.set('tm_google_account', fakeAccount('account-a'))
values.set('tm_google_session_token_v1', 'synthetic-session-secret')
serverChanges = []
const switchPreview = await prepareImportPreview(file(backup([task('switch-add', '不应写入')])) )
values.set('tm_google_account', fakeAccount('account-b'))
const beforeSwitch = readBackup()
const switched = await confirmImportMerge(switchPreview.preview, {}, new Set(), new Set(), false)
assert.equal(switched.success, false)
assert.match(switched.error, /账号已切换/)
assert.deepEqual(readBackup(), beforeSwitch, 'account switch cancels the old account preview')

values.set('tm_google_account', fakeAccount('account-a'))
serverChanges = [{
  revision: 1,
  type: 'task',
  id: 'gone',
  payload: null,
  deleted: true,
  updatedAt: 50,
  source_device: 'another-device',
}]
const currentGoogleData = data([task('google-local', '账号本机任务')])
writeBackup(currentGoogleData)
const tombstoneBackup = backup([task('gone', '备份中的旧删除项'), task('google-new', '账号新任务')])
const tombstonePreviewResult = await prepareImportPreview(file(tombstoneBackup))
assert.equal(tombstonePreviewResult.success, true)
assert.equal(tombstonePreviewResult.preview.requiresAcknowledgement, false, 'complete account history is reliable for the new format')
assert.equal(tombstonePreviewResult.preview.plan.tasks.added, 1)
assert.deepEqual(tombstonePreviewResult.preview.plan.tasks.deleted.map(item => item.record.id), ['gone'])
const readOnlyCallsBefore = fetchCalls.length
const tombstoneCommit = await confirmImportMerge(tombstonePreviewResult.preview, {}, new Set(), new Set(), false)
assert.equal(tombstoneCommit.success, true)
assert.equal(tombstoneCommit.cloudSynced, true)
assert.deepEqual(readBackup().tasks.map(item => item.id).sort(), ['google-local', 'google-new'])
const historyReads = fetchCalls.slice(readOnlyCallsBefore).filter(call => JSON.parse(call.init.body).changes.length === 0)
assert.ok(historyReads.length >= 1, 'confirmation re-reads history without sending changes')
assert.ok(historyReads.every(call => JSON.parse(call.init.body).changes.length === 0))
const uploadedGone = fetchCalls.some(call => (JSON.parse(call.init.body).changes || []).some(change => change.type === 'task' && change.id === 'gone'))
assert.equal(uploadedGone, false, 'a known deletion is never uploaded from an old backup')

const importedTaskWrites = fetchCalls.filter(call => (JSON.parse(call.init.body).changes || []).some(change => change.type === 'task' && change.id === 'google-new')).length
const googleRepeatPreview = await prepareImportPreview(file(tombstoneBackup))
assert.equal(googleRepeatPreview.preview.plan.tasks.added, 0)
const googleRepeat = await confirmImportMerge(googleRepeatPreview.preview, {}, new Set(), new Set(), false)
assert.equal(googleRepeat.success, true)
assert.equal(readBackup().tasks.filter(item => item.id === 'google-new').length, 1)
const importedTaskWritesAfterRepeat = fetchCalls.filter(call => (JSON.parse(call.init.body).changes || []).some(change => change.type === 'task' && change.id === 'google-new')).length
assert.equal(importedTaskWritesAfterRepeat, importedTaskWrites, 'repeat import does not re-send the task to Google')

const exported = JSON.parse(await exportData())
assert.equal(exported.formatVersion, 2)
assert.equal(exported.productVersion, '4.0.0')
assert.ok(!JSON.stringify(exported).includes('synthetic-session-secret'), 'export never contains a session token')
assert.ok(!JSON.stringify(exported).includes('tm_incremental_sync_cursor'), 'export never contains a sync cursor')

values.delete('tm_google_account')
values.delete('tm_google_session_token_v1')
values.delete('tm_local_backup')
const firstInstallBackup = backup([task('first-install', '新装首次导入')], [category('cat-a', '工作')], {
  deletionHistory: { complete: true, tasks: [], categories: [] },
})
const firstInstallPreview = await prepareImportPreview(file(firstInstallBackup))
assert.equal(firstInstallPreview.success, true, 'missing local storage still produces a stable preview fingerprint')
const firstInstallCommit = await confirmImportMerge(firstInstallPreview.preview, {}, new Set(), new Set(), false)
assert.equal(firstInstallCommit.success, true, 'first-install import can be confirmed')
assert.equal(readBackup().tasks.some(item => item.id === 'first-install'), true)

writeBackup(data([task('safe-existing', '保留现有')]))
const failurePreview = await prepareImportPreview(file(oldBackup))
failNextBackupWrite = true
const failureResult = await confirmImportMerge(failurePreview.preview, {}, new Set(), new Set(), true)
assert.equal(failureResult.success, false, 'local persistence failure is reported as a failure')
assert.match(failureResult.error, /本机保存失败/)
assert.deepEqual(readBackup().tasks.map(item => item.id), ['safe-existing'], 'local failure keeps existing data intact')

console.log('✓ backup import storage integration tests passed')
