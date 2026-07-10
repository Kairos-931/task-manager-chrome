import type { Task, Priority } from './types'
import {
  getState, setState, resetEditingTask,
  formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate,
  getPriorityColor, getCatColor, getCatName, getFilteredTasks, getStats, getWeeklyGoalStats,
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
export const renderWeeklyGoalCard = (): string => {
  const stats = getWeeklyGoalStats()
  if (!stats) return ''

  const formatWeeks = (w: number) => {
    if (w < 1) return '<1 周'
    return `${Math.floor(w)} 周` + (w % 1 >= 0.5 ? '半' : '')
  }
  const formatH = (m: number) => (m / 60).toFixed(1) + 'h'

  const gapClass = stats.behindExpected ? 'gap-negative' : 'gap-positive'
  const gapSign = stats.behindExpected ? '' : '+'
  const expectedPos = Math.min(100, stats.progressPercent)

  return `
    <div class="goal-card" id="weeklyGoalCard" style="display:none;">
      <div class="goal-card-header">
        <div class="goal-card-label">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>每周节奏</span>
        </div>
        <span class="goal-card-target">目标 ${formatH(stats.weeklyGoalMinutes)} / 周</span>
      </div>
      <div class="goal-card-anchor"><strong>锚点：</strong>${stats.anchorDate} 第 1 周</div>
      <div class="goal-card-row">
        <div class="goal-card-stat">
          <div class="stat-label">期望工时</div>
          <div class="stat-value">${formatH(stats.expectedMinutes)}<span class="unit">h</span></div>
          <div class="stat-sub stat-neutral">历时 ${formatWeeks(stats.weeksElapsed)}</div>
        </div>
        <div class="goal-card-stat">
          <div class="stat-label">实际完成</div>
          <div class="stat-value">${formatH(stats.actualMinutes)}<span class="unit">h</span></div>
          <div class="stat-sub stat-green">${stats.completedCount} 个任务</div>
        </div>
        <div class="goal-card-stat">
          <div class="stat-label">差距</div>
          <div class="stat-value ${gapClass}">${gapSign}${formatH(Math.abs(stats.gapMinutes))}<span class="unit">h</span></div>
          <div class="stat-sub ${gapClass}">${stats.behindExpected ? `落后约 ${stats.gapWeeks} 周` : `领先约 ${stats.gapWeeks} 周`}</div>
        </div>
      </div>
      <div class="goal-card-bar-wrap">
        <div class="goal-bar-labels">
          <span>完成进度</span>
          <span class="pace">实际节奏 ${formatH(stats.paceMinutesPerWeek)}/周 · 目标 ${formatH(stats.weeklyGoalMinutes)}/周</span>
        </div>
        <div class="goal-bar-bg">
          <div class="goal-bar-fill" style="width:${Math.min(100, stats.progressPercent)}%;"></div>
          <div class="goal-bar-line" style="left:${expectedPos}%;"></div>
        </div>
        <div class="goal-bar-label">
          <span>当前 ${formatH(stats.actualMinutes)}</span>
          <span>期望 ${formatH(stats.expectedMinutes)}</span>
          <span>${stats.progressPercent}%</span>
        </div>
      </div>
      <div class="goal-card-detail">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="label">周目标</div>
            <div class="value">${formatH(stats.weeklyGoalMinutes)}</div>
            <div class="desc">每 7 天期望完成量</div>
          </div>
          <div class="detail-item">
            <div class="label">实际节奏</div>
            <div class="value">${formatH(stats.paceMinutesPerWeek)} / 周</div>
            <div class="desc">总工时 ÷ 总周数</div>
          </div>
          <div class="detail-item">
            <div class="label">完成总工时</div>
            <div class="value">${formatH(stats.actualMinutes)}</div>
            <div class="desc">${stats.completedCount} 个已完成任务合计</div>
          </div>
          <div class="detail-item">
            <div class="label">任务平均时长</div>
            <div class="value">${formatH(stats.completedCount > 0 ? stats.actualMinutes / stats.completedCount : 0)}</div>
            <div class="desc">总工时 ÷ 任务数</div>
          </div>
        </div>
        <button id="adjustGoalAnchorBtn" class="goal-adjust-btn">调整起始锚点</button>
      </div>
    </div>
  `
}

export const renderGoalSettingsModal = (): string => {
  const { weeklyGoalMinutes = 600, weeklyGoalAnchor } = getState()
  const anchorDate = weeklyGoalAnchor || formatDate(new Date())
  return `
    <div id="goalSettingsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-sm p-6">
        <h3 class="text-lg font-semibold mb-4">每周目标设置</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">每周目标时长（小时）</label>
            <input type="number" id="goalWeeklyHours" value="${(weeklyGoalMinutes / 60).toFixed(1)}" min="0.5" step="0.5" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">起始锚点日期</label>
            <input type="date" id="goalAnchorDate" value="${anchorDate}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <p class="text-xs text-gray-400">锚点用于计算已过周数。修改后重新计算期望值。</p>
        </div>
        <div class="flex gap-3 mt-6">
          <button id="closeGoalSettingsBtn" class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">取消</button>
          <button id="saveGoalSettingsBtn" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm">保存</button>
        </div>
      </div>
    </div>
  `
}

export const renderStats = (): string => {
  const stats = getStats()
  return `
    <div id="statsRow" class="stats-row">
      <div class="stats-row-bar">
        <div class="stats-row-items">
          <span class="text-gray-500">待完成：</span><span class="font-medium text-orange-500">${formatHours(stats.pending)}</span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="text-gray-500">已完成：</span><span class="font-medium text-green-500">${formatHours(stats.done)}</span>
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="text-gray-500">今日：</span><span class="font-medium">${stats.todayDone}/${stats.todayTotal}</span>
          ${stats.overdueCount > 0 ? `<span class="text-red-500 font-medium">${stats.overdueCount}项过期</span>` : ''}
        </div>
        <button id="statsToggleBtn" class="stats-toggle-btn" title="每周节奏">
          <span id="statsChevron" class="stats-chevron">&#x25BE;</span>
        </button>
      </div>
      <div id="weeklyGoalWrapper" style="display:none;">
        ${renderWeeklyGoalCard()}
      </div>
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
        <button id="syncDataBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="数据同步">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
        <button id="manageCategoryBtn" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm">分类</button>
        <button id="mobileSyncSettingsBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="手机同步设置">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        </button>
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
          const dayTasks = getState().tasks.filter(t => !t.noTimeLimit && isTaskDueOnDate(t, d))
          const isToday = d === todayStr
          const pendingMin = dayTasks.filter(t => !t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)
          const completedMin = dayTasks.filter(t => t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)
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
                ${dayTasks.length === 0 ? '<span class="text-xs text-gray-300 dark:text-gray-600">无</span>' : dayTasks.map(t => renderWeekTaskCard(t, d)).join('')}
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

const renderWeekTaskCard = (task: Task, date?: string): string => {
  const cat = getState().categories.find(c => c.id === task.category)
  const isRecurringDone = task.repeatType && task.repeatType !== 'none' && date && (task.completedDates || []).includes(date)
  const done = task.completed || isRecurringDone
  return `
    <div class="week-task-item p-2 rounded border dark:border-gray-600 ${done ? 'opacity-50 bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-700 hover:shadow-md'} transition cursor-move flex-shrink-0" style="min-width:140px" draggable="true" data-task-id="${task.id}" title="双击编辑">
      <div class="flex items-start gap-2">
        <div class="w-1 h-full min-h-[32px] rounded ${getPriorityColor(task.priority)}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 mb-1">
            <span class="text-sm font-medium truncate ${done ? 'line-through' : ''}">${escapeHtml(task.title)}</span>
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
  const todayStr = formatDate(new Date())

  // 每周统计
  const weekSummaries = weeks.map(week => {
    const weekDays = week.filter(d => { const dd = parseDate(d); return dd.getMonth() === month })
    const weekPending = weekDays.reduce((s, d) => {
      return s + getState().tasks.filter(t => !t.noTimeLimit && !t.completed && isTaskDueOnDate(t, d)).reduce((a, t) => a + t.duration, 0)
    }, 0)
    const weekDone = weekDays.reduce((s, d) => {
      return s + getState().tasks.filter(t => !t.noTimeLimit && t.completed && t.repeatType === 'none' && isTaskDueOnDate(t, d)).reduce((a, t) => a + t.duration, 0)
    }, 0)
    return { pending: weekPending, done: weekDone }
  })

  // 月汇总
  const monthTasks = getState().tasks.filter(t => !t.noTimeLimit)
  const monthPending = monthTasks.filter(t => !t.completed).reduce((s, t) => s + t.duration, 0)
  const monthDone = monthTasks.filter(t => t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)

  const renderWeekSummary = (week: string[], ws: { pending: number; done: number }): string => {
    const hasToday = week.some(dd => dd === todayStr)
    const bgClass = hasToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
    const pendingHtml = ws.pending > 0
      ? `<div class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span><span class="text-[11px] font-semibold text-orange-600 dark:text-orange-400">${formatHours(ws.pending)}</span></div>` : ''
    const doneHtml = ws.done > 0
      ? `<div class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span><span class="text-[11px] font-semibold text-green-600 dark:text-green-400">${formatHours(ws.done)}</span></div>` : ''
    const totalHtml = (ws.pending > 0 || ws.done > 0)
      ? `<div class="text-[10px] text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-0.5 mt-0.5">合计 <span class="font-semibold text-gray-500 dark:text-gray-300">${formatHours(ws.pending + ws.done)}</span></div>`
      : `<span class="text-[10px] text-gray-300 dark:text-gray-600">—</span>`
    return `<div class="flex flex-col items-center justify-center gap-1 py-2 px-1 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 ${bgClass}">${pendingHtml}${doneHtml}${totalHtml}</div>`
  }

  const gridCells = weeks.map((week, wi) => {
    const ws = weekSummaries[wi]
    const dayCells = week.map(d => {
      const dayDate = parseDate(d)
      const isCurrentMonth = dayDate.getMonth() === month
      const isToday = d === todayStr
      const dayTasks = getState().tasks.filter(t => !t.noTimeLimit && isTaskDueOnDate(t, d))
      const pendingMin = dayTasks.filter(t => !t.completed).reduce((s, t) => s + t.duration, 0)
      const completedMin = dayTasks.filter(t => t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)
      const miniPending = pendingMin > 0 ? `<span class="text-[9px] text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1 rounded leading-tight font-medium">${formatHours(pendingMin)}</span>` : ''
      const miniDone = completedMin > 0 ? `<span class="text-[9px] text-green-500 bg-green-50 dark:bg-green-900/20 px-1 rounded leading-tight font-medium">✓${formatHours(completedMin)}</span>` : ''
      const taskCards = dayTasks.slice(0, 2).map(t => {
        const isRecurringDone = t.repeatType && t.repeatType !== 'none' && (t.completedDates || []).includes(d)
        const done = t.completed || isRecurringDone
        return `<div class="month-task-item text-xs p-1 rounded mb-1 truncate ${done ? 'line-through opacity-40 bg-gray-100 dark:bg-gray-700' : 'bg-blue-100/50 dark:bg-blue-900/30'}" draggable="true" data-task-id="${t.id}" title="双击编辑">${escapeHtml(t.title)}</div>`
      }).join('')
      const moreHtml = dayTasks.length > 2 ? `<div class="text-xs text-gray-400">+${dayTasks.length - 2}</div>` : ''
      const cellClasses = `min-h-[100px] p-2 border-b border-r dark:border-gray-700 ${isCurrentMonth ? '' : 'bg-gray-50 dark:bg-gray-900/50'} ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''} hover:bg-gray-100 dark:hover:bg-gray-700/30 transition cursor-pointer drop-zone`
      const dayNumClass = `text-sm ${isCurrentMonth ? '' : 'text-gray-300 dark:text-gray-600'} ${isToday ? 'font-bold text-blue-500' : ''}`
      return `<div class="${cellClasses}" data-date="${d}"><div class="flex items-center gap-1 mb-1"><span class="${dayNumClass}">${dayDate.getDate()}</span>${miniPending}${miniDone}</div>${taskCards}${moreHtml}</div>`
    }).join('')
    return dayCells + renderWeekSummary(week, ws)
  }).join('')

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
      <div class="grid" style="grid-template-columns:repeat(7,1fr) 72px;border:1px solid #e5e7eb;border-bottom:none;border-right:none">
        ${weekdays.map(d => `<div class="text-center py-2 font-medium text-sm text-gray-500 border-b border-r dark:border-gray-700">${d}</div>`).join('')}
        <div class="text-center py-2 text-[11px] font-medium text-gray-400 border-b border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30" style="letter-spacing:0.5px">周统计</div>
        ${gridCells}
      </div>
      <div class="grid" style="grid-template-columns:repeat(7,1fr) 72px;border:1px solid #e5e7eb">
        <div class="col-span-7 px-3 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/30 border-r dark:border-gray-700 flex items-center gap-4">
          本月合计：<span class="font-semibold text-orange-600 dark:text-orange-400">${formatHours(monthPending)} 待办</span><span class="text-gray-300 dark:text-gray-600">|</span><span class="font-semibold text-green-600 dark:text-green-400">${formatHours(monthDone)} 已完成</span><span class="text-gray-300 dark:text-gray-600">|</span><span class="font-semibold text-gray-600 dark:text-gray-300">${formatHours(monthPending + monthDone)} 总计</span>
        </div>
        <div class="flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/30">${formatHours(monthPending + monthDone)}</div>
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

// ==================== 未来 7 天快捷日期选择 ====================
const renderQuickDates = (selectedDate: string): string => {
  const today = new Date()
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const todayStr = formatDate(today)

  let html = '<div class="quick-dates-row">'
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dateStr = formatDate(d)
    const dayNum = d.getDate()
    const isToday = dateStr === todayStr
    const isSelected = dateStr === selectedDate

    const label = isToday ? '今天' : i === 1 ? '明天' : dayNames[d.getDay()]

    const classes = [
      'quick-date-btn',
      isToday ? 'today' : '',
      isSelected ? 'selected' : ''
    ].filter(Boolean).join(' ')

    html += `<button type="button" class="${classes}" data-date="${dateStr}">
      <span class="quick-day-name">${label}</span>
      <span class="quick-day-num">${dayNum}</span>
      ${isToday ? '<span class="quick-date-badge">今天</span>' : ''}
    </button>`
  }
  html += '</div>'
  return html
}

export const renderModal = (): string => {
  const { editingTask, categories = [], defaultCategory } = getState()
  const isEditing = editingTask !== null
  const task = editingTask || {
    title: '',
    description: '',
    priority: 'medium' as Priority,
    category: defaultCategory || categories[0]?.id || '',
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
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-lg overflow-y-auto" style="max-height:90vh;max-height:90svh;">
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
                ${renderQuickDates(task.dueDate)}
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
  const { categories = [], defaultCategory } = getState()
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
                  ${defaultCategory === cat.id ? '<span class="text-xs text-blue-500 font-medium">默认</span>' : ''}
                </div>
                <div class="flex gap-1">
                  <button class="set-default-category p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded text-blue-500 transition ${defaultCategory === cat.id ? 'opacity-30' : ''}" data-id="${cat.id}" title="设为默认分类">
                    <svg class="w-4 h-4" fill="${defaultCategory === cat.id ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                  </button>
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

export const renderSyncModal = (): string => {
  const { tasks, categories } = getState()
  return `
    <style>
      #syncModal .sync-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px 12px;
        border-radius: 12px;
        border: 1.5px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      #syncModal .sync-card::before {
        content: '';
        position: absolute;
        top: -30px;
        right: -30px;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        opacity: 0.08;
        transition: all 0.2s ease;
      }
      #syncModal .sync-card:hover::before { opacity: 0.15; }
      #syncModal .sync-card:active { transform: scale(0.97); }
      #syncModal .card-upload {
        background: #eff6ff;
        border-color: #bfdbfe;
      }
      #syncModal .card-upload::before { background: #3b82f6; }
      #syncModal .card-upload:hover { border-color: #93c5fd; box-shadow: 0 4px 12px rgba(59,130,246,0.15); }
      #syncModal .card-download {
        background: #ecfdf5;
        border-color: #a7f3d0;
      }
      #syncModal .card-download::before { background: #10b981; }
      #syncModal .card-download:hover { border-color: #6ee7b7; box-shadow: 0 4px 12px rgba(16,185,129,0.15); }
      .dark #syncModal .card-upload { background: rgba(30,58,138,0.2); border-color: rgba(96,165,250,0.2); }
      .dark #syncModal .card-upload:hover { border-color: rgba(96,165,250,0.4); box-shadow: 0 4px 12px rgba(59,130,246,0.1); }
      .dark #syncModal .card-download { background: rgba(6,78,59,0.2); border-color: rgba(52,211,153,0.2); }
      .dark #syncModal .card-download:hover { border-color: rgba(52,211,153,0.4); box-shadow: 0 4px 12px rgba(16,185,129,0.1); }
      #syncModal .icon-circle {
        width: 44px; height: 44px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 10px;
        transition: transform 0.2s ease;
      }
      #syncModal .sync-card:hover .icon-circle { transform: translateY(-2px); }
      #syncModal .icon-upload { background: #3b82f6; }
      #syncModal .icon-download { background: #10b981; }
      #syncModal .card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
      #syncModal .card-upload .card-title { color: #1d4ed8; }
      #syncModal .card-download .card-title { color: #059669; }
      .dark #syncModal .card-upload .card-title { color: #93c5fd; }
      .dark #syncModal .card-download .card-title { color: #6ee7b7; }
      #syncModal .card-hint { font-size: 11px; color: #9ca3af; }
      #syncModal .file-btn {
        flex: 1;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        padding: 8px 12px;
        font-size: 12px;
        color: #6b7280;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none; background: none;
      }
      #syncModal .file-btn:hover { background: #f3f4f6; color: #374151; }
      .dark #syncModal .file-btn { color: #9ca3af; }
      .dark #syncModal .file-btn:hover { background: rgba(55,65,81,0.5); color: #d1d5db; }
      #syncModal .close-btn { padding:6px;border-radius:8px;border:none;background:none;cursor:pointer;color:#9ca3af;transition:all 0.15s; }
      #syncModal .close-btn:hover { background:#f3f4f6; color:#4b5563; }
      .dark #syncModal .close-btn:hover { background:rgba(55,65,81,0.5); color:#d1d5db; }
    </style>
    <div id="syncModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-md overflow-hidden" style="border-radius:16px;">
        <div style="padding:20px 24px 16px;">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold" style="color:#111827;">数据同步</h2>
            <button id="closeSyncModal" class="close-btn">
              <svg style="width:18px;height:18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin-top:4px;">${tasks.length} 个任务 · ${categories.length} 个分类 · 云端同步</p>
        </div>
        <div id="syncFeedback" style="margin:0 24px 0;padding:8px 12px;border-radius:8px;font-size:12px;display:none;"></div>
        <div style="padding:0 24px 20px;">
          <div class="flex gap-3">
            <button id="forceUploadBtn" class="sync-card card-upload">
              <div class="icon-circle icon-upload">
                <svg style="width:20px;height:20px;color:white;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              </div>
              <div class="card-title">上传到云端</div>
              <div class="card-hint">本机 → 云端</div>
            </button>
            <button id="forceDownloadBtn" class="sync-card card-download">
              <div class="icon-circle icon-download">
                <svg style="width:20px;height:20px;color:white;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
              </div>
              <div class="card-title">从云端拉取</div>
              <div class="card-hint">云端 → 本机</div>
            </button>
          </div>
        </div>
        <div class="flex border-t dark:border-gray-700" style="padding:10px 24px;">
          <button id="exportFileBtn" class="file-btn">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            导出文件
          </button>
          <button id="importFileBtn" class="file-btn">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            导入文件
          </button>
        </div>
        <!-- 数据备份区域 -->
        <div id="backupSection" class="border-t dark:border-gray-700" style="padding:16px 24px 20px;">
          <div class="flex items-center justify-between mb-3">
            <span style="font-size:13px;font-weight:600;color:#374151;" class="dark:text-gray-300">数据备份</span>
            <div class="flex items-center gap-2">
              <span id="storageUsageText" style="font-size:11px;color:#9ca3af;">计算中...</span>
              <button id="createBackupBtn" style="font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;cursor:pointer;transition:all 0.15s;" class="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">立即备份</button>
            </div>
          </div>
          <!-- 存储用量条 -->
          <div style="height:4px;background:#f3f4f6;border-radius:2px;margin-bottom:12px;overflow:hidden;" class="dark:bg-gray-700">
            <div id="storageUsageBar" style="height:100%;width:0%;background:#3b82f6;border-radius:2px;transition:width 0.3s;"></div>
          </div>
          <div id="backupList" style="font-size:12px;color:#6b7280;" class="dark:text-gray-400">
            加载中...
          </div>
        </div>
      </div>
    </div>
    <input type="file" id="syncImportInput" accept=".json" style="opacity:0;position:absolute;pointer-events:none;">
  `
}

export const renderMobileSyncPanel = (): string => {
  return `
    <div id="mobileSyncModal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" id="mobileSyncOverlay"></div>
      <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-8 p-10 max-h-[90%] overflow-y-auto">
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white">手机同步设置</h3>
          <button id="mobileSyncClose" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2.5">API 地址</label>
            <input type="url" id="mobileSyncApiUrl" class="w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="https://your-worker.workers.dev">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2.5">API 密钥</label>
            <input type="text" id="mobileSyncApiToken" class="w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="粘贴你的 API Token" autocomplete="off">
          </div>
          <div class="flex gap-4 pt-2">
            <button id="mobileSyncSaveBtn" class="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">保存设置</button>
            <button id="mobileSyncNowBtn" class="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium">立即同步</button>
          </div>
          <div id="mobileSyncStatus" class="text-xs text-gray-500 dark:text-gray-400 min-h-[1.25rem]"></div>
          <div class="pt-4 border-t dark:border-gray-700">
            <p class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">手机访问你的 Worker 地址即可添加任务，也可通过 Telegram Bot 发消息添加。</p>
          </div>
        </div>
      </div>
    </div>
  `
}

export const renderApp = (container: HTMLElement): void => {
  const { darkMode, currentView } = getState()
  if (darkMode) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  // 注入每周目标卡片样式（仅一次）
  if (!document.getElementById('weeklyGoalStyles')) {
    const style = document.createElement('style')
    style.id = 'weeklyGoalStyles'
    style.textContent = `
      .stats-row {
        margin-bottom: 16px;
      }
      .stats-row-bar {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        font-size: 13px;
      }
      .dark .stats-row-bar {
        background: #1f2937;
        border-color: #374151;
      }
      .stats-row-items {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .stats-toggle-btn {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        color: #cbd5e1;
        transition: all 0.15s;
        margin-left: 8px;
      }
      .stats-toggle-btn:hover {
        background: #f1f5f9;
        color: #6366f1;
      }
      .dark .stats-toggle-btn:hover {
        background: rgba(99,102,241,0.1);
      }
      .stats-chevron {
        font-size: 12px;
        transition: transform 0.2s;
        line-height: 1;
      }
      .stats-chevron.open { transform: rotate(180deg); }

      .goal-card {
        margin: 8px 0 0 0;
        background: linear-gradient(135deg, #eef2ff 0%, #f0f9ff 100%);
        border: 1px solid #e0e7ff;
        border-radius: 12px;
        padding: 18px 20px;
        animation: goalFadeIn 0.2s ease;
      }
      @keyframes goalFadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
      .dark .goal-card { background: linear-gradient(135deg, rgba(30,41,59,0.8), rgba(30,27,75,0.6)); border-color: rgba(99,102,241,0.3); }

      .goal-card .goal-card-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 14px;
      }
      .goal-card-label { display: flex; align-items: center; gap: 8px; }
      .goal-card-label svg { width: 18px; height: 18px; color: #6366f1; }
      .goal-card-label span { font-size: 14px; font-weight: 600; color: #1e293b; }
      .dark .goal-card-label span { color: #e2e8f0; }
      .goal-card-target {
        font-size: 13px; color: #6366f1;
        background: rgba(99,102,241,0.1);
        padding: 3px 10px; border-radius: 6px; font-weight: 500;
      }
      .goal-card-anchor { font-size: 12px; color: #64748b; margin-bottom: 12px; }
      .goal-card-anchor strong { color: #475569; }
      .goal-card-row { display: flex; gap: 16px; margin-bottom: 12px; }
      .goal-card-stat {
        flex: 1; background: rgba(255,255,255,0.7);
        border-radius: 8px; padding: 10px 12px;
      }
      .dark .goal-card-stat { background: rgba(30,41,59,0.6); }
      .goal-card-stat .stat-label {
        font-size: 11px; color: #94a3b8;
        text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px;
      }
      .goal-card-stat .stat-value { font-size: 20px; font-weight: 700; color: #0f172a; }
      .dark .goal-card-stat .stat-value { color: #f1f5f9; }
      .goal-card-stat .stat-value .unit { font-size: 13px; font-weight: 400; color: #94a3b8; margin-left: 2px; }
      .goal-card-stat .stat-sub { font-size: 11px; margin-top: 2px; }
      .stat-green { color: #059669; }
      .stat-red { color: #dc2626; }
      .stat-neutral { color: #6366f1; }
      .gap-negative { color: #dc2626 !important; }
      .gap-positive { color: #059669 !important; }
      .goal-card-bar-wrap { margin-top: 4px; }
      .goal-bar-labels {
        display: flex; justify-content: space-between;
        font-size: 11px; color: #94a3b8; margin-bottom: 4px;
      }
      .goal-bar-labels .pace { color: #6366f1; font-weight: 500; }
      .goal-bar-bg {
        height: 8px; background: rgba(99,102,241,0.15);
        border-radius: 4px; overflow: hidden; position: relative;
      }
      .goal-bar-fill {
        height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8);
        border-radius: 4px; transition: width 0.3s;
      }
      .goal-bar-line {
        position: absolute; top: -2px; bottom: -2px;
        width: 2px; background: #f59e0b; border-radius: 1px;
      }
      .goal-bar-label {
        display: flex; justify-content: space-between;
        font-size: 11px; color: #94a3b8; margin-top: 4px;
      }
      .goal-card-detail { display: none; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #c7d2fe; }
      .goal-card.expanded .goal-card-detail { display: block; }
      .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .detail-item { background: rgba(255,255,255,0.6); border-radius: 8px; padding: 10px 12px; }
      .dark .detail-item { background: rgba(30,41,59,0.6); }
      .detail-item .label { font-size: 11px; color: #94a3b8; }
      .detail-item .value { font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 2px; }
      .dark .detail-item .value { color: #f1f5f9; }
      .detail-item .desc { font-size: 11px; color: #94a3b8; margin-top: 1px; }
      .goal-adjust-btn {
        margin-top: 12px; padding: 8px 0; width: 100%;
        border: 1px dashed #c7d2fe; border-radius: 8px; background: transparent;
        font-size: 13px; color: #6366f1; cursor: pointer; transition: background 0.15s;
      }
      .goal-adjust-btn:hover { background: rgba(99,102,241,0.06); }

      /* 快捷日期选择 */
      .quick-dates-row {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
      }
      .quick-date-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: 6px 2px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }
      .dark .quick-date-btn {
        background: #374151;
        border-color: #4b5563;
      }
      .quick-date-btn:hover {
        border-color: #c7d2fe;
        background: #f5f3ff;
      }
      .dark .quick-date-btn:hover {
        border-color: #6366f1;
        background: rgba(99,102,241,0.1);
      }
      .quick-date-btn .quick-day-name {
        font-size: 9px;
        color: #9ca3af;
        font-weight: 500;
      }
      .quick-date-btn .quick-day-num {
        font-size: 15px;
        font-weight: 600;
        color: #374151;
      }
      .dark .quick-date-btn .quick-day-num { color: #e5e7eb; }
      .quick-date-btn .quick-date-badge {
        font-size: 7px;
        padding: 1px 4px;
        border-radius: 3px;
        background: transparent;
        color: transparent;
      }

      /* 今天标记 */
      .quick-date-btn.today {
        border-color: #6366f1;
        background: #eef2ff;
      }
      .dark .quick-date-btn.today {
        background: rgba(99,102,241,0.15);
        border-color: #818cf8;
      }
      .quick-date-btn.today .quick-day-name { color: #6366f1; }
      .quick-date-btn.today .quick-day-num { color: #6366f1; }
      .dark .quick-date-btn.today .quick-day-name,
      .dark .quick-date-btn.today .quick-day-num { color: #a5b4fc; }
      .quick-date-btn.today .quick-date-badge {
        background: #6366f1;
        color: white;
      }
      .dark .quick-date-btn.today .quick-date-badge { background: #818cf8; }

      /* 选中状态 */
      .quick-date-btn.selected {
        border-color: #6366f1;
        background: #6366f1;
      }
      .quick-date-btn.selected .quick-day-name { color: rgba(255,255,255,0.75); }
      .quick-date-btn.selected .quick-day-num { color: white; }
      .quick-date-btn.selected .quick-date-badge {
        background: rgba(255,255,255,0.25);
        color: white;
      }
      .dark .quick-date-btn.selected { border-color: #818cf8; background: #6366f1; }
    `
    document.head.appendChild(style)
  }

  const viewMaxWidth: Record<string, string> = {
    list: 'max-w-4xl',
    day: 'max-w-4xl',
    week: 'max-w-6xl',
    month: 'max-w-7xl'
  }
  const maxWidth = viewMaxWidth[currentView] || 'max-w-4xl'
  container.innerHTML = `
    <div class="${maxWidth} mx-auto p-4 min-h-screen transition-all duration-300">
      ${renderStats()}
      ${renderHeader()}
      ${renderFilters()}
      ${renderTaskList()}
      ${renderModal()}
      ${renderCategoryModal()}
      ${renderGoalSettingsModal()}
      ${renderSyncModal()}
      ${renderMobileSyncPanel()}
    </div>
  `
}
