import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: "export { setState, getState } from './shared/task.ts'; export { renderHeader, renderFilters, renderFocusView, renderPoolView, renderTaskItem, renderStats } from './shared/render.ts';",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'popup-focus-independent-filters-entry.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})

globalThis.document = {
  createElement() {
    let text = ''
    return {
      set textContent(value) { text = String(value) },
      get innerHTML() { return text }
    }
  }
}
globalThis.window = { location: { pathname: '/popup/popup.html' } }

const { setState, getState, renderHeader, renderFilters, renderFocusView, renderPoolView, renderTaskItem, renderStats } = await import(`data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`)

const localDate = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const task = (overrides = {}) => ({
  id: `task-${Math.random().toString(16).slice(2)}`,
  title: '任务', description: '', priority: 'medium', category: 'work',
  dueDate: localDate(), duration: 60, repeatType: 'none', repeatDays: [], repeatInterval: 1,
  completed: false, completedDates: [], createdAt: 1, updatedAt: 1, noTimeLimit: false,
  ...overrides
})

const todayPending = task({ id: 'today-pending', title: '今日未完成低优先级任务', priority: 'low', category: 'personal' })
const todayDone = task({ id: 'today-done', title: '今日已完成任务', priority: 'low', category: 'personal', completed: true, completedAt: 2 })
const todayHigh = task({ id: 'today-high', title: '今日高优先级任务', priority: 'high', category: 'work' })
const overdue = task({ id: 'overdue', title: '昨天未完成任务', dueDate: localDate(-1), priority: 'low', category: 'personal' })
const pool = task({ id: 'pool', title: '任务池任务', dueDate: '', noTimeLimit: true, priority: 'low', category: 'personal' })

setState({
  tasks: [todayPending, todayDone, todayHigh, overdue, pool],
  categories: [{ id: 'work', name: '工作', color: '#2563eb' }, { id: 'personal', name: '个人', color: '#16a34a' }],
  hideCompleted: true,
  hideOverdue: true,
  filterPriority: 'high',
  filterCategory: 'work',
  currentView: 'focus',
  overdueCollapsed: true
})

const popupStateBefore = { ...getState() }
const popupFocus = renderFocusView()
assert.match(popupFocus, /今日未完成低优先级任务/, 'Popup 今日聚焦不应套用管理页优先级/分类筛选')
assert.match(popupFocus, /今日已完成任务/, 'Popup 今日聚焦必须显示今日已完成任务')
assert.match(popupFocus, /今日高优先级任务/)
assert.doesNotMatch(popupFocus, /昨天未完成任务/, '今日之前默认折叠时不应展开任务内容')
assert.match(popupFocus, /昨天及更早未完成[\s\S]*1 项/, '今日之前区域仍应保留原有折叠摘要')
assert.deepEqual({
  hideCompleted: getState().hideCompleted,
  hideOverdue: getState().hideOverdue,
  filterPriority: getState().filterPriority,
  filterCategory: getState().filterCategory
}, {
  hideCompleted: popupStateBefore.hideCompleted,
  hideOverdue: popupStateBefore.hideOverdue,
  filterPriority: popupStateBefore.filterPriority,
  filterCategory: popupStateBefore.filterCategory
}, 'Popup 渲染不得覆盖管理页筛选状态')

const popupStats = renderStats()
assert.match(popupStats, /今日[\s\S]*1\/3/, 'Popup 摘要应按今日全部任务统计，而不是隐藏已完成后的结果')

const popupFilters = renderFilters()
assert.match(popupFilters, /popup-focus-rules/)
assert.doesNotMatch(popupFilters, /filterPriority|filterCategory|hideCompleted|hideOverdue|<select|type="checkbox"/, 'Popup 不应展示可修改管理筛选的控件')
assert.doesNotMatch(renderHeader(), /data-view="day"|data-view="week"|data-view="month"/)

const popupTask = renderTaskItem(todayPending, { popupFocus: true })
assert.match(popupTask, /popup-focus-replan/)
assert.match(popupTask, /class="popup-focus-action task-edit"/)
assert.match(popupTask, /task-more-menu/)
assert.match(popupTask, /删除任务/)
assert.doesNotMatch(popupTask, /task-focus-toggle|task-split|加入今天|安排到今天|拆分任务/)
assert.match(popupTask, /truncate/)

const popupPool = renderPoolView()
assert.match(popupPool, /任务池任务/, 'Popup 任务池不应被管理页筛选意外隐藏')

setState({ overdueCollapsed: false })
const expandedPopupFocus = renderFocusView()
assert.match(expandedPopupFocus, /昨天未完成任务/)
assert.match(expandedPopupFocus, /加入今天/)
assert.match(expandedPopupFocus, /拆分任务/)
assert.match(expandedPopupFocus, /放回任务池/)

globalThis.window.location.pathname = '/newtab/newtab.html'
setState({ overdueCollapsed: true })
const newtabFocus = renderFocusView()
assert.match(newtabFocus, /今日高优先级任务/)
assert.doesNotMatch(newtabFocus, /今日未完成低优先级任务|今日已完成任务|任务池任务/)
assert.match(newtabFocus, /task-split/, '新标签页今日任务仍保留原有拆分入口')
assert.match(renderFilters(), /filterPriority[\s\S]*filterCategory[\s\S]*hideCompleted[\s\S]*hideOverdue/)

console.log('Popup focus independent filter/action tests passed')
