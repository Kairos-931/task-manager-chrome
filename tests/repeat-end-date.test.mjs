import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const localStore = new Map()
globalThis.chrome = {
  runtime: { lastError: null },
  storage: {
    local: {
      get(keys, callback) {
        const requested = Array.isArray(keys) ? keys : [keys]
        const result = Object.fromEntries(requested.filter(key => localStore.has(key)).map(key => [key, localStore.get(key)]))
        queueMicrotask(() => callback(result))
      },
      set(values, callback) {
        Object.entries(values).forEach(([key, value]) => localStore.set(key, value))
        queueMicrotask(() => callback?.())
      },
      remove(keys, callback) {
        const requested = Array.isArray(keys) ? keys : [keys]
        requested.forEach(key => localStore.delete(key))
        queueMicrotask(() => callback?.())
      }
    }
  }
}

const entry = await build({
  stdin: {
    contents: `
      export { setState, getState, toggleTask, toggleTaskOnDate, moveTaskToDate, getWeeklyGoalStats } from './shared/task.ts'
      export { isTaskDueOnDate, summarizeTaskDurationsForDates } from './shared/calendar.ts'
      export { normalizeStorageData, saveData } from './shared/storage.ts'
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'repeat-end-date-entry.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})

const { setState, getState, toggleTask, toggleTaskOnDate, moveTaskToDate, getWeeklyGoalStats, isTaskDueOnDate, summarizeTaskDurationsForDates, normalizeStorageData, saveData } =
  await import(`data:text/javascript,${encodeURIComponent(entry.outputFiles[0].text)}`)
const waitForToggleThrottle = () => new Promise(resolve => setTimeout(resolve, 510))

const task = (overrides = {}) => ({
  id: 'task',
  title: '重复任务',
  description: '',
  priority: 'medium',
  category: '',
  dueDate: '2026-09-10',
  duration: 60,
  repeatType: 'daily',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: [],
  createdAt: 1,
  updatedAt: 1,
  noTimeLimit: false,
  ...overrides
})

const endBounded = task({ repeatStartDate: '2026-09-10', repeatEndDate: '2026-09-12' })
assert.equal(isTaskDueOnDate(endBounded, '2026-09-10'), true)
assert.equal(isTaskDueOnDate(endBounded, '2026-09-12'), true)
assert.equal(isTaskDueOnDate(endBounded, '2026-09-13'), false, 'dates after the repeat end must not be occurrences')
assert.equal(isTaskDueOnDate(task({ repeatStartDate: '2026-09-10' }), '2099-01-01'), true, 'legacy tasks without an end keep the old open-ended behavior')

const weekly = task({ dueDate: '2026-09-07', repeatStartDate: '2026-09-07', repeatType: 'weekly', repeatDays: [1], repeatEndDate: '2026-09-09' })
assert.equal(isTaskDueOnDate(weekly, '2026-09-07'), true)
assert.equal(isTaskDueOnDate(weekly, '2026-09-09'), false)
assert.equal(isTaskDueOnDate(weekly, '2026-09-14'), false)

assert.deepEqual(
  summarizeTaskDurationsForDates([endBounded], ['2026-09-13']),
  { pending: 0, done: 0 },
  'summary must exclude dates after the repeat end'
)

setState({ tasks: [task({ id: 'progress', dueDate: '2026-09-10', repeatStartDate: '2026-09-10', repeatEndDate: '2026-09-12' })] })
toggleTask('progress')
assert.equal(getState().tasks[0].dueDate, '2026-09-11')
assert.equal(getState().tasks[0].completed, false)
await waitForToggleThrottle()
toggleTask('progress')
assert.equal(getState().tasks[0].dueDate, '2026-09-12')
await waitForToggleThrottle()
toggleTask('progress')
assert.equal(getState().tasks[0].completed, true, 'completing the final valid occurrence ends the series')
assert.equal(getState().tasks[0].dueDate, '2026-09-12')
assert.equal(isTaskDueOnDate(getState().tasks[0], '2026-09-13'), false)
toggleTaskOnDate('progress', '2026-09-12')
assert.equal(getState().tasks[0].completed, false, 'unchecking the last occurrence must reopen the series')
assert.deepEqual(getState().tasks[0].completedDates, ['2026-09-10', '2026-09-11'])

const endBeforeNextRule = task({
  id: 'weekly-final',
  dueDate: '2026-09-07',
  repeatStartDate: '2026-09-07',
  repeatType: 'weekly',
  repeatDays: [1],
  repeatEndDate: '2026-09-09'
})
setState({ tasks: [endBeforeNextRule] })
toggleTask('weekly-final')
assert.equal(getState().tasks[0].completed, true, 'series must end when the end date falls between valid occurrences')
assert.equal(getState().tasks[0].dueDate, '2026-09-07')

const legacy = task({ id: 'legacy', repeatStartDate: '2026-09-10', dueDate: '2026-09-10' })
setState({ tasks: [legacy] })
toggleTask('legacy')
assert.equal(getState().tasks[0].completed, false)
assert.equal(getState().tasks[0].dueDate, '2026-09-11', 'legacy recurring tasks must remain open-ended')

const statsTask = task({
  id: 'stats',
  repeatStartDate: '2026-09-10',
  repeatEndDate: '2026-09-10',
  completedDates: ['2026-09-10', '2026-09-11']
})
setState({ tasks: [statsTask], weeklyGoalAnchor: '2026-09-10', weeklyGoalMinutes: 600 })
const stats = getWeeklyGoalStats()
assert.equal(stats.actualMinutes, 60, 'weekly statistics must ignore completed dates after the repeat end')
assert.equal(stats.completedCount, 1)

const normalized = normalizeStorageData({
  tasks: [
    task({ id: 'valid-end', repeatEndDate: '2026-09-12' }),
    task({ id: 'invalid-end', repeatEndDate: 'not-a-date' })
  ],
  categories: [],
  defaultCategory: '',
  hideCompleted: false,
  hideOverdue: false,
  showNoTimeLimitOnly: false
})
assert.equal(normalized.tasks.find(item => item.id === 'valid-end').repeatEndDate, '2026-09-12')
assert.equal(normalized.tasks.find(item => item.id === 'invalid-end').repeatEndDate, undefined)

const storageData = (tasks) => ({
  tasks,
  categories: [],
  defaultCategory: '',
  hideCompleted: false,
  hideOverdue: false,
  showNoTimeLimitOnly: false
})
const missingHistory = task({ id: 'missing-history', completed: true, repeatStartDate: '2026-09-10', dueDate: '2026-09-12', repeatEndDate: '2026-09-12' })
delete missingHistory.completedDates
const malformedHistory = task({ id: 'malformed-history', repeatDays: 'invalid', completedDates: null })
const normalizedHistory = normalizeStorageData(storageData([
  missingHistory,
  malformedHistory,
  task({ id: 'valid-history', completedDates: ['2026-09-10', 'bad-date'] })
]))
assert.deepEqual(normalizedHistory.tasks.find(item => item.id === 'missing-history').completedDates, [])
assert.equal(normalizedHistory.tasks.find(item => item.id === 'missing-history').completed, true, 'Missing history does not erase the original completion flag.')
assert.deepEqual(normalizedHistory.tasks.find(item => item.id === 'malformed-history').completedDates, [])
assert.deepEqual(normalizedHistory.tasks.find(item => item.id === 'malformed-history').repeatDays, [])
assert.deepEqual(normalizedHistory.tasks.find(item => item.id === 'valid-history').completedDates, ['2026-09-10'])

setState({ tasks: [task({ id: 'manual-reschedule', repeatStartDate: '2026-09-10', dueDate: '2026-09-11' })] })
moveTaskToDate('manual-reschedule', '2026-09-12')
await saveData(storageData(getState().tasks))
const rescheduledBackup = JSON.parse(localStore.get('tm_local_backup'))
assert.equal(rescheduledBackup.tasks[0].dueDate, '2026-09-12')
assert.deepEqual(rescheduledBackup.tasks[0].completedDates, [], 'Changing a recurring due date alone must not create completion history.')
assert.equal(rescheduledBackup.tasks[0].completed, false)

setState({ tasks: [missingHistory] })
await saveData(storageData(getState().tasks))
const missingHistoryBackup = JSON.parse(localStore.get('tm_local_backup'))
assert.deepEqual(missingHistoryBackup.tasks[0].completedDates, [])
assert.equal(missingHistoryBackup.tasks[0].completed, true, 'Storage migration preserves a legacy completion flag when history is absent.')

setState({ tasks: [task({ id: 'explicit-completion', repeatStartDate: '2026-09-10', dueDate: '2026-09-10' })] })
toggleTask('explicit-completion')
assert.deepEqual(getState().tasks[0].completedDates, ['2026-09-10'], 'Completing an occurrence records its exact date.')
await saveData(storageData(getState().tasks))
const completionBackup = JSON.parse(localStore.get('tm_local_backup'))
assert.deepEqual(completionBackup.tasks[0].completedDates, ['2026-09-10'], 'Explicit completion history survives persistence.')

const endedForStorage = task({
  id: 'ended-storage',
  repeatStartDate: '2026-09-10',
  repeatEndDate: '2026-09-10',
  completedDates: ['2026-09-10']
})
await saveData(storageData([endedForStorage]))
assert.equal(JSON.parse(localStore.get('tm_local_backup')).tasks[0].completed, true)
const activeForStorage = task({
  id: 'active-storage',
  repeatStartDate: '2026-09-10',
  repeatEndDate: '2026-09-12',
  completedDates: ['2026-09-10']
})
await saveData(storageData([activeForStorage]))
assert.equal(JSON.parse(localStore.get('tm_local_backup')).tasks[0].completed, false)

const [renderSource, eventSource, storageSource, typeSource] = await Promise.all([
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/storage.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/types.ts', import.meta.url), 'utf8')
])
assert.match(typeSource, /repeatEndDate\?: string/)
assert.match(renderSource, /id="repeatEndDateField"[\s\S]*重复截止日期 \*/)
assert.match(renderSource, /name="repeatEndDate" id="repeatEndDate"[\s\S]*min="\$\{task\.dueDate \|\| ''\}"[\s\S]*required/)
assert.match(renderSource, /repeatEndDateError/)
assert.match(eventSource, /请选择重复截止日期/)
assert.match(eventSource, /重复截止日期不能早于首次计划日期/)
assert.match(eventSource, /repeatEndDate: repeatType === 'none' \? undefined : repeatEndDate/)
assert.match(storageSource, /repeatEndDate: isValidDateOnly\(task\.repeatEndDate\)/)

globalThis.document = {
  createElement: () => ({
    textContent: '',
    get innerHTML() { return this.textContent }
  })
}
const renderBundle = await build({
  stdin: {
    contents: "export { renderModal } from './shared/render.ts'; export { setState } from './shared/task.ts';",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'repeat-end-date-render-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { renderModal, setState: setRenderState } =
  await import(`data:text/javascript,${encodeURIComponent(renderBundle.outputFiles[0].text)}`)
setRenderState({
  editingTask: task({ id: 'legacy-edit', repeatEndDate: undefined }),
  categories: [{ id: 'default', name: '默认', color: '#3b82f6' }],
  defaultCategory: 'default'
})
const legacyEditHtml = renderModal()
assert.match(legacyEditHtml, /id="repeatEndDateField" class="mt-4"/)
assert.match(legacyEditHtml, /name="repeatEndDate" id="repeatEndDate" value="" min="2026-09-10" required/)
setRenderState({ editingTask: task({ id: 'bounded-edit', repeatEndDate: '2026-09-12' }) })
assert.match(renderModal(), /name="repeatEndDate" id="repeatEndDate" value="2026-09-12" min="2026-09-10" required/)
setRenderState({ editingTask: task({ id: 'normal-edit', repeatType: 'none', repeatEndDate: '2026-09-12' }) })
assert.match(renderModal(), /id="repeatEndDateField" class="hidden mt-4"/)

console.log('Repeat end date tests passed')
