import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getTaskProgress } from '../shared/planning.ts'
import { isTaskDueOnDate, summarizeTaskDurationsForDates } from '../shared/calendar.ts'

const task = (overrides = {}) => ({
  id: 'task',
  title: 'Task',
  description: '',
  priority: 'medium',
  category: '',
  dueDate: '2026-08-20',
  duration: 60,
  repeatType: 'none',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: [],
  createdAt: 0,
  updatedAt: 0,
  noTimeLimit: false,
  ...overrides,
})

const parent = task({ id: 'parent', isParent: true, duration: 0, dueDate: '', noTimeLimit: true })
const firstChild = task({ id: 'child-1', parentId: 'parent', focusDate: '2026-08-20', duration: 30, completed: true })
const secondChild = task({ id: 'child-2', parentId: 'parent', dueDate: '2026-08-19', focusDate: '2026-08-19', duration: 90 })

assert.equal(isTaskDueOnDate(firstChild, '2026-08-20'), true, 'today planned task must enter daily focus')
assert.equal(isTaskDueOnDate(secondChild, '2026-08-20'), false, 'yesterday task must remain overdue instead of entering today')
assert.equal(isTaskDueOnDate(parent, '2026-08-20'), false, 'parents cannot enter daily focus')

assert.deepEqual(getTaskProgress(parent, [parent, firstChild, secondChild]), {
  completed: 1,
  total: 2,
  percent: 50,
})

assert.equal(isTaskDueOnDate(parent, '2026-08-20'), false, 'parent tasks must not appear on calendars')
assert.deepEqual(
  summarizeTaskDurationsForDates([parent, firstChild, secondChild], ['2026-08-20']),
  { pending: 0, done: 30 },
  'parent duration must not be counted twice'
)

const [renderSource, eventSource, prdSource] = await Promise.all([
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
  readFile(new URL('../docs/PRD.md', import.meta.url), 'utf8'),
])
assert.match(renderSource, /visibleFocused = getFilteredTasks\(\)\.filter\(task => !task\.isParent && isTaskDueOnDate\(task, today\)\)/)
assert.doesNotMatch(renderSource, /今天真正要完成什么？/, 'removed focus summary card must not return')
assert.match(renderSource, /toggleOverdueSection/)
assert.match(renderSource, /overdueCollapsed/)
assert.match(renderSource, /overdue-complete[^"]*"[^>]*>标记完成<\/button>/)
assert.match(eventSource, /querySelectorAll\('\.overdue-complete'\)[\s\S]*toggleTaskAction\(id\)[\s\S]*persistState\(\)[\s\S]*任务已完成/)
assert.match(prdSource, /逾期任务必须提供五个直接动作/)
assert.match(renderSource, /class="overdue-panel/)
assert.match(renderSource, /class="overdue-panel-header/)
assert.match(renderSource, /class="overdue-item-actions"/)
assert.match(renderSource, /class="focus-view"/)
assert.match(renderSource, /class="focus-panel-header"/)
assert.match(renderSource, /class="focus-panel-count"/)
assert.match(renderSource, /class="focus-panel-empty"/)
assert.match(renderSource, /\.focus-panel-header \{[\s\S]*min-height: 72px;[\s\S]*padding: 16px 20px;/)
assert.match(renderSource, /\.overdue-item \{[\s\S]*grid-template-columns: 4px minmax\(0, 1fr\);/)
assert.match(renderSource, /\.overdue-item-actions \{[\s\S]*gap: 8px;/)
assert.match(renderSource, /\.overdue-item-action \{[\s\S]*min-height: 34px;/)
assert.match(prdSource, /每项任务必须形成独立、可扫描的处理卡片/)

console.log('Daily focus and parent task tests passed')
