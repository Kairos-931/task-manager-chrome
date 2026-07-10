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

// 按 name 去重
const dedupeCategories = (cats: Category[]): Category[] => {
  const map = new Map<string, Category>()
  for (const c of cats) {
    if (map.has(c.name)) {
      // 保留已有 id（任务引用的），后写入的覆盖颜色
      const existing = map.get(c.name)!
      map.set(c.name, { ...existing, color: c.color })
    } else {
      map.set(c.name, { ...c })
    }
  }
  return [...map.values()]
}

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
  const localBackup = await loadFromLocal()

  // 本地有数据 → 以本地为权威，不与云端 merge。
  // cloudSyncWrite 是异步推送，关闭插件时可能未完成 → 云端落后于本地。此时若 merge
  // 云端旧快照，会把本地已删除的任务"恢复"回来，也会用旧状态覆盖本地最新的完成/修改。
  // 本地为准可彻底杜绝这类回写覆盖。跨设备拉取改由「从云端拉取」按钮手动触发。
  if (localBackup && localBackup.tasks && localBackup.tasks.length > 0) {
    localBackup.tasks = localBackup.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    return localBackup
  }

  // 本地为空（重装/新设备）→ 从云端恢复
  const cloudResult = await syncFromCloud()
  if (cloudResult.data && cloudResult.data.tasks && cloudResult.data.tasks.length > 0) {
    cloudResult.data.tasks = cloudResult.data.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    await saveToLocal(cloudResult.data)
    console.log('[TaskMaster] loadData: 本地为空，从云端恢复', cloudResult.data.tasks.length, '条')
    return cloudResult.data
  }

  // 全新安装
  console.warn('[TaskMaster] 本地和云端都为空，返回默认数据')
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
  data.categories = dedupeCategories(data.categories)
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