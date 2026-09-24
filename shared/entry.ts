// shared/entry.ts - Main entry point with auto-init
// esbuild will bundle these imports into a single IIFE

import { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, getWeeklyGoalStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml } from './task'
import { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderPoolView, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal, renderGoalSettingsModal, renderSyncModal, renderMobileSyncPanel, renderWeeklyGoalCard, renderSyncIndicator } from './render'
import { attachEventListeners } from './events'
import { onSyncStatusChange, shouldRefreshAppForSyncStatus } from './sync'

// Export for external use
export { loadState, persistState, getState, setState, resetEditingTask, getFilteredTasks, getStats, getWeeklyGoalStats, addTask, updateTask, deleteTask, toggleTask, moveTaskToDate, addCategory, deleteCategory, formatDate, parseDate, formatHours, getDateLabel, getRemainingTime, isOverdue, isTaskDueOnDate, getPriorityColor, getCatColor, getCatName, escapeHtml }
export { renderApp, renderStats, renderHeader, renderFilters, renderTaskItem, renderPoolView, renderListView, renderDayView, renderWeekView, renderMonthView, renderTaskList, renderModal, renderCategoryModal, renderGoalSettingsModal, renderSyncModal, renderMobileSyncPanel, renderWeeklyGoalCard }
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.tm_google_account_session) return
    const oldSub = (changes.tm_google_account_session.oldValue as { user?: { sub?: string } } | undefined)?.user?.sub || null
    const newSub = (changes.tm_google_account_session.newValue as { user?: { sub?: string } } | undefined)?.user?.sub || null
    if (oldSub === newSub) return
    // Other extension pages may remain open during an account switch. Reload
    // their state from local storage before they can save under the new account.
    loadState().then(reRender).catch(error => console.warn('[TaskMaster] account state refresh failed:', error))
  })

  loadState().then(() => {
    if (window.location.pathname.includes('popup')) {
      setState({ currentView: 'focus' })
    }
    renderApp(container)
    attachEventListeners(container)

    onSyncStatusChange((status) => {
      const indicatorSlot = container.querySelector('#syncIndicatorSlot')
      if (indicatorSlot) {
        indicatorSlot.innerHTML = renderSyncIndicator()
      }

      const taskModal = container.querySelector('#taskModal')
      const isTaskModalOpen = !!taskModal && !taskModal.classList.contains('hidden')
      if (shouldRefreshAppForSyncStatus(status, isTaskModalOpen)) {
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
