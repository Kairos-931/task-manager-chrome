import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, transform } from 'esbuild'

const [source, eventsSource] = await Promise.all([
  readFile(new URL('../shared/task-form.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8')
])
const compiled = await transform(source, { loader: 'ts', format: 'esm', platform: 'node' })
const { applyTaskEntryMode } = await import(`data:text/javascript,${encodeURIComponent(compiled.code)}`)

class ClassList extends Set { toggle(name, force) { if (force) this.add(name); else this.delete(name) } }
class Control { constructor({ required = false, value = '' } = {}) { this.required = required; this.value = value; this.disabled = false } }
class Section { constructor(controls) { this.controls = controls; this.classList = new ClassList() } querySelectorAll() { return this.controls } }
class Form {
  constructor() {
    this.normal = new Section([new Control({ required: true, value: '2026-09-05' })])
    this.parent = new Section([new Control({ required: true, value: '' })])
    this.completed = new Section([new Control()])
    this.submit = new Control()
    this.buttons = [{ dataset: { taskMode: 'normal' }, classList: new ClassList() }, { dataset: { taskMode: 'parent' }, classList: new ClassList() }]
  }
  querySelector(selector) { return { '#normalTaskFields': this.normal, '#parentChildrenFields': this.parent, '#taskCompletedField': this.completed, '#taskSubmitBtn': this.submit }[selector] ?? null }
  querySelectorAll(selector) { return selector === '[data-task-mode]' ? this.buttons : [] }
  checkValidity() {
    return [this.normal, this.parent, this.completed].every(section => section.controls.every(control => !control.required || control.disabled || Boolean(control.value)))
  }
}

const form = new Form()
applyTaskEntryMode(form, 'normal')
assert.equal(form.parent.controls[0].disabled, true)
assert.equal(form.normal.controls[0].disabled, false)
assert.equal(form.completed.controls[0].disabled, false)
assert.equal(form.submit.textContent, '添加')
assert.equal(form.checkValidity(), true, '隐藏的新增父任务空行不应阻止普通任务提交')
applyTaskEntryMode(form, 'parent')
assert.equal(form.parent.controls[0].disabled, false)
assert.equal(form.normal.controls[0].disabled, true)
assert.equal(form.completed.controls[0].disabled, true)
assert.equal(form.submit.textContent, '创建可拆分任务')
assert.match(eventsSource, /if \(taskForm && !getState\(\)\.editingTask\) setTaskMode\('normal'\)/)

// 编辑普通任务与父任务时没有任务类型切换，按钮文案必须保持“保存”。
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
    sourcefile: 'task-form-regression-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { renderModal, setState } = await import(`data:text/javascript,${encodeURIComponent(renderBundle.outputFiles[0].text)}`)
const baseTask = {
  id: 'edit-normal', title: '普通任务', description: '', priority: 'medium', category: '默认', dueDate: '2099-01-01', duration: 60,
  repeatType: 'none', repeatDays: [], repeatInterval: 1, completed: false, completedDates: [], createdAt: Date.now(), updatedAt: Date.now(), noTimeLimit: false
}
setState({ editingTask: baseTask, categories: [{ id: '默认', name: '默认', color: '#3b82f6' }] })
assert.match(renderModal(), /id="taskSubmitBtn"[^>]*>保存<\/button>/, '编辑普通任务应显示保存')
setState({ editingTask: { ...baseTask, id: 'edit-parent', title: '父任务', isParent: true, noTimeLimit: true, dueDate: '', duration: 0 } })
assert.match(renderModal(), /id="taskSubmitBtn"[^>]*>保存<\/button>/, '编辑父任务应显示保存')
setState({ editingTask: null })
console.log('Task form regression tests passed')
