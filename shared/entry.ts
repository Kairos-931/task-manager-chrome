// shared/entry.ts - Main entry point with auto-init
// esbuild will bundle these imports into a single IIFE

import { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml } from './task'
import { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal } from './render'
import { attachEventListeners } from './events'
import { initSyncMonitor, onSyncStatusChange } from './sync'

// Export for external use
export { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml }
export { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal }
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
    // 加载完成后立即持久化，确保 chrome.storage.local 有备份
    await persistState()

    renderApp(container)
    attachEventListeners(container)
    // Initialize sync monitoring
    initSyncMonitor(reRender)
    // Re-render when sync status changes (to update indicator icon)
    onSyncStatusChange(() => {
      // Only update the indicator element, not the whole page
      const indicator = container.querySelector('#syncIndicator')
      if (indicator) {
        // Full re-render to update the indicator
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
