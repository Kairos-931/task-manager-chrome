import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

globalThis.document = {
  createElement: () => ({
    textContent: '',
    get innerHTML() { return this.textContent }
  })
}
globalThis.window = { location: { pathname: '/newtab/newtab.html' } }

const bundle = await build({
  stdin: {
    contents: `
      export { setState, getState, toggleTaskOnDate } from './shared/task.ts'
      export { renderDayView } from './shared/render.ts'
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'day-view-recurring-occurrence-entry.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { setState, getState, toggleTaskOnDate, renderDayView } =
  await import(`data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`)

const recurring = {
  id: 'day-recurring',
  title: '按日重复任务',
  description: '',
  priority: 'medium',
  category: '',
  dueDate: '2026-09-11',
  repeatStartDate: '2026-09-10',
  repeatEndDate: '2026-09-12',
  duration: 60,
  repeatType: 'daily',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: ['2026-09-10'],
  createdAt: 1,
  updatedAt: 1,
  noTimeLimit: false
}

setState({
  tasks: [recurring],
  currentDate: '2026-09-10',
  hideCompleted: false,
  hideOverdue: false,
  filterPriority: 'all',
  filterCategory: 'all'
})
const completedDayHtml = renderDayView()
assert.match(completedDayHtml, /data-task-date="2026-09-10"/)
assert.match(completedDayHtml, /class="[^"]*opacity-60[^"]*" data-task-id="day-recurring"/)
assert.match(completedDayHtml, /class="[^"]*line-through[^"]*">按日重复任务<\/span>/)
assert.match(completedDayHtml, /data-task-date="2026-09-10"[\s\S]*<svg/)

setState({ hideCompleted: true })
assert.doesNotMatch(renderDayView(), /按日重复任务/, 'day view hide-completed must use the viewed occurrence')

setState({ currentDate: '2026-09-11', hideCompleted: true })
assert.match(renderDayView(), /按日重复任务/, 'the next pending occurrence must remain visible')
assert.match(renderDayView(), /data-task-date="2026-09-11"/)
assert.doesNotMatch(renderDayView(), /class="[^"]*line-through[^"]*">按日重复任务<\/span>/)

toggleTaskOnDate('day-recurring', '2026-09-11')
assert.equal(getState().tasks[0].dueDate, '2026-09-12')
setState({ hideCompleted: false })
assert.match(renderDayView(), /data-task-date="2026-09-11"[\s\S]*line-through/, 'completed E must render as completed in E after dueDate advances')

setState({ currentDate: '2026-09-10' })
assert.match(renderDayView(), /data-task-date="2026-09-10"[\s\S]*line-through/, 'completed D must remain completed after a later occurrence is completed')
toggleTaskOnDate('day-recurring', '2026-09-10')
assert.deepEqual(getState().tasks[0].completedDates, ['2026-09-11'])
assert.match(renderDayView(), /data-task-date="2026-09-10"/)
assert.doesNotMatch(renderDayView(), /data-task-date="2026-09-10"[\s\S]*line-through/, 'restoring D must not leave D checked')

setState({ currentDate: '2026-09-11' })
assert.match(renderDayView(), /data-task-date="2026-09-11"[\s\S]*line-through/, 'restoring D must not clear the later completed occurrence')

const source = await readFile(new URL('../shared/render.ts', import.meta.url), 'utf8')
assert.match(source, /getPageTasks\(\{ ignoreCompleted: true \}\)[\s\S]*isTaskCompletedOnDate\(t, currentDate\)/)
assert.match(source, /renderTaskItem\(t, \{ occurrenceDate: currentDate \}\)/)

console.log('Day view recurring occurrence tests passed')
