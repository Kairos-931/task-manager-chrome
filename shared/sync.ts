export type SyncStatus = 'idle' | 'saving' | 'local-saved' | 'synced' | 'remote-updated' | 'error'

let syncStatus: SyncStatus = 'idle'
let statusChangeCallback: ((status: SyncStatus) => void) | null = null
let statusTimeoutId: ReturnType<typeof setTimeout> | null = null

export const getSyncStatus = (): SyncStatus => syncStatus

const setSyncStatus = (status: SyncStatus) => {
  syncStatus = status
  statusChangeCallback?.(status)
}

export const onSyncStatusChange = (cb: (status: SyncStatus) => void) => {
  statusChangeCallback = cb
}

export const shouldRefreshAppForSyncStatus = (
  status: SyncStatus,
  isTaskModalOpen: boolean
): boolean => status === 'remote-updated' && !isTaskModalOpen

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
    }
  }, 3000)
}

export interface ToastAction {
  label: string
  onClick: () => void
}

export function showToast(container: HTMLElement, message: string, type: 'success' | 'error' | 'info' = 'success', action?: ToastAction) {
  const existing = container.ownerDocument.querySelector('.toast-message')
  existing?.remove()

  const toast = document.createElement('div')
  const color = type === 'success' ? 'bg-green-500' : type === 'info' ? 'bg-blue-600' : 'bg-red-500'
  toast.className = `toast-message fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white text-sm z-50 flex items-center gap-4 ${color}`
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status')
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite')
  toast.setAttribute('aria-atomic', 'true')
  const text = document.createElement('span')
  text.textContent = message
  toast.appendChild(text)
  if (action) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'font-semibold underline underline-offset-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-white rounded'
    button.textContent = action.label
    button.addEventListener('click', () => {
      dismiss()
      action.onClick()
    })
    toast.appendChild(button)
  }
  document.body.appendChild(toast)

  let remainingMs = action ? 12000 : 3000
  let timerStartedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let dismissed = false
  const dismiss = () => {
    if (dismissed) return
    dismissed = true
    if (timer) clearTimeout(timer)
    toast.remove()
  }
  const startDismissalTimer = () => {
    if (dismissed || timer || (document.activeElement && toast.contains(document.activeElement))) return
    timerStartedAt = Date.now()
    timer = setTimeout(dismiss, remainingMs)
  }
  const pauseDismissalTimer = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
    remainingMs = Math.max(0, remainingMs - (Date.now() - timerStartedAt))
  }
  toast.addEventListener('pointerenter', pauseDismissalTimer)
  toast.addEventListener('pointerleave', startDismissalTimer)
  toast.addEventListener('focusin', pauseDismissalTimer)
  toast.addEventListener('focusout', event => {
    if (!toast.contains(event.relatedTarget as Node | null)) startDismissalTimer()
  })
  startDismissalTimer()
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
