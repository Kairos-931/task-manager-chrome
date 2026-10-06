import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { isValidLocalDate } from '../shared/replan-policy.js'

const [policySource, renderSource, eventSource, taskSource, bundleSource] = await Promise.all([
  readFile(new URL('../shared/replan-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/task.ts', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/bundle.mjs', import.meta.url), 'utf8'),
])

for (const date of ['2026-09-30', '2026-09-23', '2026-09-01', '2025-12-31', '2024-02-29']) {
  assert.equal(isValidLocalDate(date), true, date + ' should be a valid local plan date')
}
for (const date of ['', '2026-02-29', '2026-09-31', '2026-13-01', '2026/09/30', '0000-01-01']) {
  assert.equal(isValidLocalDate(date), false, date + ' should be rejected as an invalid local date')
}
assert.doesNotMatch(policySource, /toISOString\s*\(/)

const modalStart = renderSource.indexOf('export const renderReplanModal')
const modalEnd = renderSource.indexOf('export const renderSplitModal', modalStart)
assert.ok(modalStart >= 0 && modalEnd > modalStart, 'shared replan modal should be present')
const modalSource = renderSource.slice(modalStart, modalEnd)
assert.ok(modalSource.includes('7 天以外的日期'), 'existing date label should stay unchanged')
assert.ok(modalSource.includes("renderQuickDates('')"), 'existing quick-date choices should stay unchanged')
const replanInputs = [...modalSource.matchAll(/<input type="date"[^>]*(?:id|name)="replanDate"[^>]*>/g)].map(match => match[0])
assert.ok(replanInputs.length > 0, 'the existing custom date input should remain')
assert.ok(replanInputs.every(input => !/\smin=/.test(input)), 'past dates must not be blocked in any replan modal by an HTML minimum')
assert.doesNotMatch(modalSource, /自选日期|应该哪天完成/)

const taskDateInput = renderSource.match(/<input type="date"[^>]*\bname="dueDate"[^>]*>/)?.[0] || ''
const splitDateInput = renderSource.match(/<input type="date" class="split-child-date[^>]*>/)?.[0] || ''
assert.ok(taskDateInput && splitDateInput, 'ordinary-task and split-child scheduling inputs should remain')
assert.doesNotMatch(taskDateInput, /\smin=/)
assert.doesNotMatch(splitDateInput, /\smin=/)
assert.match(renderSource, /name="repeatEndDate" id="repeatEndDate"[\s\S]*min="\$\{task\.dueDate \|\| ''\}"/)

const replanStart = eventSource.indexOf("container.querySelector('#cancelReplanBtn')")
const getNextSectionStart = (source, start, markers) => {
  const positions = markers.map(marker => source.indexOf(marker, start)).filter(position => position >= 0)
  return positions.length ? Math.min(...positions) : source.length
}
const replanEnd = getNextSectionStart(eventSource, replanStart, ['const splitTaskModal', 'const splitError'])
assert.ok(replanStart >= 0 && replanEnd > replanStart, 'shared replan handlers should be present')
const replanSource = eventSource.slice(replanStart, replanEnd)
assert.doesNotMatch(replanSource, /canChoosePastReplanDate|canReplanToDate|noTimeLimit|date\s*<\s*(today|formatDate)/)
assert.doesNotMatch(replanSource, /\b(?:category|taskType|isSpecial|source)\b/, 'past-date scheduling must not branch by task type or source')
assert.ok(replanSource.includes('replanConfirmButton.disabled = !isValidLocalDate(date)'))
assert.ok(replanSource.includes('getReplanDateError(date)'))
assert.ok(replanSource.includes("container.querySelector('#cancelReplanBtn')?.addEventListener('click', closeReplanModal)"))
assert.ok(eventSource.includes("container.querySelectorAll('.overdue-replan')"))
assert.ok(eventSource.includes("container.querySelectorAll('.week-plan-date')"))
assert.ok(eventSource.includes('replanTask(taskId, date)'), 'week-planning entry should keep using the shared date storage path')

const submitStart = eventSource.indexOf("container.querySelector('#replanForm')")
const submitEnd = getNextSectionStart(eventSource, submitStart, ['const splitTaskModal', 'const splitError'])
const submitSource = eventSource.slice(submitStart, submitEnd)
assert.ok(submitSource.includes('const taskBefore = getState().tasks.find'))
assert.ok(submitSource.includes('const saved = await persistState()'))
assert.ok(submitSource.includes('tasks: getState().tasks.map'))
assert.ok(submitSource.indexOf("'本地保存失败，请重试'") < submitSource.indexOf("'计划日期已更新'"))
assert.match(taskSource, /export const replanTask[\s\S]*?task\.dueDate = date[\s\S]*?task\.noTimeLimit = false/)
assert.match(taskSource, /saveData\(\{\s*tasks: state\.tasks/)
assert.match(taskSource, /return d < todayStr/)

const sharedEntryUses = bundleSource.match(/entryPoints: \[join\(rootDir, 'shared\/entry\.ts'\)\]/g) || []
assert.equal(sharedEntryUses.length, 2, 'Popup and new tab should use the same scheduling behavior')

console.log('Unified past-date scheduling tests passed')
