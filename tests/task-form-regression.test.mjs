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
    this.normal = new Section([
      new Control({ required: false, value: '' }),
      new Control({ required: false, value: '1.5' }),
      new Control({ required: false, value: 'high' }),
      new Control({ required: false, value: 'default-life' }),
    ])
    this.normalAdvanced = new Section([new Control({ required: false, value: '' })])
    this.parent = new Section([
      new Control({ required: true, value: '' }),
      new Control({ required: true, value: '' }),
      new Control({ required: false, value: '' }),
      new Control({ required: false, value: '' })
    ])
    this.completed = new Section([new Control()])
    this.moreOptions = { open: false }
    this.submit = new Control()
    this.buttons = [
      { dataset: { taskMode: 'normal' }, classList: new ClassList() },
      { dataset: { taskMode: 'parent' }, classList: new ClassList() }
    ]
  }
  querySelector(selector) {
    return {
      '#normalTaskFields': this.normal,
      '#normalAdvancedFields': this.normalAdvanced,
      '#taskMoreOptions': this.moreOptions,
      '#parentChildrenFields': this.parent,
      '#taskCompletedField': this.completed,
      '#taskSubmitBtn': this.submit
    }[selector] ?? null
  }
  querySelectorAll(selector) { return selector === '[data-task-mode]' ? this.buttons : [] }
  checkValidity() {
    return [this.normal, this.normalAdvanced, this.parent, this.completed].every(section =>
      section.controls.every(control => !control.required || control.disabled || Boolean(control.value))
    )
  }
}

const form = new Form()
applyTaskEntryMode(form, 'normal')
assert.equal(form.parent.controls.every(control => control.disabled), true)
assert.equal(form.normal.controls[0].disabled, false)
assert.equal(form.normalAdvanced.controls[0].disabled, false)
assert.equal(form.submit.disabled, false, 'ordinary task submit button remains enabled')
assert.equal(form.submit.textContent, '添加')
assert.equal(form.checkValidity(), true, 'hidden child requirements must not block ordinary task submission')
assert.equal(form.normal.controls[1].value, '1.5')
assert.equal(form.normal.controls[2].value, 'high')
assert.equal(form.normal.controls[3].value, 'default-life')

applyTaskEntryMode(form, 'parent')
assert.equal(form.normal.controls.every(control => control.disabled), true)
assert.equal(form.normal.controls[1].value, '1.5', 'switching mode keeps the visible duration value')
assert.equal(form.normal.controls[2].value, 'high', 'switching mode keeps the visible priority value')
assert.equal(form.normal.controls[3].value, 'default-life', 'switching mode keeps the visible category value')
assert.equal(form.normalAdvanced.controls[0].disabled, true)
assert.equal(form.parent.controls.every(control => control.disabled), false)
assert.equal(form.moreOptions.open, true, 'parent mode reveals the shared task options')
assert.equal(form.submit.textContent, '创建可拆分任务')
assert.equal(form.checkValidity(), false, 'visible child requirements remain enforced in parent mode')
applyTaskEntryMode(form, 'normal')
assert.equal(form.normal.controls.every(control => control.disabled === false), true)
assert.equal(form.normal.controls[1].value, '1.5', 'switching back restores duration control without rewriting it')
assert.equal(form.normal.controls[2].value, 'high')
assert.equal(form.normal.controls[3].value, 'default-life')
applyTaskEntryMode(form, 'parent')
form.parent.controls.forEach((control, index) => { if (index < 2) control.value = `子任务 ${index + 1}` })
assert.equal(form.checkValidity(), true, 'valid parent task fields allow submission')

assert.match(eventsSource, /if \(taskForm && !getState\(\)\.editingTask\) setTaskMode\('normal'\)/)
assert.match(eventsSource, /taskForm\?\.addEventListener\('submit'/)
assert.match(eventsSource, /addTask\(taskData, pendingTaskId \|\| undefined\)/)
assert.match(eventsSource, /await persistTaskMutation/)

// Render the real form and guard against reintroducing required inputs inside a hidden section.
globalThis.document = { createElement: () => ({ textContent: '', get innerHTML() { return this.textContent } }) }
const renderBundle = await build({
  stdin: {
    contents: "export { renderModal, renderSplitChildRow } from './shared/render.ts'; export { setState } from './shared/task.ts';",
    resolveDir: fileURLToPath(root),
    sourcefile: 'task-form-regression-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { renderModal, renderSplitChildRow, setState } = await import(`data:text/javascript,${encodeURIComponent(renderBundle.outputFiles[0].text)}`)
setState({ editingTask: null })
const addMarkup = renderModal()
assert.match(addMarkup, /id="dueDate" name="dueDate" value=""/)
assert.match(addMarkup, /<details id="taskMoreOptions"/)
assert.match(addMarkup, /id="durationInput" value="1\.0" min="0\.1"/)
const moreOptionsStart = addMarkup.indexOf('<details id="taskMoreOptions"')
const coreFieldsMarkup = addMarkup.slice(addMarkup.indexOf('<div id="normalTaskFields"'), moreOptionsStart)
const moreOptionsMarkup = addMarkup.slice(moreOptionsStart, addMarkup.indexOf('</details>', moreOptionsStart))
assert.ok(moreOptionsStart > 0)
assert.match(coreFieldsMarkup, /name="duration"/)
assert.match(coreFieldsMarkup, /name="priority"/)
assert.match(coreFieldsMarkup, /name="category"/)
assert.match(addMarkup, /class="split-child-duration[^\"]*" value="1" min="0"/)
assert.match(renderSplitChildRow(2), /class="split-child-duration[^\"]*" value="1" min="0"/)
assert.match(renderSplitChildRow(2, { title: 'Existing unestimated child', duration: 0, dueDate: '' }), /class="split-child-duration[^\"]*" value="" min="0"/)
assert.match(renderSplitChildRow(2, { title: 'Existing child', duration: 90, dueDate: '' }), /class="split-child-duration[^\"]*" value="1.5" min="0"/)
assert.doesNotMatch(moreOptionsMarkup, /name="duration"|name="priority"|name="category"/)
assert.match(moreOptionsMarkup, /name="description"/)
assert.match(addMarkup, /<section id="parentChildrenFields" class="hidden[\s\S]*?class="split-child-title[^>]*required/)
assert.doesNotMatch(addMarkup, /id="noTimeLimit"/)

const existingTask = {
  id: 'existing-unestimated-task', title: 'Existing task', description: '', priority: 'medium', category: 'default-life',
  dueDate: '', hardDeadline: '', focusDate: '', duration: 0, repeatType: 'none', repeatDays: [], repeatInterval: 1,
  repeatEndDate: '', noTimeLimit: true, completed: false, isParent: false,
}
setState({ editingTask: existingTask })
assert.match(renderModal(), /name="duration" id="durationInput" value="" min="0"/)
setState({ editingTask: { ...existingTask, duration: 90 } })
assert.match(renderModal(), /name="duration" id="durationInput" value="1\.5" min="0"/)
assert.match(eventsSource, /const parsedDuration = durationValue \? Number\.parseFloat\(durationValue\) : 0/)
assert.match(eventsSource, /else if \(typeof value === 'string'\) control\.value = value/)
console.log('Task form regression tests passed')
