import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getWeekDates } from '../shared/calendar.ts'
import { getHistoricalOverdueTasks } from '../shared/planning.ts'

assert.deepEqual(
  getWeekDates('2026-08-20'),
  ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'],
  'a weekday must resolve to its Monday-through-Sunday natural week'
)

assert.deepEqual(
  getWeekDates('2026-08-23'),
  ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'],
  'Sunday must remain in the week that is ending instead of jumping to next Monday'
)

assert.deepEqual(
  getWeekDates('2027-01-01'),
  ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'],
  'week calculation must cross year boundaries'
)

const renderSource = await readFile(new URL('../shared/render.ts', import.meta.url), 'utf8')
const eventSource = await readFile(new URL('../shared/events.ts', import.meta.url), 'utf8')

assert.match(renderSource, /本周开始前未完成/)
assert.match(renderSource, /安排到本周/)
assert.match(renderSource, /本周内逾期/)
assert.match(renderSource, /historicalOverdue/)
assert.match(renderSource, /week-day-picker/)
assert.match(renderSource, /week-plan-toggle[\s\S]*overdue-complete[\s\S]*标记完成/)
assert.match(renderSource, /class="overdue-item week-overdue-item"/)
assert.match(renderSource, /class="overdue-panel overdue-panel-embedded/)
assert.match(eventSource, /week-plan-toggle/)
assert.match(eventSource, /week-plan-date/)
assert.match(eventSource, /toggleTaskOnDate/)
assert.match(eventSource, /querySelectorAll\('\.overdue-complete'\)[\s\S]*toggleTaskAction\(id\)/)

const baseTask = {
  description: '', priority: 'medium', category: 'work', duration: 60,
  repeatType: 'none', repeatDays: [], repeatInterval: 1, completed: false,
  completedDates: [], createdAt: 1, updatedAt: 1, noTimeLimit: false,
}
const historicalOverdue = getHistoricalOverdueTasks(
  [
    { ...baseTask, id: 'week-task', title: '本周自动识别', dueDate: '2026-08-20' },
    { ...baseTask, id: 'old-task', title: '历史逾期任务', dueDate: '2026-08-12' },
    { ...baseTask, id: 'done-old-task', title: '已完成历史任务', dueDate: '2026-08-11', completed: true },
    { ...baseTask, id: 'parent-task', title: '父任务', dueDate: '', noTimeLimit: true, isParent: true },
  ],
  '2026-08-17',
  { hideOverdue: false, showNoTimeLimitOnly: false, priority: 'all', category: 'all' }
)
assert.deepEqual(historicalOverdue.map(task => task.id), ['old-task'], 'only executable incomplete tasks before the selected week belong in historical overdue')

console.log('Week focus interaction tests passed')
