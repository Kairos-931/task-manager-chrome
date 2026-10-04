import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const [eventSource, renderSource] = await Promise.all([
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
])
const taskBundle = await build({
  entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { getState, setState, addTask, updateTask, persistTaskMutation, createParentWithChildrenPersisted } = await import(
  `data:text/javascript,${encodeURIComponent(taskBundle.outputFiles[0].text)}`
)

const makeTask = (id, updates = {}) => ({
  id,
  title: id,
  description: '',
  priority: 'medium',
  category: 'default-work',
  dueDate: '2026-10-03',
  duration: 60,
  repeatType: 'none',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: [],
  createdAt: 1,
  updatedAt: 1,
  noTimeLimit: false,
  ...updates,
})

const newTaskData = (title) => ({
  title,
  description: '保留表单内容',
  priority: 'high',
  category: 'default-work',
  dueDate: '2026-10-03',
  duration: 90,
  repeatType: 'none',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  noTimeLimit: false,
})

// A failed create is rolled back from memory; repeated retries keep one stable ID.
setState({ tasks: [] })
const pendingId = 'stable-retry-id'
const saveNewTask = (data, result) => persistTaskMutation(() => {
  if (getState().tasks.some(task => task.id === pendingId)) updateTask(pendingId, data)
  else addTask(data, pendingId)
}, async () => result)
assert.equal(await saveNewTask(newTaskData('首次内容'), false), false)
assert.deepEqual(getState().tasks, [])
assert.equal(await saveNewTask(newTaskData('修正后内容'), false), false)
assert.deepEqual(getState().tasks, [])
assert.equal(await saveNewTask(newTaskData('最终内容'), true), true)
assert.equal(getState().tasks.filter(task => task.id === pendingId).length, 1)
assert.equal(getState().tasks[0].title, '最终内容')
assert.equal(getState().tasks[0].description, '保留表单内容')
assert.equal(getState().tasks[0].priority, 'high')
assert.equal(getState().tasks[0].duration, 90)
assert.equal(getState().tasks[0].dueDate, '2026-10-03')

// An edit failure restores only that task and keeps unrelated changes made during the write.
const originalEdit = makeTask('edit-target', { title: '保存前' })
const unrelated = makeTask('unrelated', { title: '其他任务' })
setState({ tasks: [originalEdit, unrelated] })
let finishFailedEdit
const failedEdit = persistTaskMutation(
  () => updateTask('edit-target', { title: '未能保存的编辑' }),
  () => new Promise(resolve => { finishFailedEdit = resolve })
)
updateTask('unrelated', { title: '期间合法修改' })
addTask(newTaskData('期间新增'), 'concurrent-add')
finishFailedEdit(false)
assert.equal(await failedEdit, false)
assert.equal(getState().tasks.find(task => task.id === 'edit-target').title, '保存前')
assert.equal(getState().tasks.find(task => task.id === 'unrelated').title, '期间合法修改')
assert.equal(getState().tasks.find(task => task.id === 'concurrent-add').title, '期间新增')

// If the same record changes independently while saving, do not overwrite that newer value.
let finishConflictingEdit
const conflictingEdit = persistTaskMutation(
  () => updateTask('edit-target', { title: '本次编辑' }),
  () => new Promise(resolve => { finishConflictingEdit = resolve })
)
updateTask('edit-target', { description: '并发更新' })
finishConflictingEdit(false)
assert.equal(await conflictingEdit, false)
assert.equal(getState().tasks.find(task => task.id === 'edit-target').title, '本次编辑')
assert.equal(getState().tasks.find(task => task.id === 'edit-target').description, '并发更新')

// Parent edit rollback is limited to the parent and the non-recurring children it changed.
const parent = makeTask('parent', { isParent: true, noTimeLimit: true, dueDate: '' })
const child = makeTask('child', { parentId: 'parent' })
const repeatingChild = makeTask('repeating-child', { parentId: 'parent', repeatType: 'daily' })
setState({ tasks: [parent, child, repeatingChild, makeTask('kept')] })
const failedParentEdit = await persistTaskMutation(() => {
  updateTask('parent', { title: '新父任务名称', completed: true })
  const now = Date.now()
  const target = getState().tasks.find(task => task.id === 'child')
  target.completed = true
  target.completedAt = now
  target.updatedAt = now
}, async () => false)
assert.equal(failedParentEdit, false)
assert.equal(getState().tasks.find(task => task.id === 'parent').title, 'parent')
assert.equal(getState().tasks.find(task => task.id === 'parent').completed, false)
assert.equal(getState().tasks.find(task => task.id === 'child').completed, false)
assert.equal(getState().tasks.find(task => task.id === 'repeating-child').completed, false)
assert.ok(getState().tasks.some(task => task.id === 'kept'))

// Failed parent creation removes only its new records; concurrent task additions survive.
setState({ tasks: [makeTask('before-parent-create')] })
let finishParentCreate
const failedParentCreate = createParentWithChildrenPersisted({
  title: '创建失败的大任务', description: '', priority: 'high', category: 'default-work',
  completed: false, noTimeLimit: true, repeatType: 'none', repeatDays: [], repeatInterval: 1,
}, [
  { title: '子任务一', duration: 30, dueDate: '2099-01-08' },
  { title: '子任务二', duration: 60, dueDate: '2099-01-09' },
], () => new Promise(resolve => { finishParentCreate = resolve }))
addTask(newTaskData('并发新增任务'), 'during-parent-create')
finishParentCreate(false)
assert.equal(await failedParentCreate, false)
assert.deepEqual(getState().tasks.map(task => task.id).sort(), ['before-parent-create', 'during-parent-create'])

// Exercise the real local writer: quota failure rolls back, then local success remains success even when cloud sync fails.
const originalChrome = globalThis.chrome
const originalFetch = globalThis.fetch
const localValues = { tm_sync_settings: { apiUrl: 'https://sync.example.test', apiToken: 'test-token' } }
let failNextLocalWrite = true
let cloudAttempts = 0
const runtime = { lastError: null, sendMessage: async () => undefined }
globalThis.chrome = {
  runtime,
  storage: {
    local: {
      get(keys, callback) {
        const names = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {})
        const result = Object.fromEntries(names.filter(key => key in localValues).map(key => [key, localValues[key]]))
        callback(result)
      },
      set(values, callback) {
        if (failNextLocalWrite) {
          failNextLocalWrite = false
          runtime.lastError = { message: 'simulated local quota failure' }
        } else {
          Object.assign(localValues, values)
          runtime.lastError = null
        }
        callback?.()
        runtime.lastError = null
      },
      remove(keys, callback) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete localValues[key]
        callback?.()
      },
    },
  },
}
globalThis.fetch = async () => {
  cloudAttempts += 1
  return { ok: false, status: 503, json: async () => ({ error: 'simulated cloud failure' }) }
}
setState({ tasks: [] })
assert.equal(await persistTaskMutation(() => addTask(newTaskData('本地失败后重试'), 'real-storage-retry')), false)
assert.deepEqual(getState().tasks, [])
assert.equal(await persistTaskMutation(() => addTask(newTaskData('本地失败后重试'), 'real-storage-retry')), true)
assert.equal(getState().tasks.filter(task => task.id === 'real-storage-retry').length, 1)
assert.equal(JSON.parse(localValues.tm_local_backup).tasks[0].title, '本地失败后重试')
for (let attempt = 0; attempt < 20 && cloudAttempts === 0; attempt += 1) await new Promise(resolve => setTimeout(resolve, 1))
assert.ok(cloudAttempts > 0, 'the simulated cloud failure should occur after the local save')
globalThis.chrome = originalChrome
globalThis.fetch = originalFetch

// The shared form keeps its error in place and exits early on a failed local save.
assert.match(renderSource, /id="taskSaveError"[^>]*role="alert" aria-live="polite"/)
assert.match(eventSource, /if \(taskSaveInProgress\) return/)
assert.match(eventSource, /本地保存失败，内容已保留，请重试/)
assert.match(eventSource, /saved = await persistTaskMutation/)
assert.match(eventSource, /catch \(error\) \{\s*reportTaskPreparationFailure\(error\)\s*return\s*\}/)
assert.match(eventSource, /if \(editingTask\) \{\s*updateTask\(editingTask\.id, taskData\)/)
assert.match(eventSource, /saved\) \{\s*saveDraft\(\)\s*setTaskSaveError\('本地保存失败，内容已保留，请重试'\)\s*return/s)
assert.match(eventSource, /controls\.forEach\(control => \{ control\.disabled = true \}\)[\s\S]*submit\.textContent = '保存中…'/)
console.log('Task save failure and retry tests passed')
