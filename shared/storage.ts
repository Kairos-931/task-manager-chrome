import type { StorageData, Category, Task } from './types'

export const STORAGE_KEY = 'tm_data'

const LOCAL_BACKUP_KEY = 'tm_local_backup'

// 生成唯一ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

// 默认分类
export const defaultCategories: Category[] = [
  { id: generateId(), name: '工作', color: '#3b82f6' },
  { id: generateId(), name: '生活', color: '#10b981' },
  { id: generateId(), name: '学习', color: '#8b5cf6' },
]

// 获取默认数据
export const getDefaultData = (): StorageData => ({
  tasks: [],
  categories: defaultCategories,
  defaultCategory: '',
  hideCompleted: false,
  hideOverdue: false,
  showNoTimeLimitOnly: false,
  darkMode: false
})

const loadFromLocal = (): Promise<StorageData | null> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([LOCAL_BACKUP_KEY], (result) => {
      if (result[LOCAL_BACKUP_KEY]) {
        try {
          const data = JSON.parse(result[LOCAL_BACKUP_KEY])
          if (data && Array.isArray(data.tasks)) {
            console.log('[TaskMaster] loadData: got', data.tasks.length, 'tasks from local backup')
            resolve(data as StorageData)
            return
          }
        } catch (e) {
          console.error('[TaskMaster] loadData local parse error:', e)
        }
      }
      resolve(null)
    })
  })
}

const saveToLocal = (data: StorageData): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [LOCAL_BACKUP_KEY]: JSON.stringify(data) }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve()
    })
  })
}

// ==================== 合并逻辑 ====================

const mergeTasks = (local: Task[], remote: Task[]): Task[] => {
  const localMap = new Map(local.map(t => [t.id, t] as [string, Task]))
  const result: Task[] = []

  // 保留所有本地任务
  for (const task of local) {
    result.push(task)
  }

  // 合并远端任务
  for (const remoteTask of remote) {
    const localTask = localMap.get(remoteTask.id)
    if (!localTask) {
      // 远端独有的任务，加入
      result.push(remoteTask)
    } else {
      // 两边都有，按 updatedAt 取新的（兼容旧数据没有 updatedAt 的情况）
      const localTime = localTask.updatedAt || localTask.createdAt || 0
      const remoteTime = remoteTask.updatedAt || remoteTask.createdAt || 0
      if (remoteTime > localTime) {
        // 远端更新，替换 — 循环任务保留本地的 completedDates / repeatDays 防丢失
        const idx = result.findIndex(t => t.id === remoteTask.id)
        if (idx !== -1) {
          const merged: any = { ...remoteTask }
          if (localTask.repeatType && localTask.repeatType !== 'none') {
            if (Array.isArray(localTask.completedDates) && localTask.completedDates.length > 0) {
              merged.completedDates = localTask.completedDates
            }
            if (Array.isArray(localTask.repeatDays) && localTask.repeatDays.length > 0 && (!merged.repeatDays || merged.repeatDays.length === 0)) {
              merged.repeatDays = localTask.repeatDays
            }
            if (localTask.repeatStartDate && !merged.repeatStartDate) {
              merged.repeatStartDate = localTask.repeatStartDate
            }
          }
          result[idx] = merged
        }
      }
      // 否则保留本地版本
    }
  }

  return result
}

const mergeCategories = (local: Category[], remote: Category[]): Category[] => {
  // 云端为主，本地仅补充云端没有（按 name）的分类。
  // 避免默认分类（随机 id）与云端同名分类按 id 并集导致重复。
  const result: Category[] = [...remote]
  const remoteNames = new Set(remote.map(c => c.name))
  for (const lc of local) {
    if (!remoteNames.has(lc.name)) {
      result.push(lc)
    }
  }
  return result
}

// Merge two full snapshots: union of tasks (newest updatedAt wins), union of categories,
// scalar settings prefer remote. Keeps unsynced local edits when pulling cloud.
const mergeStorageData = (local: StorageData, remote: StorageData): StorageData => ({
  tasks: mergeTasks(local.tasks, remote.tasks),
  categories: mergeCategories(local.categories, remote.categories),
  defaultCategory: remote.defaultCategory || local.defaultCategory,
  hideCompleted: remote.hideCompleted ?? local.hideCompleted,
  hideOverdue: remote.hideOverdue ?? local.hideOverdue,
  showNoTimeLimitOnly: remote.showNoTimeLimitOnly ?? local.showNoTimeLimitOnly,
  darkMode: remote.darkMode ?? local.darkMode
})

// ==================== Cloudflare 全量同步 ====================

const CLOUD_SYNC_SETTINGS_KEY = 'tm_sync_settings'

const getCloudSettings = async (): Promise<{ apiUrl?: string; apiToken?: string }> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([CLOUD_SYNC_SETTINGS_KEY], (r) => {
      resolve(r[CLOUD_SYNC_SETTINGS_KEY] || {})
    })
  })
}

// Cloud base version (optimistic lock): the updatedAt of the cloud snapshot the
// local data is based on. Set after every successful pull/push, sent on every push.
const CLOUD_BASE_AT_KEY = 'tm_cloud_base_at'

const getCloudBaseAt = (): Promise<string | null> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([CLOUD_BASE_AT_KEY], (r) => {
      resolve(r[CLOUD_BASE_AT_KEY] || null)
    })
  })
}

const setCloudBaseAt = (at: string | null): Promise<void> => {
  return new Promise((resolve) => {
    if (at) {
      chrome.storage.local.set({ [CLOUD_BASE_AT_KEY]: at }, () => resolve())
    } else {
      chrome.storage.local.remove([CLOUD_BASE_AT_KEY], () => resolve())
    }
  })
}

export const syncToCloud = async (
  data: StorageData,
  opts?: { force?: boolean }
): Promise<{ success: boolean; conflict?: boolean; currentUpdatedAt?: string; error?: string; updatedAt?: string }> => {
  try {
    const settings = await getCloudSettings()
    if (!settings.apiUrl || !settings.apiToken) {
      return { success: false, error: '未配置同步设置' }
    }
    const baseUpdatedAt = await getCloudBaseAt()
    const resp = await fetch(`${settings.apiUrl}/api/fullsync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiToken}`
      },
      body: JSON.stringify({ data, baseUpdatedAt, force: opts?.force === true })
    })
    if (resp.status === 409) {
      const err = await resp.json().catch(() => ({ error: 'HTTP 409' }))
      if (err.error === 'conflict') {
        return { success: false, conflict: true, currentUpdatedAt: err.currentUpdatedAt, error: 'conflict' }
      }
      return { success: false, error: err.error || 'refused' }
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
      return { success: false, error: err.error || `HTTP ${resp.status}` }
    }
    const result = await resp.json()
    if (result.updatedAt) {
      await setCloudBaseAt(result.updatedAt)
    }
    return { success: true, updatedAt: result.updatedAt }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const syncFromCloud = async (): Promise<{ data: StorageData | null; updatedAt?: string; error?: string }> => {
  try {
    const settings = await getCloudSettings()
    if (!settings.apiUrl || !settings.apiToken) {
      return { data: null, error: '未配置同步设置' }
    }
    const resp = await fetch(`${settings.apiUrl}/api/fullsync`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${settings.apiToken}` }
    })
    if (!resp.ok) {
      return { data: null, error: `HTTP ${resp.status}` }
    }
    const result = await resp.json()
    if (!result.data) {
      return { data: null }
    }
    if (result.updatedAt) {
      await setCloudBaseAt(result.updatedAt)
    }
    return { data: result.data as StorageData, updatedAt: result.updatedAt }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

export const isCloudConfigured = async (): Promise<boolean> => {
  const settings = await getCloudSettings()
  return !!(settings.apiUrl && settings.apiToken)
}

// ==================== 公开 API ====================

export const loadData = async (): Promise<StorageData> => {
  // 本地备份可能含未上云的改动，先读出，与云端合并，避免被云端覆盖
  const localBackup = await loadFromLocal()

  // 1. Try Cloudflare full sync (if configured)
  const cloudResult = await syncFromCloud()
  if (cloudResult.data && cloudResult.data.tasks && cloudResult.data.tasks.length > 0) {
    let data = cloudResult.data
    if (localBackup && localBackup.tasks && localBackup.tasks.length > 0) {
      data = mergeStorageData(localBackup, cloudResult.data)
    }
    data.tasks = data.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    await saveToLocal(data)
    console.log('[TaskMaster] loadData: cloud', cloudResult.data.tasks.length, '+ local', localBackup?.tasks?.length || 0, '→ merged', data.tasks.length)
    return data
  }

  // 2. 云端不可用 → 从本地备份恢复（开头已读到 localBackup）
  if (localBackup && localBackup.tasks && localBackup.tasks.length > 0) {
    console.warn('[TaskMaster] 云端为空，从本地备份恢复')
    localBackup.tasks = localBackup.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    return localBackup
  }

  // 3. 全新安装
  console.warn('[TaskMaster] 云端和本地都为空，返回默认数据')
  return getDefaultData()
}

/** 修复循环任务数据一致性：completed 必须为 false，completedDates 必须为数组，从 repeatStartDate/dueDate 反推丢失的完成记录 */
const fixRecurringTasks = (tasks: any[]): any[] => tasks.map(t => {
  if (t.repeatType && t.repeatType !== 'none') {
    t.completed = false
    if (!Array.isArray(t.completedDates)) t.completedDates = []
    if (t.repeatType === 'weekly' && (!Array.isArray(t.repeatDays) || t.repeatDays.length === 0)) {
      if (t.repeatStartDate || t.dueDate) {
        const anchor = new Date(t.repeatStartDate || t.dueDate)
        t.repeatDays = [anchor.getDay()]
      }
    }
    // completedDates 为空但 dueDate 已推进 → 反推历史完成日期
    if (t.completedDates.length === 0 && t.repeatStartDate && t.dueDate && t.dueDate > t.repeatStartDate) {
      const start = new Date(t.repeatStartDate)
      const current = new Date(t.dueDate)
      const completed: string[] = []
      const check = new Date(start)
      while (check < current) {
        const ds = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`
        if (isTaskMatchRepeat(t, check)) {
          completed.push(ds)
        }
        check.setDate(check.getDate() + 1)
      }
      t.completedDates = completed
    }
  }
  return t
})

/** 判断某天是否匹配循环任务的规则 */
const isTaskMatchRepeat = (t: any, date: Date): boolean => {
  const anchor = new Date(t.repeatStartDate || t.dueDate)
  if (date < anchor) return false
  switch (t.repeatType) {
    case 'daily': return true
    case 'weekly': return (t.repeatDays || []).includes(date.getDay())
    case 'monthly': return date.getDate() === anchor.getDate()
    case 'workdays': return date.getDay() >= 1 && date.getDay() <= 5
    case 'custom': {
      const diff = Math.floor((date.getTime() - anchor.getTime()) / 86400000)
      return diff % (t.repeatInterval || 1) === 0
    }
    default: return false
  }
}

export const saveData = async (data: StorageData): Promise<void> => {
  data.tasks = fixRecurringTasks(data.tasks)
  await saveToLocal(data)
  // Write to Cloudflare. On version conflict, pull latest to refresh the base;
  // the local edit survives via loadData merge and goes up on the next save.
  cloudSyncWrite(data).catch(e => console.warn('[TaskMaster] cloud sync write failed:', e))
}

const cloudSyncWrite = async (data: StorageData): Promise<void> => {
  const result = await syncToCloud(data)
  if (result.success) return
  if (result.conflict) {
    console.warn('[TaskMaster] cloud sync conflict (stale base), refreshing base from cloud')
    await syncFromCloud().catch(() => {})
    return
  }
  console.warn('[TaskMaster] cloud sync failed:', result.error)
}

// ==================== 自动备份（保留最近 3 天）====================

const BACKUP_PREFIX = 'tm_auto_backup_'
const MAX_BACKUPS = 3

export interface BackupInfo {
  key: string
  timestamp: number
  dateStr: string
  taskCount: number
  categoryCount: number
}

const formatDateKey = (ts: number): string => {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}${m}${day}_${h}${min}`
}

export const createAutoBackup = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = await loadData()
    const now = Date.now()
    const key = BACKUP_PREFIX + formatDateKey(now)
    const payload = JSON.stringify({ timestamp: now, data })

    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ [key]: payload }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
        else resolve()
      })
    })

    await cleanOldBackups()
    console.log('[TaskMaster] auto backup created:', key)
    return { success: true }
  } catch (e) {
    console.error('[TaskMaster] auto backup failed:', e)
    return { success: false, error: String(e) }
  }
}

export const listBackups = async (): Promise<BackupInfo[]> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (all) => {
      if (chrome.runtime.lastError) {
        resolve([])
        return
      }
      const backups: BackupInfo[] = []
      for (const key of Object.keys(all)) {
        if (!key.startsWith(BACKUP_PREFIX)) continue
        try {
          const parsed = typeof all[key] === 'string' ? JSON.parse(all[key]) : all[key]
          const d = parsed.data
          const ts = parsed.timestamp || 0
          const dd = new Date(ts)
          const dateStr = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')} ${String(dd.getHours()).padStart(2, '0')}:${String(dd.getMinutes()).padStart(2, '0')}`
          backups.push({
            key,
            timestamp: ts,
            dateStr,
            taskCount: d?.tasks?.length || 0,
            categoryCount: d?.categories?.length || 0
          })
        } catch { /* skip corrupt */ }
      }
      backups.sort((a, b) => b.timestamp - a.timestamp)
      resolve(backups)
    })
  })
}

export const restoreBackup = async (key: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await new Promise<string | null>((resolve) => {
      chrome.storage.local.get([key], (r) => {
        if (chrome.runtime.lastError) { resolve(null); return }
        resolve(r[key] || null)
      })
    })
    if (!result) return { success: false, error: '备份不存在' }
    const parsed = JSON.parse(result)
    if (!parsed.data?.tasks) return { success: false, error: '备份数据损坏' }
    await saveData(parsed.data)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const deleteBackup = async (key: string): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], () => resolve())
  })
}

const cleanOldBackups = async (): Promise<void> => {
  const backups = await listBackups()
  if (backups.length <= MAX_BACKUPS) return
  const toRemove = backups.slice(MAX_BACKUPS).map(b => b.key)
  if (toRemove.length === 0) return
  await new Promise<void>((resolve) => {
    chrome.storage.local.remove(toRemove, () => resolve())
  })
  console.log('[TaskMaster] cleaned', toRemove.length, 'old backups')
}

export const getStorageUsage = async (): Promise<{ used: number; total: number; percentage: number; breakdown: { key: string; size: number }[] }> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (all) => {
      let totalSize = 0
      const breakdown: { key: string; size: number }[] = []
      for (const [key, value] of Object.entries(all)) {
        const size = JSON.stringify(value).length
        totalSize += size
        breakdown.push({ key, size })
      }
      breakdown.sort((a, b) => b.size - a.size)
      // chrome.storage.local limit is 5MB (5,242,880 bytes)
      const limit = 5 * 1024 * 1024
      resolve({
        used: totalSize,
        total: limit,
        percentage: Math.round((totalSize / limit) * 100),
        breakdown
      })
    })
  })
}

// ==================== 数据导入/导出 ====================

export interface ExportData {
  version: string
  exportTime: string
  data: StorageData
}

export const exportData = async (): Promise<string> => {
  const data = await loadData()
  const exportObj: ExportData = {
    version: '1.2.0',
    exportTime: new Date().toISOString(),
    data
  }
  return JSON.stringify(exportObj, null, 2)
}

export const downloadExportFile = async (): Promise<void> => {
  const jsonStr = await exportData()
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  a.download = `task-manager-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const validateImportData = (obj: unknown): { valid: boolean; error?: string; data?: StorageData } => {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: '数据格式无效' }
  }
  const exportObj = obj as Partial<ExportData>
  if (!exportObj.data || typeof exportObj.data !== 'object') {
    return { valid: false, error: '缺少 data 字段' }
  }
  const data = exportObj.data
  if (!Array.isArray(data.tasks)) {
    return { valid: false, error: 'tasks 必须是数组' }
  }
  if (!Array.isArray(data.categories)) {
    return { valid: false, error: 'categories 必须是数组' }
  }
  return { valid: true, data: data as StorageData }
}

export const importDataFromFile = async (file: File): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const parsed = JSON.parse(text)
        const validation = validateImportData(parsed)
        if (!validation.valid || !validation.data) {
          resolve({ success: false, error: validation.error })
          return
        }
        await saveData(validation.data)
        resolve({ success: true })
      } catch {
        resolve({ success: false, error: '文件解析失败，请选择正确的 JSON 文件' })
      }
    }
    reader.onerror = () => {
      resolve({ success: false, error: '文件读取失败' })
    }
    reader.readAsText(file)
  })
}