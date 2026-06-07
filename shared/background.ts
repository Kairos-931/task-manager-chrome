// Background script for Chrome extension

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
    const { createAutoBackup } = await import('./storage')
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
    return
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
})

async function handleRemoteSync(): Promise<{ synced?: number; error?: string }> {
  try {
    const settings = await new Promise<{ apiUrl?: string; apiToken?: string }>((resolve) => {
      chrome.storage.local.get(['tm_sync_settings'], (r) => resolve(r.tm_sync_settings || {}))
    })
    if (!settings.apiUrl || !settings.apiToken) {
      return { error: '未配置同步设置' }
    }

    const resp = await fetch(`${settings.apiUrl}/api/tasks?token=${settings.apiToken}`, {
      method: 'GET'
    })
    if (!resp.ok) return { error: `HTTP ${resp.status}` }

    const remoteTasks = await resp.json()
    if (!Array.isArray(remoteTasks) || remoteTasks.length === 0) {
      return { synced: 0 }
    }

    // Import via mergeRemoteData
    const { loadData, saveData } = await import('./storage')
    const localData = await loadData()

    const newTasks = remoteTasks.filter((rt: any) => {
      return !localData.tasks.some(lt => lt.id === (rt.id as string) || lt.title === (rt.title as string))
    })

    if (newTasks.length === 0) return { synced: 0 }

    localData.tasks = [...localData.tasks, ...newTasks.map((t: any) => ({
      ...t,
      id: t.id || Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      createdAt: t.createdAt || Date.now(),
      updatedAt: Date.now()
    }))]
    await saveData(localData)
    return { synced: newTasks.length }
  } catch (e) {
    return { error: String(e) }
  }
}
