import type { Task, Priority } from './types'
import {
  getState, setState, resetEditingTask,
  formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate,
  getPriorityColor, getCatColor, getCatName, getFilteredTasks, getStats,
  toggleTask as toggleTaskAction, deleteTask as deleteTaskAction, moveTaskToDate,
  escapeHtml
} from './task'
import { getSyncStatus } from './sync'
import type { SyncStatus } from './sync'

// ==================== 同步状态指示器 ====================
const renderSyncIndicator = (): string => {
  const status = getSyncStatus()
  if (status === 'idle') return ''

  const icons: Record<SyncStatus, string> = {
    idle: '',
    saving: `<span id="syncIndicator" class="p-2 rounded-lg transition text-blue-500" title="正在同步...">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </span>`,
    synced: `<span id="syncIndicator" class="p-2 rounded-lg transition text-green-500" title="已同步">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
    </span>`,
    'remote-updated': `<span id="syncIndicator" class="p-2 rounded-lg transition text-blue-500" title="已收到远端更新">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
    </span>`,
    error: `<span id="syncIndicator" class="p-2 rounded-lg transition text-red-500" title="同步失败">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    </span>`
  }
  return icons[status]
}

// ==================== 渲染函数 ====================
export const renderStats = (): string => {
  const stats = getStats()
  return `
    <div class="flex gap-6 p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 mb-4 text-sm">
      <div><span class="text-gray-500">待完成：</span><span class="font-medium text-orange-500">${formatHours(stats.pending)}</span></div>
      <div><span class="text-gray-500">已完成：</span><span class="font-medium text-green-500">${formatHours(stats.done)}</span></div>
      <div><span class="text-gray-500">今日：</span><span class="font-medium">${stats.todayDone}/${stats.todayTotal}</span></div>
      ${stats.overdueCount > 0 ? `<div class="text-red-500">${stats.overdueCount}项已过期</div>` : ''}
    </div>
  `
}

export const renderHeader = (): string => {
  const { currentView, darkMode } = getState()
  const isNewTab = window.location.pathname.includes('newtab')
  return `
    <header class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold">任务管理</h1>
        <button id="openFullPage" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm" title="新标签页打开">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </button>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button data-view="list" class="px-3 py-1 rounded text-sm transition ${currentView === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}">列表</button>
          <button data-view="day" class="px-3 py-1 rounded text-sm transition ${currentView === 'day' ? 'bg-white dark:bg-gray-700 shadow' : ''}">日</button>
          <button data-view="week" class="px-3 py-1 rounded text-sm transition ${currentView === 'week' ? 'bg-white dark:bg-gray-700 shadow' : ''}">周</button>
          <button data-view="month" class="px-3 py-1 rounded text-sm transition ${currentView === 'month' ? 'bg-white dark:bg-gray-700 shadow' : ''}">月</button>
        </div>
        <button id="darkModeBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="切换深色模式">
          ${darkMode
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>'}
        </button>
        ${renderSyncIndicator()}
        ${isNewTab ? `
        <button id="exportBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="导出数据备份">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        </button>
        <label id="importBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer" title="导入数据恢复">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          <input type="file" id="importFileInput" accept=".json" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">
        </label>
        <button id="manageCategoryBtn" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm">分类</button>
        ` : ''}
        <button id="addTaskBtn" class="px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">+ 添加</button>
      </div>
    </header>
  `
}

export const renderFilters = (): string => {
  const { hideCompleted, hideOverdue, showNoTimeLimitOnly, filterPriority, filterCategory, categories = [] } = getState()
  return `
    <div class="flex flex-wrap gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 mb-4 items-center text-sm">
      <div class="flex items-center gap-1">
        <span class="text-gray-500">优先级</span>
        <select id="filterPriority" class="px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm">
          <option value="all" ${filterPriority === 'all' ? 'selected' : ''}>全部</option>
          <option value="high" ${filterPriority === 'high' ? 'selected' : ''}>高</option>
          <option value="medium" ${filterPriority === 'medium' ? 'selected' : ''}>中</option>
          <option value="low" ${filterPriority === 'low' ? 'selected' : ''}>低</option>
        </select>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-gray-500">分类</span>
        <select id="filterCategory" class="px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm">
          <option value="all" ${filterCategory === 'all' ? 'selected' : ''}>全部</option>
          ${categories.map(c => `<option value="${c.id}" ${filterCategory === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" id="hideCompleted" class="rounded" ${hideCompleted ? 'checked' : ''}> 
        <span>隐藏已完成</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" id="hideOverdue" class="rounded" ${hideOverdue ? 'checked' : ''}> 
        <span>隐藏今日之前</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" id="showNoTimeLimitOnly" class="rounded" ${showNoTimeLimitOnly ? 'checked' : ''}> 
        <span>任务池（无截止日期）</span>
      </label>
    </div>
  `
}

export const renderTaskItem = (task: Task): string => {
  const category = getState().categories.find(c => c.id === task.category)
  const overdue = !task.noTimeLimit && isOverdue(task.dueDate, task.completed)

  return `
    <div class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${task.completed ? 'opacity-60' : ''} ${task.noTimeLimit ? 'border-l-[3px] border-dashed border-gray-300 dark:border-gray-600 pl-3 -ml-3' : ''} ${overdue && !task.completed ? 'bg-red-50/50 dark:bg-red-900/10' : ''}" data-task-id="${task.id}" draggable="true">
      <div class="w-2 h-8 rounded ${getPriorityColor(task.priority)} flex-shrink-0"></div>
      <button class="task-toggle flex-shrink-0 w-5 h-5 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-500' : task.noTimeLimit ? 'border-dashed border-gray-400' : 'border-gray-300 dark:border-gray-500'} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}">
        ${task.completed ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium truncate ${task.completed ? 'line-through text-gray-400' : ''}">${escapeHtml(task.title)}</span>
          ${category ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0" style="background-color: ${category.color}20; color: ${category.color}">${escapeHtml(category.name)}</span>` : ''}
          ${task.noTimeLimit ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-500">无期限</span>` : ''}
        </div>
        <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
          ${task.duration > 0 ? `<span>${formatHours(task.duration)}</span>` : ''}
          ${!task.noTimeLimit ? `<span class="${overdue ? 'text-red-500 font-medium' : ''}">${getRemainingTime(task.dueDate, task.completed)}</span>` : ''}
          ${task.repeatType !== 'none' ? `<span class="text-blue-500">🔄</span>` : ''}
        </div>
        ${task.description ? `<p class="text-sm text-gray-500 mt-1 truncate dark:text-gray-400">${escapeHtml(task.description)}</p>` : ''}
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button class="task-edit p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" data-id="${task.id}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
        <button class="task-delete p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition text-red-500" data-id="${task.id}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `
}

export const renderListView = (): string => {
  const tasks = getFilteredTasks()
  if (tasks.length === 0) {
    return `<div class="text-center py-12 text-gray-400"><p class="text-lg">暂无任务</p><p class="text-sm mt-2">点击右上角"添加"开始</p></div>`
  }
  const groups = new Map<string, Task[]>()
  tasks.forEach(t => {
    const key = t.noTimeLimit ? 'no-date' : t.dueDate
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  })
  const dates = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'no-date') return 1
    if (b === 'no-date') return -1
    return a.localeCompare(b)
  })
  return dates.map(d => `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden mb-4">
      <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900 font-medium text-sm text-gray-600 dark:text-gray-400 drop-zone" data-date="${d}">
        ${d === 'no-date' ? '任务池（无截止日期）' : getDateLabel(d)}
      </div>
      ${(groups.get(d) || []).map(t => renderTaskItem(t)).join('')}
    </div>
  `).join('')
}

export const renderDayView = (): string => {
  const { currentDate } = getState()
  const tasks = getFilteredTasks().filter(t => !t.noTimeLimit && isTaskDueOnDate(t, currentDate))
  const todayStr = formatDate(new Date())
  const isToday = currentDate === todayStr
  return `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-4 pb-2 border-b dark:border-gray-700">
        <button id="prevDay" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex flex-col items-center">
          <span class="font-medium">${getDateLabel(currentDate)}</span>
          ${!isToday ? `<button id="goTodayDay" class="text-xs text-blue-500 hover:underline mt-1">回到今天</button>` : ''}
        </div>
        <button id="nextDay" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="${tasks.length === 0 ? 'py-8 text-center text-gray-400' : ''}">
        ${tasks.length === 0 ? '今日无任务' : tasks.map(t => renderTaskItem(t)).join('')}
      </div>
    </div>
  `
}

export const renderWeekView = (): string => {
  const { currentDate } = getState()
  const today = parseDate(currentDate)
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(formatDate(d))
  }
  const todayStr = formatDate(new Date())
  const todayMonday = new Date(todayStr)
  todayMonday.setDate(new Date(todayStr).getDate() - new Date(todayStr).getDay() + 1)
  const isCurrentWeek = formatDate(todayMonday) === formatDate(monday)

  return `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-4 pb-2 border-b dark:border-gray-700">
        <button id="prevWeek" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex flex-col items-center">
          <span class="font-medium">${days[0].slice(5)} ~ ${days[6].slice(5)}</span>
          ${!isCurrentWeek ? `<button id="goTodayWeek" class="text-xs text-blue-500 hover:underline mt-1">回到本周</button>` : ''}
        </div>
        <button id="nextWeek" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div>
        ${days.map(d => {
          const dayTasks = getFilteredTasks().filter(t => !t.noTimeLimit && isTaskDueOnDate(t, d))
          const isToday = d === todayStr
          const pendingMin = dayTasks.filter(t => !t.completed).reduce((s, t) => s + t.duration, 0)
          const completedMin = dayTasks.filter(t => t.completed).reduce((s, t) => s + t.duration, 0)
          return `
            <div class="flex border-b dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition drop-zone" data-date="${d}">
              <div class="w-24 flex-shrink-0 p-3 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}">
                <div class="text-sm font-medium ${isToday ? 'text-blue-500' : ''}">${getDateLabel(d)}</div>
                <div class="text-xs text-gray-400 mt-1">
                  ${pendingMin > 0 ? `<span class="text-orange-500">${formatHours(pendingMin)}</span>` : ''}
                  ${completedMin > 0 ? `<br><span class="text-green-500">${formatHours(completedMin)}</span>` : ''}
                </div>
              </div>
              <div class="flex-1 p-2 min-h-[80px] flex flex-wrap content-start gap-2">
                ${dayTasks.length === 0 ? '<span class="text-xs text-gray-300 dark:text-gray-600">无</span>' : dayTasks.map(t => renderWeekTaskCard(t)).join('')}
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

const renderWeekTaskCard = (task: Task): string => {
  const cat = getState().categories.find(c => c.id === task.category)
  return `
    <div class="week-task-item p-2 rounded border dark:border-gray-600 ${task.completed ? 'opacity-60' : 'bg-white dark:bg-gray-700 hover:shadow-md'} transition cursor-move flex-shrink-0" style="min-width:140px" draggable="true" data-task-id="${task.id}" title="双击编辑">
      <div class="flex items-start gap-2">
        <div class="w-1 h-full min-h-[32px] rounded ${getPriorityColor(task.priority)}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 mb-1">
            <span class="text-sm font-medium truncate ${task.completed ? 'line-through' : ''}">${escapeHtml(task.title)}</span>
            ${task.repeatType !== 'none' ? '<span class="text-blue-500">🔄</span>' : ''}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span>${formatHours(task.duration)}</span>
            ${cat ? `<span class="px-1 py-0.5 rounded text-white" style="background-color:${cat.color}">${escapeHtml(cat.name)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `
}

export const renderMonthView = (): string => {
  const { currentDate } = getState()
  const today = parseDate(currentDate)
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1))
  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const weeks: string[][] = []
  let currentWeek: string[] = []
  let current = new Date(startDate)
  for (let i = 0; i < 42; i++) {
    currentWeek.push(formatDate(current))
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = [] }
    current.setDate(current.getDate() + 1)
  }
  return `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-4 pb-2 border-b dark:border-gray-700">
        <button id="prevMonth" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="font-medium">${year}年${month + 1}月</span>
        <button id="nextMonth" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="grid grid-cols-7" style="border:1px solid #e5e7eb;border-bottom:none;border-right:none">
        ${weekdays.map(d => `<div class="text-center py-2 font-medium text-sm text-gray-500 border-b border-r dark:border-gray-700">${d}</div>`).join('')}
        ${weeks.map(week => week.map(d => {
          const dayDate = parseDate(d)
          const isCurrentMonth = dayDate.getMonth() === month
          const isToday = d === formatDate(new Date())
          const dayTasks = getFilteredTasks().filter(t => !t.noTimeLimit && isTaskDueOnDate(t, d))
          return `
            <div class="min-h-[100px] p-2 border-b border-r dark:border-gray-700 ${isCurrentMonth ? '' : 'bg-gray-50 dark:bg-gray-900/50'} ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''} hover:bg-gray-100 dark:hover:bg-gray-700/30 transition cursor-pointer drop-zone" data-date="${d}">
              <div class="text-sm mb-1 ${isCurrentMonth ? '' : 'text-gray-300 dark:text-gray-600'} ${isToday ? 'font-bold text-blue-500' : ''}">${dayDate.getDate()}</div>
              ${dayTasks.slice(0, 2).map(t => `<div class="month-task-item text-xs p-1 rounded mb-1 truncate ${t.completed ? 'line-through opacity-50 bg-gray-100' : 'bg-blue-100/50 dark:bg-blue-900/30'}" draggable="true" data-task-id="${t.id}" title="双击编辑">${escapeHtml(t.title)}</div>`).join('')}
              ${dayTasks.length > 2 ? `<div class="text-xs text-gray-400">+${dayTasks.length - 2}</div>` : ''}
            </div>
          `
        }).join('')).join('')}
      </div>
    </div>
  `
}

export const renderTaskList = (): string => {
  const { currentView } = getState()
  switch (currentView) {
    case 'list': return renderListView()
    case 'day': return renderDayView()
    case 'week': return renderWeekView()
    case 'month': return renderMonthView()
  }
}

export const renderModal = (): string => {
  const { editingTask, categories = [] } = getState()
  const isEditing = editingTask !== null
  const task = editingTask || {
    title: '',
    description: '',
    priority: 'medium' as Priority,
    category: categories[0]?.id || '',
    dueDate: formatDate(new Date()),
    duration: 60,
    repeatType: 'none' as const,
    repeatDays: [],
    repeatInterval: 1,
    noTimeLimit: false,
    completed: false
  }
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  return `
    <div id="taskModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 class="text-lg font-semibold">${isEditing ? '编辑任务' : '添加任务'}</h2>
          <button id="closeModal" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="taskForm" class="p-4 space-y-4">
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1">任务名称 *</label>
              <input type="text" name="title" value="${escapeHtml(task.title)}" required class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
            </div>
            ${isEditing ? `
              <div class="pt-6">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="taskCompleted" ${task.completed ? 'checked' : ''} class="rounded"> 
                  <span class="text-sm">已完成</span>
                </label>
              </div>
            ` : ''}
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">备注</label>
            <textarea name="description" rows="2" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white resize-none">${escapeHtml(task.description)}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">优先级</label>
              <select name="priority" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>高</option>
                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>中</option>
                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>低</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">分类</label>
              <select name="category" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
                ${categories.map(c => `<option value="${c.id}" ${task.category === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="border-t dark:border-gray-700 pt-4">
            <label class="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" id="noTimeLimit" name="noTimeLimit" ${task.noTimeLimit ? 'checked' : ''} class="rounded"> 
              <span class="text-sm font-medium">无时间限制（任务池）</span>
            </label>
            <div id="dueDateField" style="${task.noTimeLimit ? 'opacity:0.5;pointer-events:none' : ''}">
              <div>
                <label class="block text-sm font-medium mb-1">截止日期</label>
                <input type="date" name="dueDate" value="${task.dueDate}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
              </div>
            </div>
            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">预计时长 (小时)</label>
              <div class="flex items-center gap-2">
                <button type="button" id="durationDecrease" class="px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">-</button>
                <input type="number" name="duration" id="durationInput" value="${(task.duration / 60).toFixed(1)}" min="0.1" step="0.1" class="w-16 text-center px-2 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
                <button type="button" id="durationIncrease" class="px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">+</button>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">重复</label>
            <select name="repeatType" id="repeatType" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
              <option value="none" ${task.repeatType === 'none' ? 'selected' : ''}>不重复</option>
              <option value="daily" ${task.repeatType === 'daily' ? 'selected' : ''}>每天</option>
              <option value="weekly" ${task.repeatType === 'weekly' ? 'selected' : ''}>每周几</option>
              <option value="monthly" ${task.repeatType === 'monthly' ? 'selected' : ''}>每月</option>
              <option value="workdays" ${task.repeatType === 'workdays' ? 'selected' : ''}>工作日</option>
              <option value="custom" ${task.repeatType === 'custom' ? 'selected' : ''}>自定义间隔</option>
            </select>
          </div>
          <div id="weeklyDays" class="${task.repeatType !== 'weekly' ? 'hidden' : ''}">
            <label class="block text-sm font-medium mb-1">选择星期</label>
            <div class="flex gap-2">
              ${weekdays.map((d, i) => `
                <label class="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" name="repeatDays" value="${i}" ${(task.repeatDays as number[]).includes(i) ? 'checked' : ''} class="rounded"> 
                  <span class="text-sm">${d.slice(1)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div id="customInterval" class="${task.repeatType !== 'custom' ? 'hidden' : ''}">
            <label class="block text-sm font-medium mb-1">间隔天数</label>
            <input type="number" name="repeatInterval" value="${task.repeatInterval}" min="1" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div class="flex gap-3 pt-4">
            ${isEditing ? `<button type="button" id="deleteTaskBtn" class="px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">删除</button>` : ''}
            <div class="flex-1"></div>
            <button type="button" id="cancelBtn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">取消</button>
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">${isEditing ? '保存' : '添加'}</button>
          </div>
        </form>
      </div>
    </div>
  `
}

export const renderCategoryModal = (): string => {
  const { categories = [] } = getState()
  return `
    <div id="categoryModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-md">
        <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 class="text-lg font-semibold">管理分类</h2>
          <button id="closeCategoryModal" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-4 max-h-[400px] overflow-y-auto">
          <div id="categoryList">
            ${categories.map(cat => `
              <div class="category-item flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded mb-2" data-id="${cat.id}">
                <div class="flex items-center gap-2 flex-1">
                  <input type="color" value="${cat.color}" class="category-color w-8 h-8 rounded cursor-pointer border-0" data-id="${cat.id}">
                  <input type="text" value="${escapeHtml(cat.name)}" class="category-name flex-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm" data-id="${cat.id}">
                </div>
                <div class="flex gap-1">
                  <button class="save-category p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-green-500 transition" data-id="${cat.id}" title="保存">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  </button>
                  <button class="delete-category p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500 transition" data-id="${cat.id}" title="删除">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="flex gap-2 mt-4 pt-4 border-t dark:border-gray-700">
            <input type="text" id="newCategoryName" placeholder="新分类名称" class="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm">
            <input type="color" id="newCategoryColor" value="#3b82f6" class="w-10 h-10 rounded cursor-pointer">
            <button id="createCategoryBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm">添加</button>
          </div>
        </div>
      </div>
    </div>
  `
}

export const renderApp = (container: HTMLElement): void => {
  const { darkMode } = getState()
  if (darkMode) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  container.innerHTML = `
    <div class="max-w-4xl mx-auto p-4 min-h-screen">
      ${renderStats()}
      ${renderHeader()}
      ${renderFilters()}
      ${renderTaskList()}
      ${renderModal()}
      ${renderCategoryModal()}
    </div>
  `
}
