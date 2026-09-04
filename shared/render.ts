import type { Task, Priority } from './types'
import {
  getState,
  formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, getWeekDates, isOverdue, isTaskDueOnDate,
  isTaskCompletedOnDate, summarizeTaskDurationsForDates,
  getPriorityColor, getFilteredTasks, getStats, getWeeklyGoalStats,
  getParentTaskProgress, escapeHtml
} from './task'
import { getSyncStatus } from './sync'
import type { SyncStatus } from './sync'
import { getHistoricalOverdueTasks, getTaskPoolTasks } from './planning'
import { insertTodayDate } from './list-navigation'

// ==================== 同步状态指示器 ====================
export const renderSyncIndicator = (): string => {
  const status = getSyncStatus()
  if (status === 'idle') return ''

  const icons: Record<SyncStatus, string> = {
    idle: '',
    saving: `<span id="syncIndicator" class="p-2 rounded-lg transition text-blue-500" title="正在同步...">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </span>`,
    'local-saved': `<span id="syncIndicator" class="p-2 rounded-lg transition text-amber-500" title="已保存在本机，等待云同步">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
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
  if (!stats) {
    return `
      <div class="goal-card goal-card-empty" id="weeklyGoalCard">
        <div class="goal-card-header">
          <div class="goal-card-label">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>每周节奏</span>
          </div>
        </div>
        <p class="goal-card-empty-copy">暂无可统计的完成时长</p>
        <button id="openGoalSettingsBtn" class="goal-adjust-btn">设置周目标</button>
      </div>
    `
  }

  const formatWeeks = (w: number) => {
    if (w < 1) return '<1 周'
    return `${Math.floor(w)} 周` + (w % 1 >= 0.5 ? '半' : '')
  }
  const formatH = (m: number) => (m / 60).toFixed(1) + 'h'

  const gapClass = stats.behindExpected ? 'gap-negative' : 'gap-positive'
  const gapSign = stats.behindExpected ? '' : '+'
  const expectedPos = Math.min(100, stats.progressPercent)

  return `
    <div class="goal-card" id="weeklyGoalCard">
      <div class="goal-card-header">
        <div class="goal-card-label">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>每周节奏</span>
        </div>
        <span class="goal-card-target">目标 ${formatH(stats.weeklyGoalMinutes)} / 周</span>
      </div>
      <div class="goal-card-start"><strong>统计起点</strong><span>${stats.anchorDate}</span><span>从这一天开始计算目标进度</span></div>
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
        <button id="adjustGoalAnchorBtn" class="goal-adjust-btn">修改目标设置</button>
      </div>
    </div>
  `
}

export const renderGoalSettingsModal = (): string => {
  const { weeklyGoalMinutes = 600, weeklyGoalAnchor } = getState()
  const today = formatDate(new Date())
  const currentStats = getWeeklyGoalStats()
  const startDate = weeklyGoalAnchor || currentStats?.anchorDate || today
  const startDateHint = weeklyGoalAnchor
    ? '当前使用你设置的日期'
    : currentStats
      ? '当前日期由最早完成任务自动确定'
      : '尚无完成记录，暂从今天开始'

  return `
    <div id="goalSettingsModal" class="fixed inset-0 flex items-center justify-center z-50 hidden goal-settings-overlay" role="dialog" aria-modal="true" aria-labelledby="goalSettingsTitle">
      <div class="goal-settings-panel">
        <div class="goal-settings-header">
          <div class="goal-settings-heading">
            <span class="goal-settings-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke-width="2"/><path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" stroke-width="2" stroke-linecap="round"/></svg>
            </span>
            <div>
              <h3 id="goalSettingsTitle">设置每周目标</h3>
              <p>定义每周投入，并选择从哪一天开始统计</p>
            </div>
          </div>
          <button id="closeGoalSettingsBtn" class="goal-settings-close" type="button" title="关闭" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 6l12 12M18 6L6 18" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div class="goal-settings-body">
          <div class="goal-settings-field">
            <label for="goalWeeklyHours">每周目标</label>
            <p>你计划每周投入多少时间</p>
            <div class="goal-settings-input-unit">
              <input type="number" id="goalWeeklyHours" value="${(weeklyGoalMinutes / 60).toFixed(1)}" min="0.5" max="168" step="0.5" inputmode="decimal" aria-describedby="goalWeeklyHoursHint">
              <span>小时 / 周</span>
            </div>
            <span id="goalWeeklyHoursHint" class="goal-settings-field-hint">可设置 0.5 至 168 小时</span>
          </div>

          <div class="goal-settings-field">
            <label for="goalAnchorDate">统计起始日期</label>
            <p>从这一天开始累计周数并计算目标差距</p>
            <input type="date" id="goalAnchorDate" value="${startDate}" max="${today}" aria-describedby="goalAnchorDateHint">
            <span id="goalAnchorDateHint" class="goal-settings-field-hint">${startDateHint}</span>
          </div>

          <div class="goal-settings-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-width="2"/><path d="M12 11v5M12 8h.01" stroke-width="2" stroke-linecap="round"/></svg>
            <span>修改起始日期会重新计算进度与差距，不会修改或删除任务。</span>
          </div>
          <p id="goalSettingsError" class="goal-settings-error hidden" role="alert"></p>
        </div>

        <div class="goal-settings-footer">
          <button id="cancelGoalSettingsBtn" class="goal-settings-secondary" type="button">取消</button>
          <button id="saveGoalSettingsBtn" class="goal-settings-primary" type="button">保存设置</button>
        </div>
      </div>
    </div>
  `
}

export const renderStats = (): string => {
  const stats = getStats()
  const isPopup = window.location.pathname.includes('popup')
  return `
    <div id="statsRow" class="stats-row">
      <div class="stats-row-bar">
        <div class="stats-row-items">
          <span><span class="text-gray-500">待完成</span> <span class="font-medium text-orange-500">${formatHours(stats.pending)}</span></span>
          <span class="text-gray-300 dark:text-gray-600">·</span>
          <span><span class="text-gray-500">今日</span> <span class="font-medium">${stats.todayDone}/${stats.todayTotal}</span></span>
          <span class="text-gray-300 dark:text-gray-600">·</span>
          <span class="${stats.overdueCount > 0 ? 'text-red-500 font-medium' : 'text-gray-500'}">${stats.overdueCount} 项过期</span>
        </div>
        ${isPopup ? '' : `<button id="statsToggleBtn" class="stats-toggle-btn" title="每周节奏">
          <span id="statsChevron" class="stats-chevron">&#x25BE;</span>
        </button>`}
      </div>
      ${isPopup ? '' : `<div id="weeklyGoalWrapper" style="display:none;">
        ${renderWeeklyGoalCard()}
      </div>`}
    </div>
  `
}

export const renderHeader = (): string => {
  const { currentView, darkMode } = getState()
  const isNewTab = window.location.pathname.includes('newtab')
  const isPopup = !isNewTab
  return `
    <header class="${isPopup ? 'popup-app-header ' : ''}flex items-start justify-between mb-4 flex-wrap gap-3">
      <div class="header-brand flex items-center gap-3">
        <h1 class="text-xl font-semibold">任务管理</h1>
        <button id="openFullPage" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm" title="新标签页打开">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </button>
      </div>
      <div class="app-header-actions ml-auto flex flex-col items-end gap-2 min-w-0 max-w-full">
        <div class="view-nav order-last md:order-none w-full md:w-auto flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
          <button data-view="focus" class="px-3 py-1 rounded text-sm transition whitespace-nowrap flex-shrink-0 ${currentView === 'focus' ? 'bg-white dark:bg-gray-700 shadow' : ''}">今日聚焦</button>
          <button data-view="pool" class="px-3 py-1 rounded text-sm transition whitespace-nowrap flex-shrink-0 ${currentView === 'pool' ? 'bg-white dark:bg-gray-700 shadow' : ''}">任务池</button>
          <button data-view="list" class="px-3 py-1 rounded text-sm transition whitespace-nowrap flex-shrink-0 ${currentView === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}">全部任务</button>
          ${isNewTab ? `
          <button data-view="day" class="px-3 py-1 rounded text-sm transition whitespace-nowrap flex-shrink-0 ${currentView === 'day' ? 'bg-white dark:bg-gray-700 shadow' : ''}">日</button>
          <button data-view="week" class="px-3 py-1 rounded text-sm transition whitespace-nowrap flex-shrink-0 ${currentView === 'week' ? 'bg-white dark:bg-gray-700 shadow' : ''}">周</button>
          <button data-view="month" class="px-3 py-1 rounded text-sm transition whitespace-nowrap flex-shrink-0 ${currentView === 'month' ? 'bg-white dark:bg-gray-700 shadow' : ''}">月</button>
          ` : ''}
        </div>
        <div class="header-utility-actions w-full flex items-center justify-end gap-2 flex-wrap">
        ${isNewTab ? '' : `<button id="toggleFiltersBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="展开筛选" aria-expanded="false" aria-controls="taskFilters">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6L14 13.67V19a1 1 0 01-.45.83l-4 2.67A1 1 0 018 21.67v-8L3.2 4.6A1 1 0 013 4z"/></svg>
        </button>`}
        <button id="darkModeBtn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" title="切换深色模式">
          ${darkMode
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>'}
        </button>
        <span id="syncIndicatorSlot" aria-live="polite">${renderSyncIndicator()}</span>
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
      </div>
    </header>
  `
}

export const renderFilters = (): string => {
  const { hideCompleted, hideOverdue, filterPriority, filterCategory, categories = [] } = getState()
  const isPopup = window.location.pathname.includes('popup')
  return `
    <div id="taskFilters" class="${isPopup ? 'hidden ' : ''}flex flex-wrap gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 mb-4 items-center text-sm">
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
    </div>
  `
}

export const renderTaskItem = (task: Task): string => {
  const category = getState().categories.find(c => c.id === task.category)
  const overdue = !task.noTimeLimit && isOverdue(task.dueDate, task.completed)
  const today = formatDate(new Date())
  const parent = task.parentId ? getState().tasks.find(item => item.id === task.parentId) : undefined
  const isPopup = window.location.pathname.includes('popup')

  if (task.isParent && isPopup) {
    const progress = getParentTaskProgress(task)
    return `
      <div class="task-row popup-task-row flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${task.completed ? 'opacity-60' : ''}" data-task-id="${task.id}">
        <button class="task-toggle flex-shrink-0 w-5 h-5 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500'} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}" title="${task.completed ? '标记为未完成' : '标记为已完成（子任务一并完成）'}">
          ${task.completed ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
        </button>
        <div class="w-1.5 h-8 rounded ${getPriorityColor(task.priority)} flex-shrink-0" aria-hidden="true"></div>
        <div class="task-main flex-1 min-w-0">
          <div class="font-medium truncate ${task.completed ? 'line-through text-gray-400' : ''}">${escapeHtml(task.title)}</div>
          <div class="mt-0.5 text-xs text-gray-400">父任务 · ${progress.completed}/${progress.total} 个子任务完成</div>
        </div>
        <details class="task-more-menu flex-shrink-0">
          <summary class="task-more-trigger" title="更多操作" aria-label="${escapeHtml(task.title)}的更多操作">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </summary>
          <div class="task-more-popover">
            <button class="task-split" data-id="${task.id}">添加子任务</button>
            <button class="task-edit" data-id="${task.id}">编辑</button>
            <button class="task-delete task-more-danger" data-id="${task.id}">删除</button>
          </div>
        </details>
      </div>
    `
  }

  if (task.isParent) {
    const progress = getParentTaskProgress(task)
    const children = getFilteredTasks().filter(child => child.parentId === task.id)
    return `
      <div class="p-4 bg-white dark:bg-gray-800${task.completed ? ' opacity-60' : ''}" data-task-id="${task.id}">
        <div class="flex items-start gap-3">
          <button class="task-toggle flex-shrink-0 w-5 h-5 mt-1.5 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500'} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}" title="${task.completed ? '标记为未完成' : '标记为已完成（子任务一并完成）'}">
            ${task.completed ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
          </button>
          <div class="w-2 h-8 rounded ${getPriorityColor(task.priority)} flex-shrink-0${task.completed ? ' opacity-50' : ''}"></div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold${task.completed ? ' line-through text-gray-400' : ''}">${escapeHtml(task.title)}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300">父任务</span>
              ${task.completed ? '<span class="text-xs px-2 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300">已完成</span>' : ''}
              ${task.hardDeadline ? `<span class="text-xs text-red-500">硬截止 ${task.hardDeadline}</span>` : ''}
            </div>
            <div class="flex items-center gap-3 mt-2">
              <div class="h-2 flex-1 max-w-xs rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"><div class="h-full bg-blue-500 rounded-full" style="width:${progress.percent}%"></div></div>
              <span class="text-xs font-medium text-gray-500">${progress.completed}/${progress.total} · ${progress.percent}%</span>
            </div>
          </div>
          <button class="task-split p-2 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded transition text-violet-500" data-id="${task.id}" title="继续添加子任务">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          </button>
          <button class="task-edit p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition" data-id="${task.id}" title="编辑父任务">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>
          <button class="task-delete p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition text-red-500" data-id="${task.id}" title="删除父任务及子任务">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
        ${children.length > 0 ? `<div class="mt-3 ml-5 border-l-2 border-violet-100 dark:border-violet-900/40">${children.map(child => renderTaskItem(child)).join('')}</div>` : '<p class="mt-3 ml-5 text-xs text-gray-400">暂无子任务</p>'}
      </div>
    `
  }

  if (isPopup) {
    return `
      <div class="task-row popup-task-row flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${task.completed ? 'opacity-60' : ''} ${overdue && !task.completed ? 'bg-red-50/50 dark:bg-red-900/10' : ''}" data-task-id="${task.id}" draggable="true">
        <button class="task-toggle flex-shrink-0 w-5 h-5 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-500' : task.noTimeLimit ? 'border-dashed border-gray-400' : 'border-gray-300 dark:border-gray-500'} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}" title="${task.completed ? '标记为未完成' : '标记为已完成'}">
          ${task.completed ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
        </button>
        <div class="w-1.5 h-8 rounded ${getPriorityColor(task.priority)} flex-shrink-0" aria-hidden="true"></div>
        <div class="task-main flex-1 min-w-0">
          <div class="font-medium truncate ${task.completed ? 'line-through text-gray-400' : ''}">${escapeHtml(task.title)}</div>
          <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
            <span class="${overdue ? 'text-red-500 font-medium' : ''}">${task.noTimeLimit ? '任务池' : getDateLabel(task.dueDate)}</span>
            ${task.duration > 0 ? `<span>· ${formatHours(task.duration)}</span>` : ''}
          </div>
        </div>
        <details class="task-more-menu flex-shrink-0">
          <summary class="task-more-trigger" title="更多操作" aria-label="${escapeHtml(task.title)}的更多操作">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </summary>
          <div class="task-more-popover">
            ${task.repeatType === 'none' && !task.noTimeLimit && !isTaskDueOnDate(task, today) ? `<button class="task-focus-toggle" data-id="${task.id}">加入今天</button>` : ''}
            ${task.repeatType === 'none' ? `<button class="overdue-replan" data-id="${task.id}">${task.noTimeLimit ? '安排时间' : '重新排期'}</button>` : ''}
            ${task.repeatType === 'none' ? `<button class="task-split" data-id="${task.id}">拆分任务</button>` : ''}
            <button class="task-edit" data-id="${task.id}">编辑</button>
            <button class="task-delete task-more-danger" data-id="${task.id}">删除</button>
          </div>
        </details>
      </div>
    `
  }

  return `
    <div class="task-row flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${task.completed ? 'opacity-60' : ''} ${task.noTimeLimit ? 'border-l-[3px] border-dashed border-gray-300 dark:border-gray-600 pl-3 -ml-3' : ''} ${overdue && !task.completed ? 'bg-red-50/50 dark:bg-red-900/10' : ''}" data-task-id="${task.id}" draggable="true">
      <div class="w-2 h-8 rounded ${getPriorityColor(task.priority)} flex-shrink-0"></div>
      <button class="task-toggle flex-shrink-0 w-5 h-5 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-500' : task.noTimeLimit ? 'border-dashed border-gray-400' : 'border-gray-300 dark:border-gray-500'} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}">
        ${task.completed ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
      </button>
      <div class="task-main flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium truncate ${task.completed ? 'line-through text-gray-400' : ''}">${escapeHtml(task.title)}</span>
          ${category ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0" style="background-color: ${category.color}20; color: ${category.color}">${escapeHtml(category.name)}</span>` : ''}
          ${task.noTimeLimit ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-500">无期限</span>` : ''}
          ${parent ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300">属于 ${escapeHtml(parent.title)}</span>` : ''}
        </div>
        <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
          ${task.duration > 0 ? `<span>${formatHours(task.duration)}</span>` : ''}
          ${!task.noTimeLimit ? `<span class="${overdue ? 'text-red-500 font-medium' : ''}">${getRemainingTime(task.dueDate, task.completed)}</span>` : ''}
          ${task.repeatType !== 'none' ? `<span class="text-blue-500">🔄</span>` : ''}
          ${task.hardDeadline ? `<span class="${task.hardDeadline < today && !task.completed ? 'text-red-600 font-medium' : 'text-red-400'}">硬截止 ${task.hardDeadline}</span>` : ''}
        </div>
        ${task.description ? `<p class="text-sm text-gray-500 mt-1 truncate dark:text-gray-400">${escapeHtml(task.description)}</p>` : ''}
      </div>
      <div class="task-actions flex items-center gap-1 flex-shrink-0">
        ${task.repeatType === 'none' && !isTaskDueOnDate(task, today) ? `<button class="task-focus-toggle px-2 py-1 text-xs rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 transition" data-id="${task.id}" title="把计划日期改为今天">今天</button>` : ''}
        ${task.repeatType === 'none' ? `<button class="task-split px-2 py-1 text-xs rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 text-gray-500 hover:text-violet-600 transition" data-id="${task.id}" title="拆成可独立排期的子任务">拆分</button>` : ''}
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

const renderOverdueTaskItem = (task: Task): string => {
  const canSplit = task.repeatType === 'none'
  return `
    <div class="overdue-item">
      <div class="overdue-item-priority ${getPriorityColor(task.priority)}" aria-hidden="true"></div>
      <div class="overdue-item-content">
        <div class="overdue-item-copy">
          <div class="overdue-item-title">${escapeHtml(task.title)}</div>
          <div class="overdue-item-meta">${getRemainingTime(task.dueDate, false)} · 原计划 ${task.dueDate}${task.hardDeadline ? ` · 硬截止 ${task.hardDeadline}` : ''}</div>
        </div>
        <div class="overdue-item-actions">
          ${task.repeatType === 'none' ? `<button class="overdue-item-action overdue-focus" data-id="${task.id}">加入今天</button>` : ''}
          <button class="overdue-item-action overdue-complete" data-id="${task.id}">标记完成</button>
          <button class="overdue-item-action overdue-replan" data-id="${task.id}">重新排期</button>
          ${canSplit ? `<button class="overdue-item-action overdue-split" data-id="${task.id}">拆分任务</button>` : ''}
          <button class="overdue-item-action task-edit overdue-edit" data-id="${task.id}">编辑</button>
          <button class="overdue-item-action overdue-pool" data-id="${task.id}">放回任务池</button>
        </div>
      </div>
    </div>
  `
}


export const renderFocusView = (): string => {
  const state = getState()
  const today = formatDate(new Date())
  const visibleFocused = getFilteredTasks().filter(task => !task.isParent && isTaskDueOnDate(task, today)).filter(task => {
    // A recurring task advances its dueDate after today's instance is done.
    // The next instance belongs to its future date, not to today's focus list.
    return task.repeatType === 'none' || !isTaskCompletedOnDate(task, today)
  })
  const overdue = state.tasks.filter(task => {
    if (task.isParent || task.completed || task.noTimeLimit || !task.dueDate || task.dueDate >= today) return false
    if (state.filterPriority !== 'all' && task.priority !== state.filterPriority) return false
    if (state.filterCategory !== 'all' && task.category !== state.filterCategory) return false
    return true
  })

  return `
    <div class="focus-view">
      ${overdue.length > 0 ? `
        <section class="overdue-panel">
          <div class="overdue-panel-header">
            <div><h3 class="font-semibold text-red-700 dark:text-red-300">昨天及更早未完成</h3><p class="text-xs text-gray-500 mt-0.5">仍然保留逾期状态，请为每项选择下一步。</p></div>
            <button id="toggleOverdueSection" class="overdue-panel-toggle" aria-expanded="${!state.overdueCollapsed}">
              <span>${overdue.length} 项</span><span>${state.overdueCollapsed ? '展开 ▾' : '收起 ▴'}</span>
            </button>
          </div>
          ${state.overdueCollapsed ? '' : `<div class="overdue-panel-list">${overdue.map(renderOverdueTaskItem).join('')}</div>`}
        </section>
      ` : ''}

      <section class="focus-panel">
        <div class="focus-panel-header">
          <div class="focus-panel-copy"><h3>今日聚焦</h3><p>自动显示计划日期为今天的任务。</p></div>
          <span class="focus-panel-count">${visibleFocused.length} 项</span>
        </div>
        ${visibleFocused.length > 0
          ? `<div class="focus-panel-list">${visibleFocused.map(task => renderTaskItem(task)).join('')}</div>`
          : '<div class="focus-panel-empty"><p>今天没有计划任务</p><p>为任务设置今天的计划日期后会自动出现在这里。</p></div>'}
      </section>
    </div>
  `
}

const renderPoolTaskItem = (task: Task): string => {
  if (window.location.pathname.includes('popup')) return renderTaskItem(task)
  const category = getState().categories.find(item => item.id === task.category)
  const parent = task.parentId ? getState().tasks.find(item => item.id === task.parentId) : undefined
  return `
    <div class="task-row pool-task-row flex items-center gap-3 px-4 py-3 border-b last:border-b-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${task.completed ? 'opacity-60' : ''}" data-task-id="${task.id}">
      <div class="w-2 h-8 rounded ${getPriorityColor(task.priority)} flex-shrink-0"></div>
      <button class="task-toggle flex-shrink-0 w-5 h-5 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-500' : 'border-dashed border-gray-400'} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}" aria-label="${task.completed ? '恢复' : '完成'} ${escapeHtml(task.title)}">
        ${task.completed ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
      </button>
      <div class="task-main flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-medium truncate ${task.completed ? 'line-through text-gray-400' : ''}">${escapeHtml(task.title)}</span>
          ${category ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0" style="background-color:${category.color}20;color:${category.color}">${escapeHtml(category.name)}</span>` : ''}
          ${parent ? `<span class="text-xs px-2 py-0.5 rounded flex-shrink-0 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300">属于 ${escapeHtml(parent.title)}</span>` : ''}
        </div>
        <div class="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
          <span>${formatHours(task.duration)}</span>
          <span>尚未安排日期</span>
          ${task.hardDeadline ? `<span class="text-red-500">硬截止 ${task.hardDeadline}</span>` : ''}
        </div>
        ${task.description ? `<p class="text-sm text-gray-500 mt-1 truncate dark:text-gray-400">${escapeHtml(task.description)}</p>` : ''}
      </div>
      <div class="task-actions pool-task-actions flex items-center flex-wrap justify-end flex-shrink-0">
        <button class="pool-focus px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition" data-id="${task.id}">安排到今天</button>
        <button class="overdue-replan px-3 py-1.5 rounded-lg border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs transition" data-id="${task.id}">选择日期</button>
        <button class="task-split px-3 py-1.5 rounded-lg border dark:border-gray-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-600 text-xs transition" data-id="${task.id}">拆分</button>
        <button class="task-edit px-3 py-1.5 rounded-lg border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs transition" data-id="${task.id}">编辑</button>
        <button class="task-delete px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs transition" data-id="${task.id}">删除</button>
      </div>
    </div>
  `
}

export const renderPoolView = (): string => {
  const tasks = getTaskPoolTasks(getFilteredTasks())
  return `
    <section class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between gap-3">
        <div><h3 class="font-semibold">任务池</h3><p class="text-xs text-gray-500 mt-0.5">集中整理尚未安排日期的任务。</p></div>
        <span class="text-xs text-gray-400">${tasks.length} 项</span>
      </div>
      ${tasks.length > 0
        ? tasks.map(renderPoolTaskItem).join('')
        : '<div class="text-center py-10 text-gray-400"><p>任务池已清空</p><p class="text-sm mt-1">未排期任务会自动出现在这里。</p></div>'}
    </section>
  `
}

export const renderListView = (): string => {
  const tasks = getFilteredTasks()
  const today = formatDate(new Date())
  if (tasks.length === 0) {
    return `<div id="todayAnchor" data-date="${today}" class="today-anchor">今天 · 当前筛选无任务</div><div class="text-center py-12 text-gray-400"><p class="text-lg">暂无任务</p></div>`
  }
  const parents = tasks.filter(task => task.isParent)
  const visibleParentIds = new Set(parents.map(parent => parent.id))
  const schedulableTasks = tasks.filter(task => !task.isParent && (!task.parentId || !visibleParentIds.has(task.parentId)))
  const groups = new Map<string, Task[]>()
  schedulableTasks.forEach(t => {
    const key = t.noTimeLimit ? 'no-date' : t.dueDate
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  })
  const dates = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'no-date') return 1
    if (b === 'no-date') return -1
    return a.localeCompare(b)
  })
  const orderedDates = insertTodayDate(dates, today)
  const parentSection = parents.length > 0 ? `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden mb-4">
      <div class="px-4 py-2 bg-violet-50 dark:bg-violet-900/20 font-medium text-sm text-violet-700 dark:text-violet-300">大任务与拆分进度</div>
      ${parents.map(parent => renderTaskItem(parent)).join('')}
    </div>
  ` : ''
  return parentSection + orderedDates.map(d => `
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden mb-4">
      <div ${d === today ? 'id="todayAnchor"' : ''} class="px-4 py-2 bg-gray-50 dark:bg-gray-900 font-medium text-sm text-gray-600 dark:text-gray-400 drop-zone ${d === today ? 'today-anchor' : ''}" data-date="${d}">
        ${d === 'no-date' ? '任务池（无截止日期）' : d === today && !(groups.get(d) || []).length ? '今天 · 当前筛选无任务' : getDateLabel(d)}
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
  const state = getState()
  const { currentDate } = state
  const days = getWeekDates(currentDate)
  const weekStart = days[0]
  const todayStr = formatDate(new Date())
  const isCurrentWeek = getWeekDates(todayStr)[0] === weekStart
  const visibleTasks = getFilteredTasks().filter(task => !task.isParent)
  const tasksByDay = days.map(date => visibleTasks.filter(task => {
    if (!isTaskDueOnDate(task, date)) return false
    return !(state.hideCompleted && isTaskCompletedOnDate(task, date))
  }))
  const weekTaskCount = tasksByDay.reduce((sum, tasks) => sum + tasks.length, 0)
  const weekMinutes = tasksByDay.reduce((sum, tasks) => sum + tasks.reduce((daySum, task) => daySum + task.duration, 0), 0)
  const historicalOverdue = getHistoricalOverdueTasks(state.tasks, weekStart, {
    hideOverdue: state.hideOverdue,
    showNoTimeLimitOnly: state.showNoTimeLimitOnly,
    priority: state.filterPriority,
    category: state.filterCategory
  })

  return `
    <div class="space-y-4">
      <section class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <button id="prevWeek" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex flex-col items-center">
          <span class="font-medium">${days[0].slice(5)} ~ ${days[6].slice(5)}</span>
          <span class="text-xs text-gray-400 mt-1">计划日期落在本周的任务会自动出现</span>
          ${!isCurrentWeek ? `<button id="goTodayWeek" class="text-xs text-blue-500 hover:underline mt-1">回到本周</button>` : ''}
        </div>
        <button id="nextWeek" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      ${historicalOverdue.length > 0 ? `
        <div class="overdue-panel overdue-panel-embedded">
          <div class="overdue-panel-header">
            <div><h3 class="font-semibold text-sm text-red-700 dark:text-red-300">本周开始前未完成</h3><p class="text-xs text-gray-500 mt-0.5">保留逾期状态，需要时再展开处理。</p></div>
            <button id="toggleOverdueSection" class="overdue-panel-toggle" aria-expanded="${!state.overdueCollapsed}">
              <span>${historicalOverdue.length} 项</span><span>${state.overdueCollapsed ? '展开 ▾' : '收起 ▴'}</span>
            </button>
          </div>
          ${state.overdueCollapsed ? '' : `<div class="overdue-panel-list">${historicalOverdue.map(task => renderWeekOverdueTaskItem(task, days)).join('')}</div>`}
        </div>
      ` : ''}

      <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between gap-3">
        <div><h3 class="font-semibold">本周聚焦</h3><p class="text-xs text-gray-500 mt-0.5">拖动任务可调整到本周其他日期。</p></div>
        <span class="text-xs text-gray-400">${weekTaskCount} 项 · ${formatHours(weekMinutes)}</span>
      </div>
      <div>
        ${days.map((d, index) => {
          const dayTasks = tasksByDay[index]
          const isToday = d === todayStr
          const pendingMin = dayTasks.filter(task => !isTaskCompletedOnDate(task, d)).reduce((sum, task) => sum + task.duration, 0)
          const completedMin = dayTasks.filter(task => isTaskCompletedOnDate(task, d)).reduce((sum, task) => sum + task.duration, 0)
          return `
            <div class="week-day-row grid border-b last:border-b-0 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition drop-zone ${isToday ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}" style="grid-template-columns:7rem minmax(0,1fr)" data-date="${d}">
              <div class="week-day-label p-3 border-r dark:border-gray-700 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}">
                <div class="text-sm font-medium ${isToday ? 'text-blue-500' : ''}">${getDateLabel(d)}</div>
                <div class="text-xs text-gray-400 mt-1">
                  <span>${dayTasks.length} 项</span>
                  ${pendingMin > 0 ? `<br><span class="text-orange-500">待完成 ${formatHours(pendingMin)}</span>` : ''}
                  ${completedMin > 0 ? `<br><span class="text-green-500">已完成 ${formatHours(completedMin)}</span>` : ''}
                </div>
              </div>
              <div class="p-2 min-h-[80px] flex flex-wrap content-start gap-2 min-w-0">
                ${dayTasks.length === 0 ? '<span class="text-xs text-gray-300 dark:text-gray-600 self-center">暂无任务，可拖到这里</span>' : dayTasks.map(task => renderWeekTaskCard(task, d, d < todayStr)).join('')}
              </div>
            </div>
          `
        }).join('')}
      </div>
      </section>
    </div>
  `
}

const renderWeekOverdueTaskItem = (task: Task, days: string[]): string => `
  <div class="overdue-item week-overdue-item">
    <div class="overdue-item-priority ${getPriorityColor(task.priority)}" aria-hidden="true"></div>
    <div class="overdue-item-content">
      <div class="overdue-item-copy">
        <div class="overdue-item-title">${escapeHtml(task.title)}</div>
        <div class="overdue-item-meta">${getRemainingTime(task.dueDate, false)} · 原计划 ${task.dueDate}${task.hardDeadline ? ` · 硬截止 ${task.hardDeadline}` : ''}</div>
      </div>
      <div class="overdue-item-actions">
        <button class="overdue-item-action week-plan-toggle" data-id="${escapeHtml(task.id)}" aria-expanded="false">安排到本周</button>
        <button class="overdue-item-action overdue-complete" data-id="${escapeHtml(task.id)}">标记完成</button>
        <button class="overdue-item-action overdue-replan" data-id="${escapeHtml(task.id)}">重新排期</button>
        <button class="overdue-item-action overdue-split" data-id="${escapeHtml(task.id)}">拆分任务</button>
        <button class="overdue-item-action overdue-pool" data-id="${escapeHtml(task.id)}">放回任务池</button>
      </div>
      <div class="week-day-picker hidden" data-id="${escapeHtml(task.id)}">
        ${days.map(date => `<button class="week-plan-date" data-id="${escapeHtml(task.id)}" data-date="${date}">${getDateLabel(date)}</button>`).join('')}
      </div>
    </div>
  </div>
`

const renderWeekTaskCard = (task: Task, date: string, isPastDate: boolean): string => {
  const cat = getState().categories.find(c => c.id === task.category)
  const done = isTaskCompletedOnDate(task, date)
  return `
    <div class="week-task-item p-2 rounded border dark:border-gray-600 ${done ? 'opacity-50 bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-700 hover:shadow-md'} transition cursor-move flex-1" style="min-width:min(100%,168px);max-width:280px" draggable="true" data-task-id="${task.id}" title="双击编辑">
      <div class="flex items-start gap-2">
        <div class="w-1 h-full min-h-[32px] rounded ${getPriorityColor(task.priority)}"></div>
        <button class="task-toggle flex-shrink-0 w-5 h-5 rounded-full border-2 ${done ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-500'} flex items-center justify-center hover:border-blue-400 transition" data-task-id="${task.id}" data-task-date="${date}" aria-label="${done ? '恢复' : '完成'} ${escapeHtml(task.title)}">
          ${done ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 mb-1">
            <span class="text-sm font-medium truncate ${done ? 'line-through' : ''}">${escapeHtml(task.title)}</span>
            ${task.repeatType !== 'none' ? '<span class="text-blue-500">🔄</span>' : ''}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span>${formatHours(task.duration)}</span>
            ${cat ? `<span class="px-1 py-0.5 rounded text-white" style="background-color:${cat.color}">${escapeHtml(cat.name)}</span>` : ''}
            ${isPastDate && !done ? '<span class="text-red-500 font-medium">本周内逾期</span>' : ''}
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
  const tasks = getState().tasks
  const isDateInDisplayedMonth = (date: string): boolean => {
    const parsed = parseDate(date)
    return parsed.getFullYear() === year && parsed.getMonth() === month
  }
  const weekSummaries = weeks.map(week =>
    summarizeTaskDurationsForDates(tasks, week.filter(isDateInDisplayedMonth))
  )

  // 月汇总
  const monthDates = weeks.flat().filter(isDateInDisplayedMonth)
  const monthSummary = summarizeTaskDurationsForDates(tasks, monthDates)
  const monthPending = monthSummary.pending
  const monthDone = monthSummary.done

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
      const daySummary = summarizeTaskDurationsForDates(dayTasks, [d])
      const pendingMin = daySummary.pending
      const completedMin = daySummary.done
      const miniPending = pendingMin > 0 ? `<span class="text-[9px] text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1 rounded leading-tight font-medium">${formatHours(pendingMin)}</span>` : ''
      const miniDone = completedMin > 0 ? `<span class="text-[9px] text-green-500 bg-green-50 dark:bg-green-900/20 px-1 rounded leading-tight font-medium">✓${formatHours(completedMin)}</span>` : ''
      const taskCards = dayTasks.slice(0, 2).map(t => {
        const done = isTaskCompletedOnDate(t, d)
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
    case 'focus': return renderFocusView()
    case 'pool': return renderPoolView()
    case 'list': return renderListView()
    case 'day': return renderDayView()
    case 'week': return renderWeekView()
    case 'month': return renderMonthView()
  }
}

// ==================== 未来 7 天快捷日期选择 ====================
export const renderQuickDates = (selectedDate: string, excludeTaskId?: string): string => {
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

    const dayLoadMinutes = getState().tasks.reduce((sum, t) => {
      if (t.id === excludeTaskId || !isTaskDueOnDate(t, dateStr)) return sum
      return sum + t.duration
    }, 0)
    const loadHours = (dayLoadMinutes / 60).toFixed(1).replace(/\.0$/, '')
    const overloaded = dayLoadMinutes > 480

    const label = isToday ? '今天' : i === 1 ? '明天' : dayNames[d.getDay()]

    const classes = [
      'quick-date-btn',
      isToday ? 'today' : '',
      isSelected ? 'selected' : ''
    ].filter(Boolean).join(' ')

    html += `<button type="button" class="${classes}" data-date="${dateStr}" aria-pressed="${isSelected}" aria-label="${label} ${dateStr}">
      <span class="quick-day-name">${label}</span>
      <span class="quick-day-num">${dayNum}</span>
      <span class="quick-date-load${overloaded ? ' overloaded' : ''}">${dayLoadMinutes > 0 ? loadHours + 'h' : '\u00b7'}</span>
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
    hardDeadline: '',
    focusDate: '',
    duration: 60,
    repeatType: 'none' as const,
    repeatDays: [],
    repeatInterval: 1,
    noTimeLimit: false,
    completed: false,
    isParent: false
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
          ${!isEditing ? `<div class="task-mode-switch" role="group" aria-label="任务类型"><button type="button" class="task-mode-btn active" data-task-mode="normal">普通任务</button><button type="button" class="task-mode-btn" data-task-mode="parent">大任务</button></div>` : ''}
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1">任务名称 *</label>
              <input type="text" name="title" value="${escapeHtml(task.title)}" required class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
            </div>
            <div id="taskCompletedField" class="pt-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="taskCompleted" ${task.completed ? 'checked' : ''} class="rounded">
                <span class="text-sm">已完成</span>
              </label>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">备注</label>
            <textarea name="description" rows="2" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white resize-none">${escapeHtml(task.description)}</textarea>
          </div>
          ${!isEditing ? `<section id="parentChildrenFields" class="hidden border-t dark:border-gray-700 pt-4 space-y-3"><p class="text-sm text-gray-500">父任务不设置日期和时长；子任务将按各自计划进入日程。</p><label class="block text-sm font-medium">硬截止日期（可选）<input type="date" name="parentHardDeadline" class="mt-1 w-full px-3 py-2 border rounded-lg"></label><div id="newParentChildren" class="split-children-list">${renderSplitChildRow(0, undefined, formatDate(new Date()))}${renderSplitChildRow(1, undefined, formatDate(new Date()))}</div><button type="button" id="addParentChildBtn" class="text-sm text-blue-600">+ 添加子任务</button><p id="parentTaskError" class="text-sm text-red-500" aria-live="polite"></p></section>` : ''}
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
          ${task.isParent ? `
          <div class="border-t dark:border-gray-700 pt-4 space-y-4">
            <div class="rounded-lg bg-violet-50 dark:bg-violet-900/20 p-3 text-sm text-violet-700 dark:text-violet-300">这是父任务，可独立标记完成状态；下方进度条仅反映子任务进度。计划日期和预计时长由子任务分别管理。</div>
            <div>
              <label class="block text-sm font-medium mb-1">硬截止日期（可选）</label>
              <input type="date" name="hardDeadline" value="${task.hardDeadline || ''}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
            </div>
          </div>
          ` : `
          <div id="normalTaskFields" class="border-t dark:border-gray-700 pt-4">
            <label class="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" id="noTimeLimit" name="noTimeLimit" ${task.noTimeLimit ? 'checked' : ''} class="rounded"> 
              <span class="text-sm font-medium">无计划日期（任务池）</span>
            </label>
            <div id="dueDateField" style="${task.noTimeLimit ? 'opacity:0.5;pointer-events:none' : ''}">
              <div>
                <label class="block text-sm font-medium mb-1">计划日期</label>
                ${renderQuickDates(task.dueDate, isEditing ? (task as Task).id : undefined)}
                <input type="date" name="dueDate" value="${task.dueDate}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
              </div>
            </div>
            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">硬截止日期（可选）</label>
              <input type="date" name="hardDeadline" value="${task.hardDeadline || ''}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white">
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
          `}
          <div class="flex gap-3 pt-4">
            ${isEditing ? `<button type="button" id="deleteTaskBtn" class="px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">删除</button>` : ''}
            <div class="flex-1"></div>
            <button type="button" id="cancelBtn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">取消</button>
            <button type="submit" id="taskSubmitBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">${isEditing ? '保存' : '添加'}</button>
          </div>
        </form>
      </div>
    </div>
  `
}

export const renderSplitChildRow = (index: number, child?: { title: string; duration: number; dueDate: string; id?: string }, dueDate?: string): string => `
  <div class="split-child-row grid gap-2 p-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30"${child?.id ? ` data-child-id="${child.id}"` : ''}>
    <input type="text" class="split-child-title px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" value="${child ? escapeHtml(child.title) : ''}" placeholder="子任务 ${index + 1}" required aria-label="子任务标题">
    <button type="button" class="remove-split-child p-2 text-gray-400 hover:text-red-500 rounded" title="删除此子任务" aria-label="删除此子任务">×</button>
    <div class="split-child-schedule">
      <div class="split-child-field split-child-duration-field">
        <span class="split-child-field-label">预计时间</span>
        <div class="split-child-duration-control">
          <button type="button" class="split-duration-decrease px-2 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm leading-none" aria-label="减少 0.5 小时">−</button>
          <input type="number" class="split-child-duration w-14 text-center px-1 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" value="${child ? (child.duration / 60).toFixed(2).replace(/\.?0+$/, '') : '1'}" min="0.5" step="0.5" aria-label="预计小时">
          <button type="button" class="split-duration-increase px-2 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm leading-none" aria-label="增加 0.5 小时">+</button>
        </div>
      </div>
      <div class="split-quick-dates">${renderQuickDates(dueDate ?? '')}</div>
      <div class="split-child-field split-child-date-field">
        <label class="split-child-field-label">自定义日期</label>
        <input type="date" class="split-child-date w-full px-2 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" value="${dueDate ?? ''}" required aria-label="计划日期">
      </div>
    </div>
  </div>
`

export const renderReplanModal = (): string => {
  const { replanningTaskId, tasks } = getState()
  const task = tasks.find(item => item.id === replanningTaskId)
  const today = formatDate(new Date())
  const isPopup = window.location.pathname.includes('popup')
  if (isPopup) {
    return `
      <div id="replanModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${task ? '' : 'hidden'}" tabindex="-1">
        <div class="popup-replan-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[92%] max-w-sm p-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">安排时间</h2>
            <button type="button" id="closeReplanBtn" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" aria-label="关闭安排时间">×</button>
          </div>
          <p class="mt-1 text-sm text-gray-500 truncate">${task ? escapeHtml(task.title) : ''}</p>
          <form id="replanForm" class="mt-4 space-y-3" novalidate>
            <div>
              <label class="block text-sm font-medium mb-2">选择计划日期</label>
              <div class="popup-replan-quick-dates">${renderQuickDates('')}</div>
              <div class="mt-3">
                <label class="block text-xs text-gray-500 mb-1" for="replanDate">7 天以外的日期</label>
                <input type="date" id="replanDate" name="replanDate" value="" min="${today}" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
              </div>
              ${task?.hardDeadline ? `<p class="mt-2 text-xs text-red-500">硬截止仍为 ${task.hardDeadline}，不会被修改。</p>` : ''}
              <p id="replanError" class="mt-2 text-xs text-red-500" role="alert" aria-live="polite"></p>
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" id="cancelReplanBtn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">取消</button>
              <button type="submit" id="confirmReplanBtn" disabled class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">确认安排</button>
            </div>
          </form>
        </div>
      </div>
    `
  }
  return `
    <div id="replanModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${task ? '' : 'hidden'}">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[90%] max-w-md p-5">
        <h2 class="text-lg font-semibold">重新安排计划日期</h2>
        <p class="mt-1 text-sm text-gray-500 truncate">${task ? escapeHtml(task.title) : ''}</p>
        <form id="replanForm" class="mt-5 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">新的计划日期</label>
            <input type="date" name="replanDate" value="${today}" min="${today}" required class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
            ${task?.hardDeadline ? `<p class="mt-1 text-xs text-red-500">硬截止仍为 ${task.hardDeadline}，不会被修改。</p>` : ''}
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" id="cancelReplanBtn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">取消</button>
            <button type="submit" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg">保存排期</button>
          </div>
        </form>
      </div>
    </div>
  `
}

export const renderSplitModal = (): string => {
  const { splittingTaskId, tasks } = getState()
  const task = tasks.find(item => item.id === splittingTaskId)
  const today = formatDate(new Date())
  const existingChildren = task?.isParent
    ? tasks.filter(child => child.parentId === task.id)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(child => ({ id: child.id, title: child.title, duration: child.duration, dueDate: child.dueDate }))
    : []
  const rowsToRender: Array<{ id?: string; title: string; duration: number; dueDate: string } | undefined> =
    task?.isParent && existingChildren.length >= 2 ? existingChildren : [undefined, undefined]
  return `
    <div id="splitTaskModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6 ${task ? '' : 'hidden'}" role="dialog" aria-modal="true" aria-labelledby="splitTaskTitle" tabindex="-1">
      <div class="split-task-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl" style="max-height:calc(100svh - 32px)">
        <div class="split-task-header border-b dark:border-gray-700">
          <div class="min-w-0">
            <h2 id="splitTaskTitle" class="text-lg font-semibold">${task?.isParent ? '继续编辑子任务' : '把任务拆成可执行步骤'}</h2>
            <p class="mt-1 text-sm text-gray-500 truncate">${task ? escapeHtml(task.title) : ''}</p>
          </div>
          <button type="button" id="closeSplitTaskBtn" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition flex-shrink-0" title="关闭拆分弹窗" aria-label="关闭拆分弹窗">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="splitTaskForm" class="split-task-form space-y-4" novalidate>
          <div id="splitChildren" class="split-children space-y-2" style="max-height:min(48svh,460px)">
            ${rowsToRender.map((child, index) => renderSplitChildRow(index, child, child ? child.dueDate : today)).join('')}
          </div>
          <button type="button" id="addSplitChildBtn" class="split-add-button text-sm text-blue-600 hover:underline">+ 添加一个步骤</button>
          <p id="splitTaskError" class="hidden text-sm text-red-500"></p>
          <div class="split-task-footer">
            <button type="button" id="cancelSplitTaskBtn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">取消</button>
            <button type="submit" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg">完成拆分</button>
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
      .goal-card-empty-copy { margin: 0 0 12px; font-size: 13px; color: #64748b; }
      .dark .goal-card-empty-copy { color: #94a3b8; }

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
      .goal-card-start { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #64748b; margin-bottom: 12px; }
      .goal-card-start strong { color: #475569; font-weight: 600; }
      .goal-card-start span:last-child { color: #94a3b8; }
      .dark .goal-card-start strong { color: #cbd5e1; }
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

      .goal-settings-overlay {
        padding: 16px;
        background: rgba(15,23,42,0.48);
      }
      .goal-settings-panel {
        width: min(100%, 440px);
        max-height: min(680px, calc(100svh - 32px));
        overflow-y: auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 20px 50px rgba(15,23,42,0.22);
      }
      .dark .goal-settings-panel {
        background: #1f2937;
        border-color: #374151;
      }
      .goal-settings-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 22px 18px;
        border-bottom: 1px solid #e2e8f0;
      }
      .dark .goal-settings-header { border-color: #374151; }
      .goal-settings-heading { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
      .goal-settings-icon {
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 8px;
        color: #2563eb;
        background: #eff6ff;
      }
      .dark .goal-settings-icon { color: #93c5fd; background: rgba(37,99,235,0.16); }
      .goal-settings-icon svg { width: 19px; height: 19px; }
      .goal-settings-heading h3 {
        margin: 0;
        color: #0f172a;
        font-size: 16px;
        line-height: 1.4;
        font-weight: 650;
      }
      .dark .goal-settings-heading h3 { color: #f8fafc; }
      .goal-settings-heading p {
        margin: 3px 0 0;
        color: #64748b;
        font-size: 12px;
        line-height: 1.5;
      }
      .dark .goal-settings-heading p { color: #94a3b8; }
      .goal-settings-close {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #64748b;
        cursor: pointer;
      }
      .goal-settings-close:hover { background: #f1f5f9; color: #0f172a; }
      .dark .goal-settings-close:hover { background: #374151; color: #f8fafc; }
      .goal-settings-close svg { width: 18px; height: 18px; }
      .goal-settings-body { display: grid; gap: 20px; padding: 20px 22px; }
      .goal-settings-field label {
        display: block;
        color: #1e293b;
        font-size: 13px;
        line-height: 1.4;
        font-weight: 600;
      }
      .dark .goal-settings-field label { color: #e2e8f0; }
      .goal-settings-field > p {
        margin: 3px 0 9px;
        color: #64748b;
        font-size: 12px;
        line-height: 1.5;
      }
      .dark .goal-settings-field > p { color: #94a3b8; }
      .goal-settings-field input {
        width: 100%;
        height: 42px;
        padding: 0 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #ffffff;
        color: #0f172a;
        font: inherit;
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .goal-settings-field input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.14);
      }
      .dark .goal-settings-field input {
        background: #111827;
        border-color: #4b5563;
        color: #f8fafc;
      }
      .goal-settings-input-unit { position: relative; }
      .goal-settings-input-unit input { padding-right: 92px; }
      .goal-settings-input-unit > span {
        position: absolute;
        top: 50%;
        right: 12px;
        transform: translateY(-50%);
        color: #64748b;
        font-size: 12px;
        pointer-events: none;
      }
      .goal-settings-field-hint {
        display: block;
        margin-top: 6px;
        color: #94a3b8;
        font-size: 11px;
        line-height: 1.4;
      }
      .goal-settings-note {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border-left: 3px solid #3b82f6;
        background: #f8fafc;
        color: #475569;
        font-size: 12px;
        line-height: 1.5;
      }
      .dark .goal-settings-note { background: #111827; color: #cbd5e1; }
      .goal-settings-note svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; color: #2563eb; }
      .goal-settings-error {
        margin: -8px 0 0;
        color: #dc2626;
        font-size: 12px;
        line-height: 1.4;
      }
      .goal-settings-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 22px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
      }
      .dark .goal-settings-footer { border-color: #374151; background: #111827; }
      .goal-settings-footer button {
        min-width: 92px;
        height: 38px;
        padding: 0 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .goal-settings-secondary {
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #334155;
      }
      .goal-settings-secondary:hover { background: #f1f5f9; }
      .dark .goal-settings-secondary { border-color: #4b5563; background: #1f2937; color: #e2e8f0; }
      .goal-settings-primary { border: 1px solid #2563eb; background: #2563eb; color: #ffffff; }
      .goal-settings-primary:hover { border-color: #1d4ed8; background: #1d4ed8; }
      .goal-settings-primary:disabled { cursor: wait; opacity: 0.65; }

      .focus-view {
        display: grid;
        gap: 18px;
      }
      .focus-panel {
        overflow: hidden;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #ffffff;
      }
      .dark .focus-panel {
        border-color: #374151;
        background: #1f2937;
      }
      .focus-panel-header {
        display: flex;
        min-height: 72px;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 16px 20px;
      }
      .focus-panel-copy { min-width: 0; }
      .focus-panel-copy h3 {
        margin: 0;
        color: #111827;
        font-size: 16px;
        line-height: 1.45;
        font-weight: 650;
      }
      .dark .focus-panel-copy h3 { color: #f3f4f6; }
      .focus-panel-copy p {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 13px;
        line-height: 1.5;
      }
      .dark .focus-panel-copy p { color: #94a3b8; }
      .focus-panel-count {
        display: inline-flex;
        min-height: 28px;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        padding: 0 10px;
        border-radius: 999px;
        background: #f1f5f9;
        color: #64748b;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      .dark .focus-panel-count { background: #374151; color: #cbd5e1; }
      .focus-panel-list,
      .focus-panel-empty { border-top: 1px solid #e2e8f0; }
      .dark .focus-panel-list,
      .dark .focus-panel-empty { border-color: #374151; }
      .focus-panel-list .task-row + .task-row { border-top: 1px solid #f1f5f9; }
      .dark .focus-panel-list .task-row + .task-row { border-color: #374151; }
      .focus-panel-empty {
        padding: 36px 20px 38px;
        color: #94a3b8;
        text-align: center;
      }
      .focus-panel-empty p { margin: 0; font-size: 14px; line-height: 1.5; }
      .focus-panel-empty p + p { margin-top: 5px; font-size: 13px; }

      .overdue-panel {
        overflow: hidden;
        border: 1px solid #fecaca;
        border-radius: 12px;
        background: #ffffff;
      }
      .dark .overdue-panel {
        border-color: rgba(127,29,29,0.58);
        background: #1f2937;
      }
      .overdue-panel-embedded {
        border-width: 0 0 1px;
        border-radius: 0;
      }
      .overdue-panel-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: #ffffff;
      }
      .dark .overdue-panel-header { background: #1f2937; }
      .overdue-panel-header h3 {
        margin: 0;
        color: #991b1b;
        font-size: 14px;
        line-height: 1.45;
        font-weight: 650;
      }
      .dark .overdue-panel-header h3 { color: #fca5a5; }
      .overdue-panel-header p {
        margin: 2px 0 0;
        color: #64748b;
        font-size: 12px;
        line-height: 1.5;
      }
      .dark .overdue-panel-header p { color: #94a3b8; }
      .overdue-panel-toggle {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 7px;
        min-height: 30px;
        padding: 0 8px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: #991b1b;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      .overdue-panel-toggle:hover { background: #fef2f2; }
      .dark .overdue-panel-toggle { color: #fca5a5; }
      .dark .overdue-panel-toggle:hover { background: rgba(127,29,29,0.2); }
      .overdue-panel-list { border-top: 1px solid #fee2e2; }
      .dark .overdue-panel-list { border-color: rgba(127,29,29,0.44); }
      .overdue-item {
        display: grid;
        grid-template-columns: 4px minmax(0, 1fr);
        gap: 12px;
        padding: 14px 18px;
        background: rgba(254,242,242,0.62);
      }
      .dark .overdue-item { background: rgba(127,29,29,0.1); }
      .overdue-item + .overdue-item { border-top: 1px solid #fee2e2; }
      .dark .overdue-item + .overdue-item { border-color: rgba(127,29,29,0.38); }
      .overdue-item-priority {
        width: 4px;
        min-height: 44px;
        border-radius: 999px;
      }
      .overdue-item-content { min-width: 0; }
      .overdue-item-copy { min-width: 0; }
      .overdue-item-title {
        overflow-wrap: anywhere;
        color: #1f2937;
        font-size: 14px;
        line-height: 1.5;
        font-weight: 400;
      }
      .dark .overdue-item-title { color: #f3f4f6; }
      .overdue-item-meta {
        margin-top: 3px;
        color: #b91c1c;
        font-size: 12px;
        line-height: 1.5;
      }
      .dark .overdue-item-meta { color: #f87171; }
      .overdue-item-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 11px;
      }
      .overdue-item-action {
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid #dbe2ea;
        border-radius: 8px;
        background: #ffffff;
        color: #475569;
        font-size: 12px;
        line-height: 1;
        font-weight: 500;
        white-space: nowrap;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .overdue-item-action:hover { border-color: #cbd5e1; background: #f8fafc; }
      .dark .overdue-item-action { border-color: #4b5563; background: #374151; color: #e5e7eb; }
      .dark .overdue-item-action:hover { border-color: #6b7280; background: #4b5563; }
      .overdue-item-actions .overdue-focus,
      .overdue-item-actions .week-plan-toggle {
        border-color: #3b82f6;
        background: #3b82f6;
        color: #ffffff;
        font-weight: 600;
      }
      .overdue-item-actions .overdue-focus:hover,
      .overdue-item-actions .week-plan-toggle:hover { border-color: #2563eb; background: #2563eb; }
      .overdue-item-actions .overdue-complete {
        border-color: #86efac;
        color: #15803d;
        font-weight: 600;
      }
      .overdue-item-actions .overdue-complete:hover { border-color: #4ade80; background: #f0fdf4; }
      .dark .overdue-item-actions .overdue-complete { border-color: #166534; color: #86efac; }
      .dark .overdue-item-actions .overdue-complete:hover { background: rgba(20,83,45,0.3); }
      .overdue-item-actions .overdue-edit { border-color: #bfdbfe; color: #2563eb; }
      .overdue-item-actions .overdue-edit:hover { border-color: #93c5fd; background: #eff6ff; }
      .dark .overdue-item-actions .overdue-edit { border-color: #1e3a8a; color: #93c5fd; }
      .dark .overdue-item-actions .overdue-edit:hover { background: rgba(30,58,138,0.28); }
      .week-day-picker {
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
        padding: 10px;
        border-radius: 8px;
        background: rgba(255,255,255,0.78);
      }
      .week-day-picker:not(.hidden) { display: flex; }
      .week-day-picker.hidden { display: none; }
      .dark .week-day-picker { background: rgba(17,24,39,0.5); }
      .week-plan-date {
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid #dbe2ea;
        border-radius: 7px;
        background: #ffffff;
        color: #475569;
        font-size: 12px;
      }
      .week-plan-date:hover { border-color: #60a5fa; color: #2563eb; }
      .dark .week-plan-date { border-color: #4b5563; background: #374151; color: #e5e7eb; }

      @media (max-width: 520px) {
        .focus-view { gap: 14px; }
        .focus-panel-header { min-height: 66px; padding: 14px 16px; }
        .focus-panel-copy h3 { font-size: 15px; }
        .focus-panel-copy p { font-size: 12px; }
        .focus-panel-empty { padding: 30px 16px 32px; }
        .overdue-panel-header { padding: 12px 14px; }
        .overdue-item { gap: 10px; padding: 13px 14px; }
        .overdue-item-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .overdue-item-action { width: 100%; padding: 0 8px; }
      }

      .pool-task-actions {
        gap: 8px;
        margin-left: 12px;
      }

      .app-header-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        min-width: 0;
        max-width: 100%;
        margin-left: auto;
      }
      .header-utility-actions {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
      }

      .split-task-panel {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .split-task-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        flex-shrink: 0;
        gap: 16px;
        padding: 20px;
      }
      .split-task-form {
        display: flex;
        min-height: 0;
        flex-direction: column;
        overflow: hidden;
        padding: 20px;
      }
      .split-children {
        min-height: 100px;
        flex: 1 1 0%;
        overflow-y: auto;
        padding-right: 4px;
      }
      .split-add-button {
        align-self: flex-start;
        flex-shrink: 0;
      }
      .split-task-footer {
        display: flex;
        width: 100%;
        flex-shrink: 0;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 4px;
      }
      .split-child-row {
        grid-template-columns: minmax(0, 1fr) 32px;
        align-items: start;
      }
      .split-child-title {
        min-width: 0;
        grid-column: 1;
      }
      .remove-split-child {
        grid-column: 2;
        grid-row: 1;
      }
      .split-child-schedule {
        display: grid;
        min-width: 0;
        grid-column: 1 / -1;
        grid-template-columns: 132px minmax(0, 1fr) 126px;
        align-items: end;
        gap: 8px;
      }
      .split-child-field {
        min-width: 0;
      }
      .split-child-duration-control {
        display: grid;
        width: 132px;
        grid-template-columns: 34px 56px 34px;
        align-items: center;
        gap: 4px;
      }
      .split-child-duration-control .split-duration-decrease,
      .split-child-duration-control .split-duration-increase {
        width: 34px;
        height: 38px;
        padding: 0;
      }
      .split-child-duration-control .split-child-duration {
        width: 56px;
        min-width: 0;
      }
      .split-child-field-label {
        display: block;
        margin-bottom: 4px;
        color: #6b7280;
        font-size: 10px;
        line-height: 1.2;
        font-weight: 500;
      }
      .split-child-date-field,
      .split-quick-dates { min-width: 0; }
      .dark .split-child-field-label { color: #9ca3af; }

      @media (max-width: 520px) {
        .task-row { flex-wrap: wrap; align-items: flex-start; }
        .task-row .task-main { flex: 1 1 calc(100% - 52px); }
        .task-row .task-actions {
          width: 100%;
          justify-content: flex-end;
          padding-left: 40px;
          margin-top: -2px;
        }
        .split-child-schedule { grid-template-columns: 124px minmax(0, 1fr); gap: 7px 8px; }
        .split-child-duration-control {
          width: 124px;
          grid-template-columns: 32px 52px 32px;
        }
        .split-child-duration-control .split-duration-decrease,
        .split-child-duration-control .split-duration-increase { width: 32px; }
        .split-child-duration-control .split-child-duration { width: 52px; }
        .split-child-duration-field { grid-column: 1; grid-row: 1; }
        .split-child-date-field { grid-column: 2; grid-row: 1; }
        .split-quick-dates { grid-column: 1 / -1; grid-row: 2; }
      }

      @media (max-width: 900px) {
        .pool-task-row {
          flex-wrap: wrap;
          align-items: flex-start;
        }
        .pool-task-row .task-main {
          flex: 1 1 calc(100% - 52px);
        }
        .pool-task-row .pool-task-actions {
          width: 100%;
          justify-content: flex-start;
          gap: 8px;
          margin: 8px 0 0;
          padding-left: 52px;
        }
      }

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

            .quick-date-btn .quick-date-load {
        font-size: 8px;
        color: #6b7280;
        line-height: 1;
      }
      .dark .quick-date-btn .quick-date-load { color: #9ca3af; }
      .quick-date-btn .quick-date-load.overloaded { color: #dc2626; font-weight: 600; }
      .dark .quick-date-btn .quick-date-load.overloaded { color: #f87171; }

      .split-quick-dates .quick-dates-row { gap: 2px; margin-bottom: 0; }
      .split-quick-dates .quick-date-btn { padding: 3px 1px; border-radius: 6px; }
      .split-quick-dates .quick-day-name { font-size: 8px; }
      .split-quick-dates .quick-day-num { font-size: 11px; }
      .split-quick-dates .quick-date-load { font-size: 7px; }
      .split-quick-dates .quick-date-badge { display: none; }

/* 今天仅作为日期提示；选中高亮只由 selected 表示 */
      .quick-date-btn.today:not(.selected) .quick-day-name { color: #6366f1; }
      .dark .quick-date-btn.today:not(.selected) .quick-day-name { color: #a5b4fc; }
      .quick-date-btn.today:not(.selected) .quick-date-badge {
        background: #eef2ff;
        color: #6366f1;
      }
      .dark .quick-date-btn.today:not(.selected) .quick-date-badge {
        background: rgba(129,140,248,0.16);
        color: #a5b4fc;
      }

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
      .quick-date-btn.selected .quick-date-load { color: white; }
      .quick-date-btn.selected .quick-date-load.overloaded { color: #fecaca; font-weight: 700; }


      @media (max-width: 560px) {
        .week-day-row { grid-template-columns: minmax(0, 1fr) !important; }
        .week-day-label {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          border-right: 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .dark .week-day-label { border-bottom-color: #374151; }
        .week-day-label > div:last-child { margin-top: 0; text-align: right; }
        .week-task-item { max-width: 100% !important; }
      }

      .view-nav { scrollbar-width: thin; }
      .popup-app-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 8px;
        row-gap: 8px;
      }
      .popup-app-header .header-brand { grid-column: 1; grid-row: 1; }
      .popup-app-header .app-header-actions { display: contents; }
      .popup-app-header .header-utility-actions {
        grid-column: 2;
        grid-row: 1;
        width: auto;
        flex-wrap: nowrap;
        gap: 4px;
      }
      .popup-app-header .view-nav {
        grid-column: 1 / -1;
        grid-row: 2;
        width: 100%;
      }
      .task-more-menu { position: relative; }
      .task-more-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        color: #6b7280;
        cursor: pointer;
        list-style: none;
      }
      .task-more-trigger::-webkit-details-marker { display: none; }
      .task-more-trigger:hover { background: #f3f4f6; }
      .dark .task-more-trigger:hover { background: #374151; }
      .task-more-popover {
        position: fixed;
        z-index: 50;
        top: 0;
        left: 0;
        width: min(160px, calc(100vw - 16px));
        max-height: calc(100vh - 16px);
        overflow-y: auto;
        padding: 4px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: white;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
        visibility: hidden;
      }
      .dark .task-more-popover { border-color: #4b5563; background: #1f2937; }
      .task-more-popover button {
        display: block;
        width: 100%;
        padding: 7px 9px;
        border-radius: 6px;
        text-align: left;
        font-size: 12px;
      }
      .task-more-popover button:hover { background: #f3f4f6; }
      .dark .task-more-popover button:hover { background: #374151; }
      .task-more-popover .task-more-danger { color: #ef4444; }
      .popup-replan-panel { max-height: calc(100vh - 24px); overflow-y: auto; }
      .popup-replan-quick-dates .quick-dates-row { gap: 3px; margin-bottom: 0; }
      .popup-replan-quick-dates .quick-date-btn { min-width: 0; padding: 6px 1px; }
      .popup-replan-quick-dates .quick-day-name { font-size: 9px; }
      .popup-replan-quick-dates .quick-day-num { font-size: 14px; }
      .popup-replan-quick-dates .quick-date-load { font-size: 8px; }
      @media (max-width: 767px) {
        .app-header-actions { width: 100%; }
        .view-nav { align-self: stretch; }
        .popup-app-header .app-header-actions { width: auto; }
      }
    `
    document.head.appendChild(style)
  }

  const viewMaxWidth: Record<string, string> = {
    focus: 'max-w-4xl',
    pool: 'max-w-4xl',
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
      ${getState().currentView === 'list' ? '<button id="jumpToTodayBtn" class="jump-to-today hidden" aria-label="定位到今天" title="定位到今天">今</button>' : ''}
      ${renderModal()}
      ${renderReplanModal()}
      ${renderSplitModal()}
      ${renderCategoryModal()}
      ${renderGoalSettingsModal()}
      ${renderSyncModal()}
      ${renderMobileSyncPanel()}
    </div>
  `
}
