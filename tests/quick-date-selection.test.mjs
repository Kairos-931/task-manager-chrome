import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { bindTaskQuickDates } from '../shared/quick-dates.ts'

const [renderSource, eventsSource] = await Promise.all([
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
])

assert.match(renderSource, /aria-pressed="\$\{isSelected\}"/)
assert.match(eventsSource, /button\.classList\.toggle\('selected', selected\)/)
assert.match(eventsSource, /button\.setAttribute\('aria-pressed', String\(selected\)\)/)

assert.match(renderSource, /\.quick-date-btn\.today:not\(\.selected\) \.quick-date-badge/)
assert.doesNotMatch(
  renderSource,
  /\.quick-date-btn\.today\s*\{[^}]*?(?:border-color|background):/s,
  'today must not look selected when another or out-of-range date is selected'
)

class FakeControl {
  constructor(dataset = {}) {
    this.dataset = dataset
    this.value = ''
    this.checked = false
    this.listeners = new Map()
    this.attributes = new Map()
    this.classes = new Set()
    this.classList = { toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name) }
  }
  addEventListener(name, callback) { this.listeners.set(name, callback) }
  dispatchEvent(event) { this.listeners.get(event.type)?.({ type: event.type, target: this }); return true }
  setAttribute(name, value) { this.attributes.set(name, value) }
  click() { this.listeners.get('click')?.({ target: this }) }
}

const dateInput = new FakeControl()
dateInput.value = '2026-10-04'
dateInput.dataset.defaultDate = '2026-10-04'
const poolInput = new FakeControl()
const todayButton = new FakeControl({ date: '2026-10-04' })
const tomorrowButton = new FakeControl({ date: '2026-10-05' })
const taskDateForm = {
  querySelector: selector => selector === '#noTimeLimit' ? poolInput : dateInput,
  querySelectorAll: selector => selector === '.quick-date-btn' ? [todayButton, tomorrowButton] : [],
}
bindTaskQuickDates(taskDateForm)()
assert.equal(todayButton.attributes.get('aria-pressed'), 'true')
poolInput.checked = true
poolInput.dispatchEvent({ type: 'change' })
assert.equal(dateInput.value, '', 'selecting the task pool clears the date')
assert.equal(poolInput.checked, true)
assert.equal(todayButton.attributes.get('aria-pressed'), 'false')
poolInput.checked = false
poolInput.dispatchEvent({ type: 'change' })
assert.equal(dateInput.value, '2026-10-04', 'leaving the pool chooses the entry default date')
dateInput.value = '2020-01-01'
dateInput.dispatchEvent({ type: 'change' })
assert.equal(poolInput.checked, false, 'a past date exits the task pool')
dateInput.value = ''
dateInput.dispatchEvent({ type: 'change' })
assert.equal(poolInput.checked, true, 'clearing the date enters the task pool')
tomorrowButton.click()
assert.equal(dateInput.value, '2026-10-05', 'quick date selection schedules the task')
assert.equal(poolInput.checked, false)
assert.equal(tomorrowButton.attributes.get('aria-pressed'), 'true')

console.log('Quick date selection tests passed')
