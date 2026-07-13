// Background script for Chrome extension
import { createAutoBackup, loadData, saveData } from './storage'

const ALARM_NAME = 'tm_daily_backup'
const ALARM_PERIOD_MINUTES = 24 * 60 // once per day

// Register alarm on install / startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES })
  console.log('[TaskMaster BG] daily backup alarm registered')
  // Create initial backup
  triggerBackup()
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES })
    }
  })
})

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    triggerBackup()
  }
})

async function triggerBackup() {
  try {
    const result = await createAutoBackup()
    if (result.success) {
      console.log('[TaskMaster BG] auto backup completed')
    } else {
      console.error('[TaskMaster BG] auto backup failed:', result.error)
    }
  } catch (e) {
    console.error('[TaskMaster BG] backup error:', e)
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openNewTab') {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html') })
    sendResponse({})
    return false
  }

  if (message.action === 'getSyncSettings') {
    chrome.storage.local.get(['tm_sync_settings'], (result) => {
      sendResponse(result.tm_sync_settings || {})
    })
    return true
  }

  if (message.action === 'saveSyncSettings') {
    chrome.storage.local.set({ tm_sync_settings: message.settings }, () => {
      sendResponse({ success: true })
    })
    return true
  }

  if (message.action === 'syncRemoteTasks') {
    handleRemoteSync().then(sendResponse).catch(e => sendResponse({ error: String(e) }))
    return true
  }

  // Unknown action — respond immediately to avoid port-closed error
  sendResponse({})
  return false
})

async function handleRemoteSync(): Promise<{ synced?: number; error?: string }> {
  try {
    const settings = await new Promise<{ apiUrl?: string; apiToken?: string }>((resolve) => {
      chrome.storage.local.get(['tm_sync_settings'], (r) => resolve(r.tm_sync_settings || {}))
    })
    if (!settings.apiUrl || !settings.apiToken) {
      return { error: '未配置同步设置' }
    }

    const resp = await fetch(`${settings.apiUrl}/api/tasks`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${settings.apiToken}` }
    })
    if (!resp.ok) return { error: `HTTP ${resp.status}` }

    const respData = await resp.json()
    const remoteTasks: any[] = Array.isArray(respData) ? respData : (respData.tasks || [])
    if (remoteTasks.length === 0) {
      return { synced: 0 }
    }

    const localData = await loadData()

    // Titles are not identifiers: two different phone tasks may legitimately
    // have the same title. Keep the server ID as the only deduplication key.
    const newTasks = remoteTasks.filter((rt: any) =>
      rt.id && !localData.tasks.some(lt => lt.id === (rt.id as string))
    )

    if (newTasks.length > 0) {
      localData.tasks = [...localData.tasks, ...newTasks.map((t: any) => {
      const createdAt = Number(t.createdAt) || Date.now()
      const completed = t.completed === true
      return {
        ...t,
        id: t.id || Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        createdAt,
        updatedAt: Date.now(),
        completed,
        completedAt: completed ? (Number(t.completedAt) || createdAt) : undefined,
        repeatType: t.repeatType || 'none',
        repeatDays: Array.isArray(t.repeatDays) ? t.repeatDays : [],
        repeatInterval: Number(t.repeatInterval) || 1,
        completedDates: Array.isArray(t.completedDates) ? t.completedDates : []
      }
      })]
      await saveData(localData)
    }

    // A retry can arrive after the task was saved locally but before the old
    // acknowledgement request completed. Acknowledge every fetched ID that is
    // durably present locally, not only IDs imported in this invocation.
    try {
      const syncedIds = remoteTasks
        .filter((task: any) => task.id && localData.tasks.some(local => local.id === task.id))
        .map((task: any) => task.id)
      if (syncedIds.length > 0) {
        const acknowledge = await fetch(`${settings.apiUrl}/api/tasks/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiToken}`
          },
          body: JSON.stringify({ ids: syncedIds })
        })
        if (!acknowledge.ok) return { error: `确认导入失败: HTTP ${acknowledge.status}` }
      }
    } catch (e) {
      return { error: `确认导入失败: ${String(e)}` }
    }

    return { synced: newTasks.length }
  } catch (e) {
    return { error: String(e) }
  }
}
