// Sync monitoring module
import { loadState, persistState, getState } from './task'
import { STORAGE_KEY } from './storage'

export type SyncStatus = 'idle' | 'saving' | 'synced' | 'remote-updated' | 'error'

let syncStatus: SyncStatus = 'idle'
let statusChangeCallback: ((status: SyncStatus) => void) | null = null
let localSaveTime = 0 // timestamp of last local save start
let statusTimeoutId: ReturnType<typeof setTimeout> | null = null
let reRenderFn: (() => void) | null = null

export const getSyncStatus = (): SyncStatus => syncStatus

const setSyncStatus = (status: SyncStatus) => {
  syncStatus = status
  statusChangeCallback?.(status)
}

/** Register a callback to be called when sync status changes */
export const onSyncStatusChange = (cb: (status: SyncStatus) => void) => {
  statusChangeCallback = cb
}

/** Call before chrome.storage.sync.set to mark this as a local write */
export const markLocalSave = () => {
  localSaveTime = Date.now()
}

/** Call after chrome.storage.sync.set completes */
export const markSaveComplete = () => {
  setSyncStatus('synced')
  // Auto-transition to idle after 3 seconds
  if (statusTimeoutId) clearTimeout(statusTimeoutId)
  statusTimeoutId = setTimeout(() => {
    if (syncStatus === 'synced') {
      setSyncStatus('idle')
      reRenderFn?.()
    }
  }, 3000)
}

/** Initialize the chrome.storage.onChanged listener */
export const initSyncMonitor = (reRender: () => void) => {
  reRenderFn = reRender

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return
    if (!changes[STORAGE_KEY]) return

    const now = Date.now()
    // If we recently started a local save (within 2 seconds), ignore this change
    if (localSaveTime > 0 && now - localSaveTime < 2000) {
      return
    }

    const change = changes[STORAGE_KEY]
    const isEmpty = !change || change.newValue === undefined || change.newValue === null || change.newValue === ''
    console.warn('[TaskManager] sync onChanged:', { isEmpty, hasNewValue: !!change?.newValue })

    // Protection: if newValue is undefined/empty, this is likely an uninstall cleanup
    // from another device. Immediately re-save our data to sync to restore it.
    if (isEmpty) {
      const current = getState()
      if (current.tasks.length > 0 || current.categories.length > 0) {
        console.warn('[TaskManager] 检测到sync被清空，从内存回写数据')
        // We have data in memory, write it back to sync to undo the clearing
        markLocalSave()
        persistState().catch(() => {})
      }
      return
    }

    // This is a remote change from another device/tab
    setSyncStatus('remote-updated')
    loadState().then(() => {
      reRender()
      // Show toast notification
      showSyncToast()
      // Auto-transition to idle after 4 seconds
      if (statusTimeoutId) clearTimeout(statusTimeoutId)
      statusTimeoutId = setTimeout(() => {
        if (syncStatus === 'remote-updated') {
          setSyncStatus('idle')
          reRender()
        }
      }, 4000)
    }).catch(() => {
      setSyncStatus('error')
    })
  })
}

/** Show a brief toast notification for remote sync updates */
function showSyncToast() {
  const existing = document.querySelector('.sync-toast')
  existing?.remove()

  const toast = document.createElement('div')
  toast.className = 'sync-toast fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm z-50 bg-blue-500 transition-opacity duration-500'
  toast.innerHTML = `
    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    已同步来自其他设备的更新
  `
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 500)
  }, 3000)
}