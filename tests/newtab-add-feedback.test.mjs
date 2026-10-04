import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const root = new URL('..', import.meta.url)
const fixtures = {
  storage: `
    export const defaultCategories = [{ id: 'work', name: '工作', color: '#336699' }]
    export const generateId = () => 'generated-id'
    export const getNextLocalSettingsUpdatedAt = () => Date.now()
    export const loadData = async () => ({ tasks: [], categories: defaultCategories })
    export const saveData = async () => {
      globalThis.testSaveCount += 1
      if (globalThis.testPersistMode === 'failure') throw new Error('simulated local write failure')
      if (globalThis.testPersistMode === 'deferred') {
        await new Promise(resolve => { globalThis.releaseTestSave = resolve })
      }
      void syncIncrementally().then(result => {
        if (!result.success) globalThis.testCloudFailureObserved = true
      })
    }
    export const syncIncrementally = async () => globalThis.testCloudFailure
      ? ({ success: false, error: 'simulated cloud failure' })
      : ({ success: true })
    export const getSyncDeviceIdAsync = async () => 'synthetic-device'
    export const getGoogleAccount = async () => null
    export const confirmImportMerge = async () => ({ success: false })
    export const downloadExportFile = async () => undefined
    export const prepareImportPreview = async () => ({ success: false })
    export const recalculateImportPlan = () => ({})
  `,
  render: `
    export const renderApp = container => {
      globalThis.testRenderCount += 1
      container.renderCount += 1
    }
    export const focusLocatedTask = (container, taskId) => {
      globalThis.testFocusedTaskId = taskId
      return true
    }
    export const renderSplitChildRow = () => '<div class="split-child-row"></div>'
  `,
  sync: `
    export const showToast = (container, message, type = 'success', action) => {
      globalThis.testToasts.push({ container, message, type, action, renderCountAtToast: container.renderCount })
    }
    export const markCloudSynced = () => {}
    export const markLocalSave = () => {}
    export const markSaveComplete = () => {}
    export const markRemoteUpdated = () => {}
    export const markSyncError = () => {}
    export const onSyncStatusChange = () => {}
    export const getSyncStatus = () => 'idle'
    export const shouldRefreshAppForSyncStatus = () => false
  `
}

const bundled = await build({
  stdin: {
    contents: "export { attachEventListeners } from './shared/events.ts'; export { getState, setState } from './shared/task.ts';",
    resolveDir: fileURLToPath(root),
    sourcefile: 'newtab-add-feedback-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [{
    name: 'newtab-add-fixtures',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/(storage|render|sync)$/ }, args => ({ path: args.path.slice(2), namespace: 'newtab-fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'newtab-fixture' }, args => ({ contents: fixtures[args.path], loader: 'js' }))
    }
  }]
})
const app = await import(`data:text/javascript,${encodeURIComponent(bundled.outputFiles[0].text)}`)

class FakeClassList {
  values = new Set()
  add(name) { this.values.add(name) }
  remove(name) { this.values.delete(name) }
  contains(name) { return this.values.has(name) }
  toggle(name, force) {
    const shouldAdd = force ?? !this.values.has(name)
    if (shouldAdd) this.values.add(name)
    else this.values.delete(name)
    return shouldAdd
  }
}

class FakeElement {
  listeners = new Map()
  classList = new FakeClassList()
  dataset = {}
  style = {}
  children = []
  disabled = false
  value = ''
  textContent = ''
  checked = false
  open = false
  type = ''
  name = ''
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || []
    callbacks.push(callback)
    this.listeners.set(type, callbacks)
  }
  querySelector() { return null }
  querySelectorAll() { return [] }
  setAttribute() {}
  removeAttribute() {}
  focus() {}
  scrollIntoView() {}
  closest() { return null }
  getBoundingClientRect() { return { bottom: 0, width: 0, height: 0, top: 0, left: 0, right: 0 } }
  replaceChildren(...children) {
    this.children = children
    this.textContent = children.map(child => child?.textContent || '').join('')
  }
  append(...children) { this.children.push(...children) }
  appendChild(child) { this.children.push(child); return child }
}

class FakeForm extends FakeElement {
  constructor() {
    super()
    this.sections = new Map([
      ['#normalTaskFields', new FakeElement()],
      ['#normalAdvancedFields', new FakeElement()],
      ['#taskMoreOptions', new FakeElement()],
      ['#parentChildrenFields', new FakeElement()],
      ['#taskCompletedField', new FakeElement()]
    ])
    this.submitButton = new FakeElement()
    this.submitButton.textContent = '添加'
    this.titleInput = new FakeElement()
    this.titleInput.name = 'title'
    this.dueDate = new FakeElement()
    this.dueDate.name = 'dueDate'
    this.duration = new FakeElement()
    this.repeatType = new FakeElement()
    this.repeatType.value = 'none'
    this.repeatEndDate = new FakeElement()
    this.repeatEndDateField = new FakeElement()
    this.completed = new FakeElement()
    this.modeButtons = ['normal', 'parent'].map(mode => {
      const button = new FakeElement()
      button.dataset.taskMode = mode
      return button
    })
  }
  querySelector(selector) {
    if (selector === '#taskSubmitBtn') return this.submitButton
    if (selector === '[name="title"]') return this.titleInput
    if (selector === '#durationInput') return this.duration
    if (selector === '#repeatType') return this.repeatType
    if (selector === '#repeatEndDate') return this.repeatEndDate
    if (selector === '#repeatEndDateField') return this.repeatEndDateField
    if (selector === '#taskCompleted') return this.completed
    if (selector === 'input[name="dueDate"]') return this.dueDate
    return this.sections.get(selector) || null
  }
  querySelectorAll(selector) {
    if (selector === '[data-task-mode]') return this.modeButtons
    if (selector === 'input, textarea, select, button') return [this.titleInput, this.submitButton]
    return []
  }
}

class FakeChildRow extends FakeElement {
  constructor(index, dueDate = '') {
    super()
    this.fields = new Map([
      ['.split-child-title', Object.assign(new FakeElement(), { value: `虚构子任务 ${index}` })],
      ['.split-child-duration', Object.assign(new FakeElement(), { value: '' })],
      ['.split-child-date', Object.assign(new FakeElement(), { value: dueDate })]
    ])
  }
  querySelector(selector) { return this.fields.get(selector) || null }
}

class FakeContainer extends FakeElement {
  constructor() {
    super()
    this.renderCount = 0
    this.form = new FakeForm()
    this.modal = new FakeElement()
    this.saveError = new FakeElement()
    this.parentError = new FakeElement()
    this.childRows = [new FakeChildRow(1), new FakeChildRow(2, '2026-10-04')]
    this.childList = new FakeElement()
    this.childList.querySelectorAll = selector => selector === '.split-child-row' ? this.childRows : []
  }
  querySelector(selector) {
    if (selector === '#taskForm') return this.form
    if (selector === '#taskModal') return this.modal
    if (selector === '#taskSaveError') return this.saveError
    if (selector === '#parentTaskError') return this.parentError
    if (selector === '#newParentChildren') return this.childList
    return null
  }
  querySelectorAll(selector) {
    if (selector === '[data-task-mode]') return this.form.modeButtons
    if (selector === '#newParentChildren .split-child-row') return this.childRows
    return []
  }
}

const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  FormData: globalThis.FormData,
  chrome: globalThis.chrome
}

globalThis.window = {
  location: { pathname: '/newtab/newtab.html' },
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false })
}
globalThis.document = {
  body: new FakeElement(),
  documentElement: new FakeElement(),
  createElement: () => new FakeElement(),
  createTextNode: text => Object.assign(new FakeElement(), { textContent: String(text) }),
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {}
}
globalThis.FormData = class {
  get(name) { return globalThis.testFormValues[name] ?? null }
}

const resetScenario = (values = {}, persistMode = 'success') => {
  globalThis.window.location.pathname = '/newtab/newtab.html'
  globalThis.testFormValues = {
    title: '虚构新增任务',
    description: '',
    priority: 'medium',
    category: 'work',
    hardDeadline: '',
    dueDate: '',
    repeatType: 'none',
    repeatInterval: '1',
    ...values
  }
  globalThis.testPersistMode = persistMode
  globalThis.testSaveCount = 0
  globalThis.testRenderCount = 0
  globalThis.testToasts = []
  globalThis.releaseTestSave = null
  globalThis.testCloudFailure = false
  globalThis.testCloudFailureObserved = false
  app.setState({
    tasks: [],
    categories: [{ id: 'work', name: '工作', color: '#336699' }],
    defaultCategory: 'work',
    hideCompleted: false,
    hideOverdue: false,
    showNoTimeLimitOnly: false,
    darkMode: false,
    currentView: 'focus',
    currentDate: '2026-10-03',
    filterPriority: 'all',
    filterCategory: 'all',
    taskLocatorId: undefined,
    editingTask: null
  })
  const container = new FakeContainer()
  container.form.titleInput.value = globalThis.testFormValues.title
  container.form.dueDate.value = globalThis.testFormValues.dueDate
  app.attachEventListeners(container)
  return { container, form: container.form, submit: container.form.listeners.get('submit')[0] }
}

const submitEvent = form => ({ target: form, preventDefault() {} })

let scenario = resetScenario()
await scenario.submit(submitEvent(scenario.form))
assert.equal(app.getState().tasks.length, 1, 'an unscheduled task is persisted as one local task')
assert.equal(app.getState().tasks[0].noTimeLimit, true)
assert.deepEqual(globalThis.testToasts.map(({ message, type }) => ({ message, type })), [
  { message: '已添加到任务池', type: 'success' }
])
assert.equal(globalThis.testToasts[0].container, scenario.container, 'feedback uses the stable app container after rerender')
assert.equal(globalThis.testRenderCount, 1, 'success closes and rerenders the form before showing feedback')
assert.equal(globalThis.testToasts[0].renderCountAtToast, 1, 'feedback appears after the form has rerendered')
assert.equal(globalThis.testToasts[0].action?.label, '查看', 'pool success feedback offers an accessible task locator')
globalThis.testToasts[0].action.onClick()
assert.equal(globalThis.testFocusedTaskId, app.getState().tasks[0].id, 'the view action locates the saved task without creating another')
assert.equal(app.getState().tasks.length, 1)

scenario = resetScenario({ dueDate: '2026-10-02' })
await scenario.submit(submitEvent(scenario.form))
assert.equal(app.getState().tasks[0].dueDate, '2026-10-02', 'a past plan date remains unchanged after save')
assert.equal(app.getState().tasks[0].noTimeLimit, false)
assert.equal(globalThis.testToasts[0]?.message, '已添加到 2026-10-02', 'dated success reports the actual local plan date, including the past')
assert.equal(globalThis.testToasts[0]?.action?.label, '查看')
const datedTaskId = app.getState().tasks[0].id
globalThis.testToasts[0].action.onClick()
globalThis.testToasts[0].action.onClick()
assert.equal(app.getState().tasks.filter(task => task.id === datedTaskId).length, 1, 'repeating the view action does not duplicate the saved task')
assert.equal(app.getState().taskLocatorId, datedTaskId)

scenario = resetScenario({ dueDate: '2026-10-04' })
globalThis.testCloudFailure = true
await scenario.submit(submitEvent(scenario.form))
await Promise.resolve()
assert.equal(app.getState().tasks.length, 1, 'an asynchronous cloud failure does not undo a successful local save')
assert.equal(globalThis.testToasts[0]?.message, '已添加到 2026-10-04', 'local-save feedback names the destination without claiming cloud sync success')
assert.equal(globalThis.testCloudFailureObserved, true)

scenario = resetScenario({}, 'failure')
await scenario.submit(submitEvent(scenario.form))
assert.equal(app.getState().tasks.length, 0, 'failed local persistence rolls back the synthetic task')
assert.equal(globalThis.testToasts.some(toast => toast.type === 'success'), false, 'failed persistence never shows success')
assert.match(scenario.container.saveError.textContent, /本地保存失败/)

scenario = resetScenario({}, 'deferred')
const firstSubmit = scenario.submit(submitEvent(scenario.form))
const duplicateSubmit = scenario.submit(submitEvent(scenario.form))
await Promise.resolve()
await Promise.resolve()
assert.equal(globalThis.testSaveCount, 1, 'a second submit is blocked while the first write is pending')
assert.equal(app.getState().tasks.length, 1, 'repeated submit does not create a duplicate task')
globalThis.releaseTestSave()
await Promise.all([firstSubmit, duplicateSubmit])
assert.equal(globalThis.testToasts.filter(toast => toast.type === 'success').length, 1)

scenario = resetScenario({ title: '虚构大任务' })
const parentButton = scenario.form.modeButtons.find(button => button.dataset.taskMode === 'parent')
parentButton.listeners.get('click')[0]({ currentTarget: parentButton })
await scenario.submit(submitEvent(scenario.form))
assert.equal(app.getState().tasks.filter(task => task.isParent).length, 1)
assert.equal(app.getState().tasks.filter(task => task.parentId).length, 2)
assert.equal(globalThis.testToasts[0]?.message, '已创建大任务和 2 个子任务')
assert.equal(globalThis.testToasts.some(toast => toast.message === '已添加到任务池'), false, 'parent feedback does not claim all children enter the pool')
assert.equal(globalThis.testToasts[0]?.action?.label, '查看', 'parent creation can locate its parent group')
const parentId = app.getState().tasks.find(task => task.isParent)?.id
globalThis.testToasts[0].action.onClick()
assert.equal(app.getState().taskLocatorId, parentId, 'parent view action points to the parent, regardless of child dates')

scenario = resetScenario({ dueDate: '2026-10-05' })
app.setState({ filterPriority: 'high' })
await scenario.submit(submitEvent(scenario.form))
const filteredTaskId = app.getState().tasks[0].id
globalThis.testToasts[0].action.onClick()
assert.equal(app.getState().taskLocatorId, filteredTaskId, 'a filtered task is temporarily locatable')
assert.equal(app.getState().filterPriority, 'high', 'locating a task never changes the saved priority filter')
assert.equal(globalThis.testToasts.at(-1)?.message, '已临时显示目标任务；原筛选保持不变。调整筛选可查看更多任务。')
assert.equal(globalThis.testToasts.at(-1)?.action?.label, '调整筛选')

scenario = resetScenario({ dueDate: '2026-10-05' })
await scenario.submit(submitEvent(scenario.form))
app.setState({ tasks: [] })
globalThis.testToasts[0].action.onClick()
assert.equal(globalThis.testToasts.at(-1)?.type, 'error', 'a deleted or account-missing task is reported as unavailable')
assert.equal(app.getState().taskLocatorId, undefined, 'a missing task is never restored by the locator')

scenario = resetScenario({ dueDate: '2026-10-06' })
await scenario.submit(submitEvent(scenario.form))
const popupTaskId = app.getState().tasks[0].id
globalThis.chrome = {
  runtime: {
    lastError: undefined,
    sendMessage(message, callback) {
      globalThis.testOpenNewTabMessage = message
      callback?.()
    }
  }
}
globalThis.window.location.pathname = '/popup/popup.html'
globalThis.testToasts[0].action.onClick()
assert.deepEqual(globalThis.testOpenNewTabMessage, { action: 'openNewTab', taskId: popupTaskId }, 'Popup opens the existing management page with the saved task ID')

const legacyTask = (id, overrides = {}) => ({
  id,
  title: id,
  description: '',
  priority: 'medium',
  category: 'work',
  dueDate: '2026-10-04',
  duration: 0,
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
const legacyTasks = [
  legacyTask('legacy-missing-history', { repeatStartDate: '2026-10-03' }),
  legacyTask('legacy-null-history', { completed: true, repeatDays: null, completedDates: null }),
  legacyTask('legacy-wrong-type-history', { repeatDays: 'invalid', completedDates: '2026-10-03' }),
  legacyTask('legacy-partial-history', { repeatDays: [0, 8, 'invalid'], completedDates: ['2026-10-03', 'not-a-date', null] }),
  legacyTask('legacy-valid-history', { completedDates: ['2026-10-03'] }),
  legacyTask('legacy-parent', { isParent: true, duration: 0, dueDate: '', noTimeLimit: true, completedDates: undefined, repeatDays: undefined }),
  legacyTask('legacy-child', { id: 'legacy-child', parentId: 'legacy-parent', repeatType: 'none', completedDates: undefined, repeatDays: undefined })
]
delete legacyTasks[0].completedDates
delete legacyTasks[0].repeatDays
const legacyTaskCount = legacyTasks.length

scenario = resetScenario({ title: '兼容旧任务后新增' })
app.setState({ tasks: legacyTasks })
await scenario.submit(submitEvent(scenario.form))
const savedLegacyTasks = app.getState().tasks
assert.equal(savedLegacyTasks.length, legacyTaskCount + 1, 'Adding a task preserves every existing legacy task.')
assert.ok(savedLegacyTasks.some(task => task.title === '兼容旧任务后新增'), 'The new task saves alongside legacy tasks.')
assert.equal(savedLegacyTasks.find(task => task.id === 'legacy-missing-history').completedDates, undefined, 'Missing completion history does not block the form mutation.')
assert.equal(savedLegacyTasks.find(task => task.id === 'legacy-null-history').completedDates, null, 'Null completion history does not block the form mutation.')
assert.equal(savedLegacyTasks.find(task => task.id === 'legacy-null-history').completed, true, 'A legacy completion flag survives when no date history exists.')
assert.equal(savedLegacyTasks.find(task => task.id === 'legacy-wrong-type-history').completedDates, '2026-10-03', 'Wrong-type history does not block the form mutation.')
assert.deepEqual(savedLegacyTasks.find(task => task.id === 'legacy-partial-history').completedDates, ['2026-10-03', 'not-a-date', null], 'Unmodified legacy history remains available to storage normalization.')
assert.deepEqual(savedLegacyTasks.find(task => task.id === 'legacy-partial-history').repeatDays, [0, 8, 'invalid'])
assert.deepEqual(savedLegacyTasks.find(task => task.id === 'legacy-valid-history').completedDates, ['2026-10-03'], 'Valid completion history remains unchanged.')
assert.equal(savedLegacyTasks.find(task => task.id === 'legacy-child').parentId, 'legacy-parent', 'The existing parent-child relationship remains intact.')
assert.equal(globalThis.testToasts[0]?.message, '已添加到任务池', 'Legacy-compatible save receives normal success feedback.')

scenario = resetScenario({ title: '异常数据下保留输入并可重试' })
app.setState({ tasks: [null] })
const originalConsoleError = console.error
console.error = () => {}
try {
  await scenario.submit(submitEvent(scenario.form))
} finally {
  console.error = originalConsoleError
}
assert.equal(app.getState().tasks[0], null, 'A pre-save preparation error does not mutate the legacy task list.')
assert.match(scenario.container.saveError.textContent, /本机任务数据异常/)
assert.equal(scenario.form.titleInput.value, '异常数据下保留输入并可重试', 'The form keeps the entered title after a preparation error.')
assert.equal(scenario.form.submitButton.disabled, false, 'The submit button is available for retry after a preparation error.')
assert.equal(scenario.form.submitButton.textContent, '添加', 'The retry label is restored after a preparation error.')
app.setState({ tasks: [] })
await scenario.submit(submitEvent(scenario.form))
assert.equal(app.getState().tasks.filter(task => task.title === '异常数据下保留输入并可重试').length, 1, 'The same form can be retried successfully.')

for (const [key, value] of Object.entries(originalGlobals)) {
  if (value === undefined) delete globalThis[key]
  else globalThis[key] = value
}

console.log('Newtab task submit feedback, local failure, duplicate guard, and parent task flow tests passed')
