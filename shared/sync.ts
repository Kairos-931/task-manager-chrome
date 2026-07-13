export type SyncStatus = 'idle' | 'saving' | 'local-saved' | 'synced' | 'remote-updated' | 'error'

let syncStatus: SyncStatus = 'idle'
let statusChangeCallback: ((status: SyncStatus) => void) | null = null
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
  setSyncStatus('saving')
}

export const markSaveComplete = () => {
  setSyncStatus('local-saved')
}

export const markCloudSynced = () => {
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

export const markSyncError = () => {
  setSyncStatus('error')
}

export const markRemoteUpdated = () => {
  setSyncStatus('remote-updated')
  if (statusTimeoutId) clearTimeout(statusTimeoutId)
  statusTimeoutId = setTimeout(() => {
    if (syncStatus === 'remote-updated') setSyncStatus('idle')
  }, 3000)
}
