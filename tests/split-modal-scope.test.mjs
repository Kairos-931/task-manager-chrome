import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { isInteractiveTaskModalOpen } from '../shared/interactive-modal.ts'
import { shouldRefreshAppForSyncStatus } from '../shared/sync.ts'

const [eventsSource, renderSource] = await Promise.all([
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
])
assert.match(eventsSource, /bindSplitTaskModalInteractions\(\{/)
assert.match(renderSource, /id="newParentChildren"[\s\S]*?renderSplitChildRow/)
assert.match(renderSource, /id="splitTaskForm" class="split-task-form space-y-4" novalidate>[\s\S]*id="splitChildren"/)

const splitModalBundle = await build({
  entryPoints: [fileURLToPath(new URL('../shared/split-modal.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { bindSplitTaskModalInteractions } = await import(`data:text/javascript,${encodeURIComponent(splitModalBundle.outputFiles[0].text)}`)
const taskBundle = await build({
  entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { getState, setState, splitTask, persistTaskMutation } = await import(`data:text/javascript,${encodeURIComponent(taskBundle.outputFiles[0].text)}`)

class ClassList extends Set {
  contains(name) { return this.has(name) }
  add(name) { super.add(name); return this }
  remove(name) { this.delete(name) }
  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.has(name) : force
    if (shouldAdd) this.add(name)
    else this.delete(name)
    return shouldAdd
  }
}

class FakeElement {
  constructor({ id = '', classes = [], value = '', dataset = {}, tagName = 'div' } = {}) {
    this.id = id
    this.classList = new ClassList(classes)
    this.value = value
    this.dataset = { ...dataset }
    this.tagName = tagName
    this.children = []
    this.parentElement = null
    this.listeners = new Map()
    this.textContent = ''
    this.disabled = false
    this.focused = false
    this.scrolled = false
  }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child }
  append(...children) { children.forEach(child => this.appendChild(child)) }
  remove() {
    if (!this.parentElement) return
    this.parentElement.children = this.parentElement.children.filter(child => child !== this)
    this.parentElement = null
  }
  contains(target) {
    return target === this || this.children.some(child => child.contains(target))
  }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || []
    callbacks.push(callback)
    this.listeners.set(type, callbacks)
  }
  dispatch(type, target = this) {
    const event = { type, target, currentTarget: this, preventDefault() { this.defaultPrevented = true } }
    return (this.listeners.get(type) || []).map(callback => callback(event))
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1)
    if (selector === 'button[type="submit"]') return this.tagName === 'button' && this.type === 'submit'
    if (selector === '.split-quick-dates .quick-date-btn') {
      return this.classList.contains('quick-date-btn') && this.closest('.split-quick-dates') !== null
    }
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1))
    return false
  }
  querySelectorAll(selector) {
    const result = []
    const visit = node => node.children.forEach(child => {
      if (child.matches(selector)) result.push(child)
      visit(child)
    })
    visit(this)
    return result
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
  closest(selector) {
    let current = this
    while (current) {
      if (current.matches(selector)) return current
      current = current.parentElement
    }
    return null
  }
  focus() { this.focused = true }
  scrollIntoView() { this.scrolled = true }
  setAttribute(name, value) { this[name] = value }
  dispatchEvent() {}
}

const makeRow = ({ title = '', duration = '', date = '', childId } = {}) => {
  const row = new FakeElement({ classes: ['split-child-row'], dataset: childId ? { childId } : {} })
  row.titleInput = new FakeElement({ classes: ['split-child-title'], value: title, tagName: 'input' })
  row.durationInput = new FakeElement({ classes: ['split-child-duration'], value: duration, tagName: 'input' })
  row.dateInput = new FakeElement({ classes: ['split-child-date'], value: date, tagName: 'input' })
  row.removeButton = new FakeElement({ classes: ['remove-split-child'], tagName: 'button' })
  const quickDates = new FakeElement({ classes: ['split-quick-dates'] })
  row.quickDate = new FakeElement({ classes: ['quick-date-btn'], dataset: { date: '2026-10-07' }, tagName: 'button' })
  const unscheduled = new FakeElement({ classes: ['split-child-unscheduled'], tagName: 'button' })
  const status = new FakeElement({ classes: ['split-child-date-status'] })
  quickDates.append(row.quickDate, unscheduled)
  row.append(row.titleInput, row.durationInput, row.dateInput, row.removeButton, quickDates, status)
  return row
}

class FakeRowWrapper extends FakeElement {
  set innerHTML(markup) {
    const index = Number(markup.match(/data-index="(\d+)"/)?.[1] || 0)
    this.firstElementChild = makeRow({ title: `新增步骤 ${index + 1}` })
  }
}

const originalDocument = globalThis.document
globalThis.document = { createElement: () => new FakeRowWrapper() }

const container = new FakeElement()
const taskModal = new FakeElement({ id: 'taskModal', classes: ['hidden'] })
const parentChildren = new FakeElement({ id: 'newParentChildren' })
const hiddenRows = [makeRow(), makeRow(), makeRow()]
parentChildren.append(...hiddenRows)
taskModal.append(parentChildren)

const splitModal = new FakeElement({ id: 'splitTaskModal' })
const form = new FakeElement({ id: 'splitTaskForm' })
const splitChildren = new FakeElement({ id: 'splitChildren' })
const splitRows = [
  makeRow({ title: '步骤一', duration: '1.0' }),
  makeRow({ title: '步骤二', duration: '0.5' }),
]
splitChildren.append(...splitRows)
const addButton = new FakeElement({ id: 'addSplitChildBtn', tagName: 'button' })
const error = new FakeElement({ id: 'splitTaskError', classes: ['hidden'] })
const submitButton = new FakeElement({ classes: [], tagName: 'button' })
submitButton.type = 'submit'
form.append(splitChildren, addButton, error, submitButton)
splitModal.append(form)
container.append(taskModal, splitModal)

assert.equal(isInteractiveTaskModalOpen(container), true)
assert.equal(shouldRefreshAppForSyncStatus('remote-updated', isInteractiveTaskModalOpen(container)), false)
assert.equal(shouldRefreshAppForSyncStatus('error', isInteractiveTaskModalOpen(container)), false)

const parent = {
  id: 'scope-parent', title: '要拆分的任务', description: '', priority: 'medium', category: 'default-life',
  dueDate: '2026-10-06', hardDeadline: '', duration: 60, repeatType: 'none', repeatDays: [], repeatInterval: 1,
  completed: false, completedDates: [], createdAt: 1, updatedAt: 1, noTimeLimit: false, isParent: false,
}
setState({ tasks: [parent], splittingTaskId: parent.id })
let attempts = 0
let releaseFirstSave
let finishFirstAttempt
let finishSecondAttempt
const firstAttemptFinished = new Promise(resolve => { finishFirstAttempt = resolve })
const secondAttemptFinished = new Promise(resolve => { finishSecondAttempt = resolve })
let savedChildren = []
let savedCount = 0
const renderedIndices = []

bindSplitTaskModalInteractions({
  modal: splitModal,
  getSplittingTaskId: () => getState().splittingTaskId,
  renderChildRow: index => { renderedIndices.push(index); return `<div data-index="${index}"></div>` },
  persistChildren: async (taskId, children) => {
    attempts += 1
    let applied = false
    const saved = await persistTaskMutation(() => {
      applied = splitTask(taskId, children)
      return applied
    }, async () => attempts === 1 ? new Promise(resolve => { releaseFirstSave = resolve }) : true)
    savedChildren = children
    ;(attempts === 1 ? finishFirstAttempt : finishSecondAttempt)({ applied, saved })
    return { applied, saved }
  },
  onSaved: children => {
    savedCount += 1
    savedChildren = children
    setState({ splittingTaskId: null })
  },
})

// Hidden add-task rows neither prevent removal of the last two split rows nor attach split actions.
splitChildren.dispatch('click', splitRows[0].removeButton)
assert.equal(splitChildren.querySelectorAll('.split-child-row').length, 2)
assert.equal(error.textContent, '至少保留两个子任务。')
assert.equal(parentChildren.querySelectorAll('.split-child-row').length, 3)
assert.deepEqual(hiddenRows.map(row => row.removeButton.listeners.size), [0, 0, 0])

// Date shortcuts and new rows are bound inside #splitChildren only.
splitChildren.dispatch('click', splitRows[0].quickDate)
assert.equal(splitRows[0].dateInput.value, '2026-10-07')
assert.equal(hiddenRows[0].dateInput.value, '')
addButton.dispatch('click')
assert.deepEqual(renderedIndices, [2])
assert.equal(splitChildren.querySelectorAll('.split-child-row').length, 3)
assert.equal(parentChildren.querySelectorAll('.split-child-row').length, 3)
const addedRow = splitChildren.querySelectorAll('.split-child-row')[2]
assert.equal(addedRow.titleInput.focused, true)
splitChildren.dispatch('click', addedRow.removeButton)
assert.equal(splitChildren.querySelectorAll('.split-child-row').length, 2)

// A genuinely empty split row reports and focuses the visible split field.
splitRows[0].titleInput.value = ''
form.dispatch('submit')
assert.equal(error.textContent, '请填写子任务 1 的标题。')
assert.equal(splitRows[0].titleInput.focused, true)
assert.equal(attempts, 0)
splitRows[0].titleInput.value = '步骤一'
error.classList.add('hidden')

const firstDispatch = form.dispatch('submit')
assert.equal(firstDispatch.length, 1)
for (let i = 0; i < 10 && !releaseFirstSave; i += 1) await Promise.resolve()
assert.equal(typeof releaseFirstSave, 'function', 'valid split submission reaches the delayed local save')
assert.equal(attempts, 1)
assert.equal(submitButton.disabled, true)
assert.equal(getState().splittingTaskId, parent.id)
assert.equal(splitRows[0].titleInput.value, '步骤一')
assert.equal(splitRows[1].dateInput.value, '', 'an unscheduled child remains valid for the task pool')
form.dispatch('submit')
assert.equal(attempts, 1, 'a second submit while saving must not create duplicate children')
assert.equal(isInteractiveTaskModalOpen(container), true)
assert.equal(shouldRefreshAppForSyncStatus('remote-updated', isInteractiveTaskModalOpen(container)), false)

releaseFirstSave(false)
assert.deepEqual(await firstAttemptFinished, { applied: true, saved: false })
for (let i = 0; i < 10 && submitButton.disabled; i += 1) await Promise.resolve()
assert.equal(submitButton.disabled, false)
assert.match(error.textContent, /拆分保存失败/)
assert.equal(splitRows[0].titleInput.value, '步骤一', 'failed save preserves the split form input')
assert.equal(getState().tasks.length, 1, 'failed save rolls back the attempted split')
assert.equal(getState().splittingTaskId, parent.id, 'failed save retains the split target')

form.dispatch('submit')
assert.deepEqual(await secondAttemptFinished, { applied: true, saved: true })
for (let i = 0; i < 10 && savedCount === 0; i += 1) await Promise.resolve()
assert.equal(savedCount, 1)
assert.equal(savedChildren.length, 2)
assert.equal(getState().tasks.length, 3, 'retry creates each child once')
assert.equal(getState().tasks.filter(task => task.parentId === parent.id).length, 2)
assert.equal(getState().tasks.find(task => task.parentId === parent.id && task.title === '步骤二').noTimeLimit, true)
assert.equal(getState().splittingTaskId, null)

if (originalDocument === undefined) delete globalThis.document
else globalThis.document = originalDocument
console.log('Dual-modal split scope, validation, retry, and sync-refresh tests passed')
