// shared/entry.ts - Main entry point with auto-init
// esbuild will bundle these imports into a single IIFE

import { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml } from './task'
import { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal, renderSyncModal } from './render'
import { attachEventListeners } from './events'
import { initSyncMonitor, onSyncStatusChange } from './sync'

// Export for external use
export { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml }
export { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal, renderSyncModal }
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

  loadState().then(() => {
    const state = getState()
    // 只在有真实数据时才 persist，防止空默认值覆盖 storage 中的真实数据
    if (state.tasks.length > 0) {
      persistState().catch(() => {})
    } else {
      console.warn('[TaskMaster] loadState 返回空数据，跳过 persist（防止覆盖）')
    }

    renderApp(container)
    attachEventListeners(container)
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