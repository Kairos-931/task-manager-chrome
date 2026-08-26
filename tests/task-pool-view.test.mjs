import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getTaskPoolTasks } from '../shared/planning.ts'

const [typesSource, taskSource, renderSource, eventSource] = await Promise.all([
  readFile(new URL('../shared/types.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/task.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
])

assert.match(typesSource, /'focus' \| 'pool' \| 'list' \| 'day' \| 'week' \| 'month'/)
assert.match(renderSource, /data-view="focus"[\s\S]*data-view="pool"[\s\S]*data-view="list"[\s\S]*data-view="day"[\s\S]*data-view="week"[\s\S]*data-view="month"/)
assert.match(renderSource, />全部任务<\/button>/)
assert.doesNotMatch(renderSource, /id="showNoTimeLimitOnly"/)
assert.match(renderSource, /getTaskPoolTasks\(getFilteredTasks\(\)\)/)
assert.match(renderSource, />安排到今天<\/button>/)
assert.match(renderSource, />选择日期<\/button>/)
assert.match(renderSource, /class="task-split[^"]*"[^>]*>拆分<\/button>/)
assert.match(renderSource, /case 'pool': return renderPoolView\(\)/)
assert.doesNotMatch(taskSource, /if \(state\.showNoTimeLimitOnly && !t\.noTimeLimit\)/)
assert.match(taskSource, /showNoTimeLimitOnly: false/)
assert.match(eventSource, /currentView: view, showNoTimeLimitOnly: false/)
assert.match(eventSource, /\.pool-focus/)

const baseTask = {
  description: '', priority: 'medium', category: 'work', duration: 60,
  repeatType: 'none', repeatDays: [], repeatInterval: 1, completed: false,
  completedDates: [], createdAt: 1, updatedAt: 1, noTimeLimit: false,
}
const poolTasks = getTaskPoolTasks([
    { ...baseTask, id: 'pool-task', title: '尚未排期', dueDate: '', noTimeLimit: true },
    { ...baseTask, id: 'planned-task', title: '已经排期', dueDate: '2026-08-20' },
    { ...baseTask, id: 'parent-task', title: '汇总父任务', dueDate: '', noTimeLimit: true, isParent: true },
])
assert.deepEqual(poolTasks.map(task => task.id), ['pool-task'], 'the task pool must include only unscheduled executable tasks')

console.log('Task pool top-level view tests passed')
