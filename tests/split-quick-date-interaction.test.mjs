import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, transform } from 'esbuild'

const source = await readFile(new URL('../shared/quick-dates.ts', import.meta.url), 'utf8')
const splitScopeSource = await readFile(new URL('../shared/split-scope.ts', import.meta.url), 'utf8')
const splitInteractionPath = fileURLToPath(new URL('../shared/split-interaction.ts', import.meta.url))
const compiled = await transform(source, { loader: 'ts', format: 'esm', platform: 'node' })
const quickDates = await import(`data:text/javascript,${encodeURIComponent(compiled.code)}`)
const splitScopeCompiled = await transform(splitScopeSource, { loader: 'ts', format: 'esm', platform: 'node' })
const { getSplitChildRows, collectSplitChildren } = await import(`data:text/javascript,${encodeURIComponent(splitScopeCompiled.code)}`)
const splitInteractionBundle = await build({ entryPoints: [splitInteractionPath], bundle: true, format: 'esm', platform: 'node', write: false })
const { bindSplitTaskForm, bindSplitTaskTriggers } = await import(`data:text/javascript,${encodeURIComponent(splitInteractionBundle.outputFiles[0].text)}`)
const taskBundle = await build({ entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { getState, setState, splitTask, createParentWithChildren, createParentWithChildrenPersisted } = await import(`data:text/javascript,${encodeURIComponent(taskBundle.outputFiles[0].text)}`)

class ClassList extends Set {
  toggle(name, force) { if (force === undefined ? !this.has(name) : force) this.add(name); else this.delete(name) }
}
class Node {
  constructor(classes = [], date = '', tagName = 'div') { this.classList = new ClassList(classes); this.dataset = date ? { date } : {}; this.value = ''; this.children = []; this.parent = null; this.listeners = {}; this.tagName = tagName.toUpperCase(); this.type = ''; this.name = ''; this.hidden = false; this.disabled = false; this.focused = false; this.textContent = '' }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn) }
  async dispatch(type, target = this) {
    const event = { type, target, currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, stopPropagation() {} }
    await Promise.all((this.listeners[type] ?? []).map(fn => fn(event)))
    return event
  }
  fire(type, target = this) {
    const event = { type, target, currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, stopPropagation() {} }
    for (const fn of this.listeners[type] ?? []) void fn(event)
  }
  append(...children) { children.forEach(child => { child.parent = this; this.children.push(child) }) }
  appendChild(child) { this.append(child); return child }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()))
    if (selector === '*') return true
    if (selector.includes(' ')) return selector.split(/\s+/).at(-1) && this.matches(selector.split(/\s+/).at(-1))
    if (selector.startsWith('.')) return this.classList.has(selector.slice(1))
    if (selector.startsWith('#')) return this.id === selector.slice(1)
    if (selector === 'input' || selector === 'textarea' || selector === 'select' || selector === 'button') return this.tagName === selector.toUpperCase()
    if (selector === 'input[name="dueDate"]') return this.tagName === 'INPUT' && this.name === 'dueDate'
    if (selector === 'button[type="submit"]') return this.tagName === 'BUTTON' && this.type === 'submit'
    return false
  }
  closest(selector) {
    if (this.matches(selector)) return this
    return this.parent?.closest(selector) ?? null
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) {
    if (selector === ':scope > .split-child-row') return this.children.filter(child => child.classList.has('split-child-row'))
    return this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]).filter(child => child.matches(selector))
  }
  setAttribute(name, value) { this[name] = value }
  focus() { this.focused = true }
  scrollIntoView() { this.scrolled = true }
}

const task = new Node(); const normalFields = new Node(); const taskInput = new Node([], '', 'input'); taskInput.name = 'dueDate'; const taskButton = new Node(['quick-date-btn'], '2099-01-07'); normalFields.append(taskInput, taskButton); task.append(normalFields)
const split = new Node(); const rowA = new Node(['split-child-row']); const rowB = new Node(['split-child-row']); const inputA = new Node(['split-child-date']); const inputB = new Node(['split-child-date']); const buttonA = new Node(['quick-date-btn'], '2099-01-08'); const buttonB = new Node(['quick-date-btn'], '2099-01-09'); rowA.append(inputA, buttonA); rowB.append(inputB, buttonB); split.append(rowA, rowB)
task.append(split)
quickDates.bindTaskQuickDates(normalFields)
quickDates.bindSplitQuickDates(split)
taskButton.dispatch('click'); assert.equal(taskInput.value, '2099-01-07'); assert.equal(inputA.value, '')
split.dispatch('click', buttonA); assert.equal(inputA.value, '2099-01-08'); assert.equal(inputB.value, '')
split.dispatch('click', buttonB); assert.equal(inputA.value, '2099-01-08'); assert.equal(inputB.value, '2099-01-09')
const parent = { id: 'split-test-parent', title: '待拆分', description: '', priority: 'medium', category: '默认', dueDate: '2099-01-01', duration: 60, repeatType: 'none', repeatDays: [], repeatInterval: 1, completed: false, completedDates: [], createdAt: Date.now(), updatedAt: Date.now(), noTimeLimit: false }
setState({ tasks: [parent] })
assert.equal(splitTask(parent.id, [{ title: '子任务 A', duration: 30, dueDate: inputA.value }, { title: '子任务 B', duration: 45, dueDate: inputB.value }]), true)
const savedChildren = getState().tasks.filter(task => task.parentId === parent.id)
assert.deepEqual(savedChildren.map(task => task.dueDate), ['2099-01-08', '2099-01-09'])
const guard = quickDates.createSubmissionGuard(); assert.equal(guard(), true); assert.equal(guard(), false)
setState({ tasks: [] })
assert.equal(createParentWithChildren({ title: '新大任务', description: '', priority: 'high', category: '默认', hardDeadline: undefined, completed: false, noTimeLimit: true, repeatType: 'none', repeatDays: [], repeatInterval: 1 }, [{ title: '一', duration: 30, dueDate: '2099-01-08' }, { title: '二', duration: 60, dueDate: '2099-01-09' }]), true)
assert.equal(getState().tasks.length, 3)
assert.equal(getState().tasks.filter(task => task.isParent)[0].duration, 0)
const countBeforeInvalidCreate = getState().tasks.length
assert.equal(createParentWithChildren({ title: '不会写入', description: '', priority: 'high', category: '默认', hardDeadline: undefined, completed: false, noTimeLimit: true, repeatType: 'none', repeatDays: [], repeatInterval: 1 }, [{ title: '无效', duration: 30, dueDate: '' }]), false)
assert.equal(getState().tasks.length, countBeforeInvalidCreate)
const failedSnapshot = getState().tasks.length
assert.equal(await createParentWithChildrenPersisted({ title: '保存失败', description: '', priority: 'high', category: '默认', hardDeadline: undefined, completed: false, noTimeLimit: true, repeatType: 'none', repeatDays: [], repeatInterval: 1 }, [{ title: '一', duration: 30, dueDate: '2099-01-08' }, { title: '二', duration: 60, dueDate: '2099-01-09' }], async () => false), false)
assert.equal(getState().tasks.length, failedSnapshot)
assert.equal(await createParentWithChildrenPersisted({ title: '保存成功', description: '', priority: 'high', category: '默认', hardDeadline: undefined, completed: false, noTimeLimit: true, repeatType: 'none', repeatDays: [], repeatInterval: 1 }, [{ title: '一', duration: 30, dueDate: '2099-01-08' }, { title: '二', duration: 60, dueDate: '2099-01-09' }], async () => true), true)
const retryGuard = quickDates.createResettableSubmissionGuard(); assert.equal(retryGuard.trySubmit(), true); assert.equal(retryGuard.trySubmit(), false); retryGuard.reset(); assert.equal(retryGuard.trySubmit(), true)
const hiddenNewParentRow = { title: '' }
const visibleSplitRows = [{ title: '当前拆分一' }, { title: '当前拆分二' }]
const page = { hiddenNewParentRow, splitModal: { splitChildren: { querySelectorAll: selector => { assert.equal(selector, ':scope > .split-child-row'); return visibleSplitRows } } } }
assert.deepEqual(getSplitChildRows(page.splitModal.splitChildren), visibleSplitRows)
assert.equal(getSplitChildRows(page.splitModal.splitChildren).some(row => row === hiddenNewParentRow), false)

// 完整拆分交互：点击入口打开弹窗，添加第三行，填写后提交并关闭；同页隐藏的新增父任务空行不能混入提交。
const makeSplitRow = (title, duration, dueDate, id = '') => {
  const row = new Node(['split-child-row'])
  if (id) row.dataset.childId = id
  const titleInput = new Node(['split-child-title'], '', 'input'); titleInput.value = title
  const durationInput = new Node(['split-child-duration'], '', 'input'); durationInput.value = duration
  const dateInput = new Node(['split-child-date'], '', 'input'); dateInput.value = dueDate
  row.append(titleInput, durationInput, dateInput)
  return row
}
const flowParent = { id: 'flow-parent', title: '待处理任务', description: '', priority: 'medium', category: '默认', dueDate: '2099-01-01', duration: 120, repeatType: 'none', repeatDays: [], repeatInterval: 1, completed: false, completedDates: [], createdAt: Date.now(), updatedAt: Date.now(), noTimeLimit: false }
setState({ tasks: [flowParent] })
const flowPage = new Node()
const splitTrigger = new Node(['task-split']); splitTrigger.dataset.id = flowParent.id
const hiddenParentFields = new Node(); hiddenParentFields.append(makeSplitRow('', '1', ''))
const modal = new Node(); modal.hidden = true
const splitForm = new Node([], '', 'form')
const splitChildren = new Node()
splitChildren.append(makeSplitRow('步骤一', '1', '2099-01-08'), makeSplitRow('步骤二', '1.5', '2099-01-09'))
const addSplitChildBtn = new Node([], '', 'button')
const splitSubmitBtn = new Node([], '', 'button'); splitSubmitBtn.type = 'submit'
const splitError = new Node(); splitForm.append(splitSubmitBtn); modal.append(splitForm); flowPage.append(splitTrigger, hiddenParentFields, modal)
let activeSplitTaskId = null
let splitClosed = false
bindSplitTaskTriggers(flowPage, { onOpen: taskId => { activeSplitTaskId = taskId; modal.hidden = false } })
bindSplitTaskForm({
  form: splitForm,
  children: splitChildren,
  addButton: addSplitChildBtn,
  getTaskId: () => activeSplitTaskId,
  createChildRow: () => makeSplitRow('', '1', '2099-01-10'),
  splitTask: (taskId, children) => splitTask(taskId, children),
  onError: message => { splitError.textContent = message },
  onSuccess: async children => {
    assert.equal(children.length, 3)
    splitClosed = true
    activeSplitTaskId = null
    modal.hidden = true
  }
})
await splitTrigger.dispatch('click')
assert.equal(activeSplitTaskId, flowParent.id)
assert.equal(modal.hidden, false)
assert.equal(getSplitChildRows(splitChildren).length, 2)
await addSplitChildBtn.dispatch('click')
assert.equal(getSplitChildRows(splitChildren).length, 3)
const addedFlowRow = getSplitChildRows(splitChildren)[2]
await splitForm.dispatch('submit')
assert.equal(splitError.textContent, '请填写子任务 3 的标题。', '新增空行后提交应明确提示当前可见行，而不是静默无效')
assert.equal(getState().tasks.filter(task => task.parentId === flowParent.id).length, 0)
addedFlowRow.querySelector('.split-child-title').value = '步骤三'
addedFlowRow.querySelector('.split-child-duration').value = '0.5'
addedFlowRow.querySelector('.split-child-date').value = '2099-01-10'
assert.deepEqual(collectSplitChildren(splitChildren).map(child => child.title), ['步骤一', '步骤二', '步骤三'])
assert.equal(collectSplitChildren(splitChildren).some(child => child.title === ''), false, '隐藏新增父任务空行不得污染拆分提交')
await splitForm.dispatch('submit')
assert.equal(splitClosed, true)
assert.equal(modal.hidden, true)
assert.equal(activeSplitTaskId, null)
assert.equal(splitSubmitBtn.disabled, true)
const flowChildren = getState().tasks.filter(task => task.parentId === flowParent.id)
assert.equal(flowChildren.length, 3)
assert.deepEqual(flowChildren.map(task => task.title), ['步骤一', '步骤二', '步骤三'])
assert.equal(hiddenParentFields.querySelector('.split-child-title').value, '')

// 模拟真实 reRender 后重新绑定的新表单，连续两轮仍应各保存一次且不残留旧提交锁。
const runSplitRound = async (round) => {
  const page = new Node()
  const trigger = new Node(['task-split']); trigger.dataset.id = flowParent.id
  const modal = new Node(); modal.hidden = true
  const form = new Node([], '', 'form')
  const children = new Node()
  getState().tasks.filter(task => task.parentId === flowParent.id).forEach(task => {
    children.append(makeSplitRow(task.title, String(task.duration / 60), task.dueDate, task.id))
  })
  const add = new Node([], '', 'button')
  const submit = new Node([], '', 'button'); submit.type = 'submit'; form.append(submit)
  const error = new Node(); modal.append(form); page.append(trigger, modal)
  let activeId = null
  let closed = false
  bindSplitTaskTriggers(page, { onOpen: taskId => { activeId = taskId; modal.hidden = false } })
  bindSplitTaskForm({
    form,
    children,
    addButton: add,
    getTaskId: () => activeId,
    createChildRow: () => makeSplitRow('', '1', '2099-01-10'),
    splitTask: (taskId, values) => splitTask(taskId, values),
    onError: message => { error.textContent = message },
    onSuccess: async values => {
      assert.equal(values.at(-1).title, `步骤${round}`)
      closed = true
      activeId = null
      modal.hidden = true
    }
  })
  await trigger.dispatch('click')
  await add.dispatch('click')
  const row = getSplitChildRows(children).at(-1)
  row.querySelector('.split-child-title').value = `步骤${round}`
  row.querySelector('.split-child-duration').value = '0.5'
  row.querySelector('.split-child-date').value = `2099-01-${10 + round}`
  await form.dispatch('submit')
  assert.equal(closed, true)
  assert.equal(modal.hidden, true)
  assert.equal(submit.disabled, true)
}
await runSplitRound(4)
await runSplitRound(5)
assert.equal(getState().tasks.filter(task => task.parentId === flowParent.id).length, 5)

// 浏览器不会等待 addEventListener 的 async 回调；onSuccess/reRender 抛错必须被生产绑定捕获，不能形成未捕获 Promise。
const rejectedForm = new Node([], '', 'form')
const rejectedChildren = new Node()
rejectedChildren.append(makeSplitRow('步骤一', '1', '2099-01-08'), makeSplitRow('步骤二', '1', '2099-01-09'))
let rejectedError = ''
let uncaughtRejection = null
let loggedSubmitError = ''
const onUnhandledRejection = reason => { uncaughtRejection = reason }
const originalConsoleError = console.error
console.error = (...args) => { loggedSubmitError = args.map(String).join(' ') }
process.on('unhandledRejection', onUnhandledRejection)
bindSplitTaskForm({
  form: rejectedForm,
  children: rejectedChildren,
  addButton: null,
  getTaskId: () => 'flow-parent',
  createChildRow: () => null,
  splitTask: () => true,
  onError: message => { rejectedError = message },
  onSuccess: async () => { throw new Error('newtab re-render failed') }
})
rejectedForm.fire('submit')
await new Promise(resolve => setImmediate(resolve))
process.off('unhandledRejection', onUnhandledRejection)
console.error = originalConsoleError
assert.equal(uncaughtRejection, null, '异步拆分回调错误不得成为未捕获 Promise')
assert.equal(rejectedError, '拆分保存失败，请重试')
assert.match(loggedSubmitError, /split task submit failed/)

const failedPersistForm = new Node([], '', 'form')
const failedPersistChildren = new Node()
failedPersistChildren.append(makeSplitRow('步骤一', '1', '2099-01-08'), makeSplitRow('步骤二', '1', '2099-01-09'))
const failedPersistSubmit = new Node([], '', 'button'); failedPersistSubmit.type = 'submit'; failedPersistForm.append(failedPersistSubmit)
let failedPersistError = ''
let persistAttempts = 0
bindSplitTaskForm({
  form: failedPersistForm,
  children: failedPersistChildren,
  addButton: null,
  getTaskId: () => 'flow-parent',
  createChildRow: () => null,
  splitTask: () => true,
  onError: message => { failedPersistError = message },
  onSuccess: async () => { persistAttempts++; return false }
})
failedPersistForm.fire('submit')
await new Promise(resolve => setImmediate(resolve))
assert.equal(failedPersistError, '拆分保存失败，请重试', '本地保存失败应保留弹窗并给出重试提示')
assert.equal(failedPersistSubmit.disabled, false)
failedPersistForm.fire('submit')
await new Promise(resolve => setImmediate(resolve))
assert.equal(persistAttempts, 2, '保存失败后应允许再次提交')

console.log('Split quick date DOM interaction tests passed')
