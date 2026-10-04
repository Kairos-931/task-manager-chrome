import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, transform } from 'esbuild'

class ClassList extends Set {
  toggle(name, force) {
    if (force === undefined ? !this.has(name) : force) this.add(name)
    else this.delete(name)
  }
}

class Node {
  constructor(classes = [], tagName = 'div') {
    this.classList = new ClassList(classes)
    this.dataset = {}
    this.value = ''
    this.children = []
    this.parent = null
    this.listeners = {}
    this.tagName = tagName.toUpperCase()
    this.type = ''
    this.name = ''
    this.textContent = ''
    this.disabled = false
    this.style = {}
  }
  addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler) }
  async dispatch(type, target = this) {
    const event = {
      type,
      target,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true },
      stopPropagation() {}
    }
    for (const handler of this.listeners[type] ?? []) await handler(event)
    return event
  }
  append(...children) {
    children.forEach(child => {
      child.parent = this
      this.children.push(child)
    })
  }
  appendChild(child) { this.append(child); return child }
  matches(selector) {
    if (selector === ':scope > .split-child-row') return this.classList.has('split-child-row')
    if (selector.startsWith('.')) return this.classList.has(selector.slice(1))
    if (selector === 'button[type="submit"]') return this.tagName === 'BUTTON' && this.type === 'submit'
    if (selector === 'input') return this.tagName === 'INPUT'
    return false
  }
  closest(selector) {
    if (selector.includes(' ')) {
      const [ancestorSelector, childSelector] = selector.split(/\s+/)
      if (!this.matches(childSelector)) return null
      return this.parent?.closest(ancestorSelector) ? this : null
    }
    if (this.matches(selector)) return this
    return this.parent?.closest(selector) ?? null
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) {
    if (selector === ':scope > .split-child-row') return this.children.filter(child => child.classList.has('split-child-row'))
    return this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]).filter(child => child.matches(selector))
  }
  setAttribute(name, value) {
    this[name] = value
    this[name.replace(/-([a-z])/g, (_, character) => character.toUpperCase())] = value
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
  }
  focus() { this.focused = true }
  scrollIntoView() { this.scrolled = true }
}

const quickDatesSource = await readFile(new URL('../shared/quick-dates.ts', import.meta.url), 'utf8')
const quickDatesCompiled = await transform(quickDatesSource, { loader: 'ts', format: 'esm', platform: 'node' })
const { bindSplitQuickDates } = await import(`data:text/javascript,${encodeURIComponent(quickDatesCompiled.code)}`)

const taskBundle = await build({
  entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { getState, setState, splitTask } =
  await import(`data:text/javascript,${encodeURIComponent(taskBundle.outputFiles[0].text)}`)

const renderBundle = await build({
  stdin: {
    contents: "export { renderSplitChildRow, renderSplitModal } from './shared/render.ts'; export { setState } from './shared/task.ts';",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'optional-split-child-dates-render-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
globalThis.document = {
  createElement: () => ({
    textContent: '',
    get innerHTML() { return this.textContent }
  })
}
globalThis.window = { location: { pathname: '/popup/popup.html' } }
const { renderSplitChildRow, renderSplitModal, setState: setRenderState } =
  await import(`data:text/javascript,${encodeURIComponent(renderBundle.outputFiles[0].text)}`)

const normalParent = {
  id: 'split-parent',
  title: '待拆分任务',
  description: '',
  priority: 'medium',
  category: 'default',
  dueDate: '2099-01-01',
  duration: 60,
  repeatType: 'none',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: [],
  createdAt: 1,
  updatedAt: 1,
  noTimeLimit: false
}

const blankRowHtml = renderSplitChildRow(0, undefined, '', { allowUnscheduled: true })
assert.match(blankRowHtml, /class="split-child-duration[^"]*" value="1" min="0"/)
assert.match(blankRowHtml, /class="split-child-unscheduled"[^>]*aria-pressed="true"[^>]*>暂不安排/)
assert.match(blankRowHtml, /split-child-date-status[^>]*>暂不安排 · 进入任务池/)
assert.match(blankRowHtml, /class="split-child-date[^"]*"[^>]*value=""/)
assert.doesNotMatch(blankRowHtml, /class="split-child-date[^"]*"[^>]*required/)
const datedRowHtml = renderSplitChildRow(0, undefined, '2099-01-08', { allowUnscheduled: true })
assert.match(datedRowHtml, /class="split-child-unscheduled"[^>]*aria-pressed="false"/)
assert.match(datedRowHtml, /split-child-date-status[^>]*>已安排 2099-01-08/)

const splitModal = new Node()
const row = new Node(['split-child-row'])
const dates = new Node(['split-quick-dates'])
const quick = new Node(['quick-date-btn'], 'button')
quick.dataset.date = '2099-01-08'
const dateInput = new Node(['split-child-date'], 'input')
const unscheduled = new Node(['split-child-unscheduled'], 'button')
const status = new Node(['split-child-date-status'])
dates.append(quick)
row.append(dates, dateInput, unscheduled, status)
splitModal.append(row)
bindSplitQuickDates(splitModal)
await splitModal.dispatch('click', quick)
assert.equal(dateInput.value, '2099-01-08')
assert.equal(quick.classList.has('selected'), true)
assert.equal(unscheduled.ariaPressed, 'false')
assert.equal(status.textContent, '已安排 2099-01-08')
await splitModal.dispatch('click', unscheduled)
assert.equal(dateInput.value, '')
assert.equal(quick.classList.has('selected'), false)
assert.equal(unscheduled.ariaPressed, 'true')
assert.equal(status.textContent, '暂不安排 · 进入任务池')

setState({ tasks: [normalParent] })
assert.equal(splitTask(normalParent.id, [
  { title: '步骤一', duration: 60, dueDate: '' },
  { title: '步骤二', duration: 90, dueDate: '' }
]), true)
let children = getState().tasks.filter(task => task.parentId === normalParent.id)
assert.deepEqual(children.map(child => ({ dueDate: child.dueDate, noTimeLimit: child.noTimeLimit })), [
  { dueDate: '', noTimeLimit: true },
  { dueDate: '', noTimeLimit: true }
])

const mixedParent = { ...normalParent, id: 'mixed-parent' }
setState({ tasks: [mixedParent] })
assert.equal(splitTask(mixedParent.id, [
  { title: '已排期', duration: 60, dueDate: '2099-01-08' },
  { title: '待安排', duration: 90, dueDate: '' }
]), true)
children = getState().tasks.filter(task => task.parentId === mixedParent.id)
assert.deepEqual(children.map(child => ({ dueDate: child.dueDate, noTimeLimit: child.noTimeLimit })), [
  { dueDate: '2099-01-08', noTimeLimit: false },
  { dueDate: '', noTimeLimit: true }
])

const unestimatedParent = { ...normalParent, id: 'unestimated-parent' }
setState({ tasks: [unestimatedParent] })
assert.equal(splitTask(unestimatedParent.id, [
  { title: '未估步骤一', duration: 0, dueDate: '' },
  { title: '未估步骤二', duration: 0, dueDate: '' }
]), true)
children = getState().tasks.filter(task => task.parentId === unestimatedParent.id)
assert.ok(children.every(child => child.duration === 0 && child.noTimeLimit && child.dueDate === ''))

const editableParent = { ...normalParent, id: 'editable-parent', isParent: true, dueDate: '', duration: 0, noTimeLimit: true }
const existingDated = { ...normalParent, id: 'existing-dated', parentId: editableParent.id, dueDate: '2099-01-08', noTimeLimit: false }
const existingPool = { ...normalParent, id: 'existing-pool', parentId: editableParent.id, dueDate: '', noTimeLimit: true }
setState({ tasks: [editableParent, existingDated, existingPool] })
assert.equal(splitTask(editableParent.id, [
  { id: existingDated.id, title: existingDated.title, duration: 60, dueDate: '' },
  { id: existingPool.id, title: existingPool.title, duration: 90, dueDate: '2099-01-09' }
]), true)
assert.equal(getState().tasks.find(task => task.id === existingDated.id).noTimeLimit, true)
assert.equal(getState().tasks.find(task => task.id === existingDated.id).dueDate, '')
assert.equal(getState().tasks.find(task => task.id === existingPool.id).noTimeLimit, false)

const atomicParent = { ...normalParent, id: 'atomic-parent' }
setState({ tasks: [atomicParent] })
const beforeInvalid = getState().tasks.length
assert.equal(splitTask(atomicParent.id, [
  { title: '', duration: 60, dueDate: '' },
  { title: '合法步骤', duration: 0, dueDate: '' }
]), false)
assert.equal(getState().tasks.length, beforeInvalid)

setRenderState({
  tasks: [normalParent],
  splittingTaskId: normalParent.id
})
const splitModalHtml = renderSplitModal()
assert.equal((splitModalHtml.match(/class="split-child-date w-full[^"]*"/g) || []).length, 2)
assert.equal((splitModalHtml.match(/class="split-child-date[^>]*required/g) || []).length, 0)
assert.equal((splitModalHtml.match(/暂不安排 · 进入任务池/g) || []).length, 2)

const [taskSource, renderSource, eventsSource] = await Promise.all([
  readFile(new URL('../shared/task.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8')
])
assert.match(taskSource, /noTimeLimit: !child\.dueDate/)
assert.match(renderSource, /allowUnscheduled/)
assert.match(renderSource, /renderSplitChildRow\(index, child, child\?\.dueDate \|\| ''/)
assert.match(eventsSource, /waitingCount = children\.filter\(child => !child\.dueDate\)\.length/)
assert.match(eventsSource, /splitTaskSnapshot/)
const parentValidation = eventsSource.match(/const invalidIndex = children\.findIndex\(child => ([^\n]+)\)/)?.[1] || ''
assert.doesNotMatch(parentValidation, /dueDate/)

console.log('Optional split child date tests passed')
