import { loadState, persistState, getState } from './task'
import { mergeRemoteData } from './storage'

export type SyncStatus = 'idle' | 'saving' | 'synced' | 'remote-updated' | 'error'

let syncStatus: SyncStatus = 'idle'
let statusChangeCallback: ((status: SyncStatus) => void) | null = null
let localSaveTime = 0
let statusTimeoutId: ReturnType<typeof setTimeout> | null = null
let reRenderFn: (() => void) | null = null

export const getSyncStatus = (): SyncStatus => syncStatus

const setSyncStatus = (status: SyncStatus) => {
  syncStatus = status
  statusChangeCallback?.(status)
}

export const onSyncStatusChange = (cb: (status: SyncStatus) => void) => {
  statusChangeCallback = cb
}

export const markLocalSave = () => {
  localSaveTime = Date.now()
}

export const markSaveComplete = () => {
  setSyncStatus('synced')
  if (statusTimeoutId) clearTimeout(statusTimeoutId)
  statusTimeoutId = setTimeout(() => {
    if (syncStatus === 'synced') {
      setSyncStatus('idle')
      reRenderFn?.()
    }
  }, 3000)
}

export const initSyncMonitor = (reRender: () => void) => {
  reRenderFn = reRender

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return

    const now = Date.now()
    if (localSaveTime > 0 && now - localSaveTime < 2000) {
      return
    }

    const hasMetaChange = !!changes['tm_meta']
    const hasChunkChange = Object.keys(changes).some(k => k.startsWith('tm_tasks_'))
    if (!hasMetaChange && !hasChunkChange) return

    const metaChange = changes['tm_meta']
    if (metaChange && metaChange.newValue === undefined) {
      const current = getState()
      if (current.tasks.length > 0 || current.categories.length > 0) {
        console.warn('[TaskMaster] 检测到sync被清空，从内存回写数据')
        markLocalSave()
        persistState().catch(() => {})
      }
      return
    }

    setSyncStatus('remote-updated')
    mergeRemoteData(getState()).then(() => {
      loadState().then(() => {
        reRender()
        showSyncToast()
        if (statusTimeoutId) clearTimeout(statusTimeoutId)
        statusTimeoutId = setTimeout(() => {
          if (syncStatus === 'remote-updated') {
            setSyncStatus('idle')
            reRender()
          }
        }, 4000)
      })
    }).catch(() => {
      setSyncStatus('error')
    })
  })
}

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

export function showToast(container: HTMLElement, message: string, type: 'success' | 'error' = 'success') {
  const existing = container.querySelector('.toast-message')
  existing?.remove()

  const toast = document.createElement('div')
  toast.className = `toast-message fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm z-50 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 3000)
}