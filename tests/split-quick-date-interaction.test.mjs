import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, transform } from 'esbuild'

const source = await readFile(new URL('../shared/quick-dates.ts', import.meta.url), 'utf8')
const compiled = await transform(source, { loader: 'ts', format: 'esm', platform: 'node' })
const quickDates = await import(`data:text/javascript,${encodeURIComponent(compiled.code)}`)
const taskBundle = await build({ entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { getState, setState, splitTask } = await import(`data:text/javascript,${encodeURIComponent(taskBundle.outputFiles[0].text)}`)

class ClassList extends Set {
  toggle(name, force) { if (force === undefined ? !this.has(name) : force) this.add(name); else this.delete(name) }
}
class Node {
  constructor(classes = [], date = '') { this.classList = new ClassList(classes); this.dataset = date ? { date } : {}; this.value = ''; this.children = []; this.parent = null; this.listeners = {} }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn) }
  dispatch(type, target = this) { for (const fn of this.listeners[type] ?? []) fn({ type, target }) }
  append(...children) { children.forEach(child => { child.parent = this; this.children.push(child) }) }
  closest(selector) { if (selector.includes('split-child-row')) return this.classList.has('split-child-row') ? this : (this.parent?.closest(selector) ?? null); if (selector.includes('quick-date-btn')) return this.classList.has('quick-date-btn') ? this : null; return null }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]).filter(child => selector.includes('dueDate') ? child === taskInput : selector.includes('split-child-date') ? child.classList.has('split-child-date') : selector.includes('quick-date-btn') ? child.classList.has('quick-date-btn') : false) }
  setAttribute() {}
}

const task = new Node(); const taskInput = new Node(); const taskButton = new Node(['quick-date-btn'], '2099-01-07'); task.append(taskInput, taskButton)
const split = new Node(); const rowA = new Node(['split-child-row']); const rowB = new Node(['split-child-row']); const inputA = new Node(['split-child-date']); const inputB = new Node(['split-child-date']); const buttonA = new Node(['quick-date-btn'], '2099-01-08'); const buttonB = new Node(['quick-date-btn'], '2099-01-09'); rowA.append(inputA, buttonA); rowB.append(inputB, buttonB); split.append(rowA, rowB)
quickDates.bindTaskQuickDates(task)
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

console.log('Split quick date DOM interaction tests passed')
