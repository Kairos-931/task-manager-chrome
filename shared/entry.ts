// shared/entry.ts - Main entry point with auto-init
// esbuild will bundle these imports into a single IIFE

import { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, getWeeklyGoalStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml } from './task'
import { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal, renderGoalSettingsModal, renderSyncModal, renderMobileSyncPanel, renderWeeklyGoalCard } from './render'
import { attachEventListeners } from './events'
import { initSyncMonitor, onSyncStatusChange } from './sync'

// 同步操作反馈 toast（独立定义避免循环依赖）
function syncActionToast(message: string, type: 'success' | 'error' = 'success') {
  document.querySelectorAll('.sync-action-toast').forEach(el => el.remove())
  const toast = document.createElement('div')
  toast.className = 'sync-action-toast'
  const bgColor = type === 'success' ? '#22c55e' : '#ef4444'
  toast.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);padding:0.75rem 1.5rem;border-radius:0.75rem;box-shadow:0 10px 25px rgba(0,0,0,0.15);color:#fff;font-size:0.875rem;font-weight:500;z-index:10000;background:${bgColor};transition:opacity 0.3s;white-space:nowrap;`
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// Export for external use
export { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, getWeeklyGoalStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml }
export { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal, renderGoalSettingsModal, renderSyncModal, renderMobileSyncPanel, renderWeeklyGoalCard }
export { attachEventListeners }

// Auto-initialize when DOM is ready
function autoInit() {
  const container = document.getElementById('app')
  if (!container) {
    console.error('Container #app not found')
    return
  }

  const reRender = () => {
    renderApp(container)
    attachEventListeners(container)
  }

  loadState().then(async () => {
    const { tasks } = getState()
    if (tasks.length > 0) {
      await persistState()
      console.log(`[TaskMaster] 已加载 ${tasks.length} 个任务`)
    }

    renderApp(container)
    attachEventListeners(container)
    // Auto-sync mobile tasks with toast feedback
    chrome.runtime.sendMessage({ action: 'syncRemoteTasks' }, (result: { synced?: number }) => {
      if ((result?.synced ?? 0) > 0) {
        syncActionToast(`已从手机同步 ${result.synced} 个任务`, 'success')
      }
    })
    initSyncMonitor(reRender)
    onSyncStatusChange(() => {
      const indicator = container.querySelector('#syncIndicator')
      if (indicator) {
        reRender()
      }
    })
  }).catch(err => {
    console.error('Failed to initialize app:', err)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit)
} else {
  autoInit()
}
