import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, transform } from 'esbuild'

const root = new URL('..', import.meta.url)
const [source, eventsSource] = await Promise.all([
  readFile(new URL('../shared/task-form.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8')
])
const compiled = await transform(source, { loader: 'ts', format: 'esm', platform: 'node' })
const { applyTaskEntryMode } = await import(`data:text/javascript,${encodeURIComponent(compiled.code)}`)

class ClassList extends Set {
  toggle(name, force) { if (force) this.add(name); else this.delete(name) }
}
class Control {
  constructor({ required = false, value = '' } = {}) {
    this.required = required
    this.value = value
    this.disabled = false
  }
}
class Section {
  constructor(controls) { this.controls = controls; this.classList = new ClassList() }
  querySelectorAll() { return this.controls }
}
class Form {
  constructor() {
    this.normal = new Section([new Control({ required: true, value: '2026-10-02' })])
    this.parent = new Section([
      new Control({ required: true, value: '' }),
      new Control({ required: true, value: '' })
    ])
    this.completed = new Section([new Control()])
    this.submit = new Control()
    this.buttons = [
      { dataset: { taskMode: 'normal' }, classList: new ClassList() },
      { dataset: { taskMode: 'parent' }, classList: new ClassList() }
    ]
  }
  querySelector(selector) {
    return {
      '#normalTaskFields': this.normal,
      '#parentChildrenFields': this.parent,
      '#taskCompletedField': this.completed,
      '#taskSubmitBtn': this.submit
    }[selector] ?? null
  }
  querySelectorAll(selector) { return selector === '[data-task-mode]' ? this.buttons : [] }
  checkValidity() {
    return [this.normal, this.parent, this.completed].every(section =>
      section.controls.every(control => !control.required || control.disabled || Boolean(control.value))
    )
  }
}

const form = new Form()
applyTaskEntryMode(form, 'normal')
assert.equal(form.parent.controls.every(control => control.disabled), true)
assert.equal(form.normal.controls[0].disabled, false)
assert.equal(form.submit.disabled, false, 'ordinary task submit button remains enabled')
assert.equal(form.submit.textContent, '添加')
assert.equal(form.checkValidity(), true, 'hidden child requirements must not block ordinary task submission')

applyTaskEntryMode(form, 'parent')
assert.equal(form.normal.controls[0].disabled, true)
assert.equal(form.parent.controls.every(control => control.disabled), false)
assert.equal(form.submit.textContent, '创建可拆分任务')
assert.equal(form.checkValidity(), false, 'visible child requirements remain enforced in parent mode')
form.parent.controls.forEach((control, index) => { control.value = index === 0 ? '子任务' : '2026-10-03' })
assert.equal(form.checkValidity(), true, 'valid parent task fields allow submission')

assert.match(eventsSource, /if \(taskForm && !getState\(\)\.editingTask\) setTaskMode\('normal'\)/)
assert.match(eventsSource, /taskForm\?\.addEventListener\('submit'/)
assert.match(eventsSource, /addTask\(taskData, pendingTaskId \|\| undefined\)/)
assert.match(eventsSource, /await persistTaskMutation/)

// Render the real form and guard against reintroducing required inputs inside a hidden section.
globalThis.document = { createElement: () => ({ textContent: '', get innerHTML() { return this.textContent } }) }
const renderBundle = await build({
  stdin: {
    contents: "export { renderModal } from './shared/render.ts'; export { setState } from './shared/task.ts';",
    resolveDir: fileURLToPath(root),
    sourcefile: 'task-form-regression-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { renderModal, setState } = await import(`data:text/javascript,${encodeURIComponent(renderBundle.outputFiles[0].text)}`)
setState({ editingTask: null })
assert.match(renderModal(), /<section id="parentChildrenFields" class="hidden[\s\S]*?class="split-child-title[^>]*required/)
console.log('Task form regression tests passed')
