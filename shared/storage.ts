import type { StorageData, Category, Task } from './types'

export const STORAGE_KEY = 'tm_data'

const LOCAL_BACKUP_KEY = 'tm_local_backup'

// 生成唯一ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

// Default categories are protocol data, not per-install random data. Tasks use
// these IDs on every device, including the mobile quick-add page.
const DEFAULT_CATEGORY_DEFINITIONS = [
  { id: 'default-starred', name: '星标', color: '#f59e0b' },
  { id: 'default-work', name: '工作', color: '#3b82f6' },
  { id: 'default-life', name: '生活', color: '#10b981' },
  { id: 'default-learning', name: '学习', color: '#8b5cf6' },
] as const

const defaultCategoryByName = new Map<string, (typeof DEFAULT_CATEGORY_DEFINITIONS)[number]>(
  DEFAULT_CATEGORY_DEFINITIONS.map(category => [category.name, category])
)

const createDefaultCategories = (): Category[] => {
  const updatedAt = Date.now()
  return DEFAULT_CATEGORY_DEFINITIONS.map(category => ({ ...category, updatedAt }))
}

export const defaultCategories: Category[] = createDefaultCategories()

// 获取默认数据
export const getDefaultData = (): StorageData => ({
  tasks: [],
  categories: createDefaultCategories(),
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

const normalizeStorageData = (data: StorageData): StorageData => {
  const categoryIdMap = new Map<string, string>()
  const categoriesByName = new Map<string, Category>()
  const sourceCategories = Array.isArray(data.categories) ? data.categories : createDefaultCategories()

  for (const category of sourceCategories) {
    if (!category?.id || !category.name) continue
    const definition = defaultCategoryByName.get(category.name)
    const normalized = definition
      ? { ...category, id: definition.id, name: definition.name }
      : { ...category }
    if (normalized.id !== category.id) categoryIdMap.set(category.id, normalized.id)

    const existing = categoriesByName.get(normalized.name)
    if (!existing || (normalized.updatedAt || 0) >= (existing.updatedAt || 0)) {
      categoriesByName.set(normalized.name, normalized)
    }
  }

  const categories = dedupeCategories([...categoriesByName.values()])
  const categoryNameToId = new Map(categories.map(category => [category.name, category.id]))
  const resolveCategoryId = (id: string): string => categoryIdMap.get(id) || categoryNameToId.get(id) || id

  return {
    ...data,
    tasks: Array.isArray(data.tasks)
      ? data.tasks.map(task => ({ ...task, category: resolveCategoryId(task.category || '') }))
      : [],
    categories,
    defaultCategory: resolveCategoryId(data.defaultCategory || '')
  }
}

// ==================== Incremental cloud sync ====================

type SyncRecordType = 'task' | 'category' | 'settings'

interface SyncRecord {
  type: SyncRecordType
  id: string
  payload: Record<string, unknown> | null
  deleted: boolean
  updatedAt: number
}

interface SyncShadow {
  records: Record<string, SyncRecord>
}

const INCREMENTAL_CURSOR_KEY = 'tm_incremental_sync_cursor'
const INCREMENTAL_DEVICE_KEY = 'tm_incremental_sync_device'
const INCREMENTAL_SHADOW_KEY = 'tm_incremental_sync_shadow'
const INCREMENTAL_CLOCK_KEY = 'tm_incremental_sync_clock'
const OUTGOING_SYNC_BATCH = 400
let lastSyncTimestamp = 0
let syncQueue: Promise<void> = Promise.resolve()

const recordKey = (type: SyncRecordType, id: string): string => `${type}:${id}`

const nextSyncTimestamp = (): number => {
  lastSyncTimestamp = Math.max(Date.now(), lastSyncTimestamp + 1)
  return lastSyncTimestamp
}

const cloneStorageData = (data: StorageData): StorageData => JSON.parse(JSON.stringify(data)) as StorageData

const enqueueSync = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = syncQueue.then(operation, operation)
  syncQueue = next.then(() => undefined, () => undefined)
  return next
}

const getLocalValue = async <T>(key: string, fallback: T): Promise<T> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve((result[key] as T) || fallback))
  })
}

const setLocalValues = async (values: Record<string, unknown>): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve()
    })
  })
}

const getSyncDeviceId = async (): Promise<string> => {
  const existing = await getLocalValue<string>(INCREMENTAL_DEVICE_KEY, '')
  if (existing) return existing
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : generateId()
  await setLocalValues({ [INCREMENTAL_DEVICE_KEY]: id })
  return id
}

const getSyncShadow = async (): Promise<SyncShadow> => {
  const shadow = await getLocalValue<SyncShadow | null>(INCREMENTAL_SHADOW_KEY, null)
  return shadow && shadow.records ? shadow : { records: {} }
}

const getSettingsPayload = (data: StorageData): Record<string, unknown> => ({
  defaultCategory: data.defaultCategory,
  hideCompleted: data.hideCompleted,
  hideOverdue: data.hideOverdue,
  showNoTimeLimitOnly: data.showNoTimeLimitOnly,
  darkMode: data.darkMode,
  weeklyGoalMinutes: data.weeklyGoalMinutes,
  weeklyGoalAnchor: data.weeklyGoalAnchor,
})

const samePayload = (a: Record<string, unknown> | null, b: Record<string, unknown> | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

const buildCurrentRecords = (data: StorageData, shadow: SyncShadow): Record<string, SyncRecord> => {
  const records: Record<string, SyncRecord> = {}
  for (const task of data.tasks) {
    if (!task.updatedAt) task.updatedAt = nextSyncTimestamp()
    const id = String(task.id)
    records[recordKey('task', id)] = {
      type: 'task', id, payload: task as unknown as Record<string, unknown>, deleted: false, updatedAt: task.updatedAt
    }
  }
  for (const category of data.categories) {
    if (!category.updatedAt) category.updatedAt = nextSyncTimestamp()
    const id = String(category.id)
    records[recordKey('category', id)] = {
      type: 'category', id, payload: category as unknown as Record<string, unknown>, deleted: false, updatedAt: category.updatedAt
    }
  }

  const settingsPayload = getSettingsPayload(data)
  const previous = shadow.records[recordKey('settings', 'app')]
  const settingsUpdatedAt = previous && samePayload(settingsPayload, previous.payload)
    ? previous.updatedAt
    : nextSyncTimestamp()
  data.syncSettingsUpdatedAt = settingsUpdatedAt
  records[recordKey('settings', 'app')] = {
    type: 'settings', id: 'app', payload: settingsPayload, deleted: false, updatedAt: settingsUpdatedAt
  }
  return records
}

const buildLocalChanges = (current: Record<string, SyncRecord>, shadow: SyncShadow): SyncRecord[] => {
  const changes: SyncRecord[] = []
  for (const [key, record] of Object.entries(current)) {
    const previous = shadow.records[key]
    if (!previous || previous.deleted || !samePayload(record.payload, previous.payload)) {
      if (previous && record.updatedAt <= previous.updatedAt) {
        record.updatedAt = nextSyncTimestamp()
        if (record.payload) record.payload.updatedAt = record.updatedAt
      }
      changes.push(record)
    }
  }
  for (const previous of Object.values(shadow.records)) {
    const key = recordKey(previous.type, previous.id)
    if (!previous.deleted && !current[key]) {
      changes.push({ ...previous, payload: null, deleted: true, updatedAt: nextSyncTimestamp() })
    }
  }
  return changes
}

const applyRemoteChanges = (data: StorageData, changes: SyncRecord[]): StorageData => {
  const tasks = new Map(data.tasks.map(task => [task.id, task]))
  const categories = new Map(data.categories.map(category => [category.id, category]))
  let settings = { ...data }

  for (const change of changes) {
    if (change.type === 'task') {
      const local = tasks.get(change.id)
      if (local && local.updatedAt > change.updatedAt) continue
      if (change.deleted) tasks.delete(change.id)
      else if (change.payload) tasks.set(change.id, change.payload as unknown as Task)
    } else if (change.type === 'category') {
      const local = categories.get(change.id)
      if (local && (local.updatedAt || 0) > change.updatedAt) continue
      if (change.deleted) categories.delete(change.id)
      else if (change.payload) categories.set(change.id, change.payload as unknown as Category)
    } else if (!change.deleted && change.payload) {
      if ((settings.syncSettingsUpdatedAt || 0) <= change.updatedAt) {
        settings = { ...settings, ...change.payload, syncSettingsUpdatedAt: change.updatedAt }
      }
    }
  }

  return normalizeStorageData({
    ...settings,
    tasks: [...tasks.values()],
    categories: dedupeCategories([...categories.values()])
  })
}

const isVirginDefaultData = (data: StorageData): boolean => {
  if (data.tasks.length > 0 || data.categories.length !== DEFAULT_CATEGORY_DEFINITIONS.length) return false
  const hasDefaultCategories = data.categories.every(category => {
    const definition = defaultCategoryByName.get(category.name)
    return definition?.id === category.id && definition.color === category.color
  })
  return hasDefaultCategories &&
    !data.defaultCategory && !data.hideCompleted && !data.hideOverdue && !data.showNoTimeLimitOnly &&
    !data.darkMode && !data.weeklyGoalMinutes && !data.weeklyGoalAnchor
}

const syncIncrementallyNow = async (inputData: StorageData): Promise<{ success: boolean; data?: StorageData; error?: string }> => {
  try {
    const data = normalizeStorageData(inputData)
    const settings = await getCloudSettings()
    if (!settings.apiUrl || !settings.apiToken) return { success: false, error: '未配置同步设置' }

    const [deviceId, shadow, initialCursor, storedClock] = await Promise.all([
      getSyncDeviceId(), getSyncShadow(), getLocalValue<number>(INCREMENTAL_CURSOR_KEY, 0),
      getLocalValue<number>(INCREMENTAL_CLOCK_KEY, 0)
    ])
    lastSyncTimestamp = Math.max(lastSyncTimestamp, storedClock)
    let cursor = initialCursor
    let mergedData = data
    const firstSync = initialCursor === 0 && Object.keys(shadow.records).length === 0
    let pending = firstSync && isVirginDefaultData(mergedData)
      ? []
      : buildLocalChanges(buildCurrentRecords(mergedData, shadow), shadow)
    let hasMore = true
    const receivedChanges: SyncRecord[] = []

    while (pending.length > 0 || hasMore) {
      const outgoing = pending.splice(0, OUTGOING_SYNC_BATCH)
      const resp = await fetch(`${settings.apiUrl}/api/sync/incremental`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiToken}`
        },
        body: JSON.stringify({ deviceId, cursor, changes: outgoing })
      })
      if (!resp.ok) {
        const error = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        return { success: false, error: error.error || `HTTP ${resp.status}` }
      }
      const result = await resp.json()
      const remoteChanges = Array.isArray(result.changes) ? result.changes as SyncRecord[] : []
      const rejectedChanges = Array.isArray(result.rejectedChanges) ? result.rejectedChanges as SyncRecord[] : []
      receivedChanges.push(...remoteChanges, ...rejectedChanges)
      mergedData = applyRemoteChanges(mergedData, [...remoteChanges, ...rejectedChanges])
      cursor = Number.isInteger(result.cursor) ? result.cursor : cursor
      hasMore = result.hasMore === true
    }

    // A later local save may have happened while this request was in flight.
    // Merge server data onto that newer backup, but keep the shadow limited to
    // records this request actually reconciled with the server.
    const latestLocal = await loadFromLocal()
    const finalData = latestLocal
      ? applyRemoteChanges(normalizeStorageData(latestLocal), receivedChanges)
      : mergedData
    const finalRecords = buildCurrentRecords(mergedData, { records: {} })
    await Promise.all([
      saveToLocal(finalData),
      setLocalValues({
        [INCREMENTAL_CURSOR_KEY]: cursor,
        [INCREMENTAL_SHADOW_KEY]: { records: finalRecords },
        [INCREMENTAL_CLOCK_KEY]: lastSyncTimestamp
      })
    ])
    return { success: true, data: finalData }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const syncIncrementally = (data: StorageData): Promise<{ success: boolean; data?: StorageData; error?: string }> =>
  enqueueSync(() => syncIncrementallyNow(cloneStorageData(data)))

export const isCloudConfigured = async (): Promise<boolean> => {
  const settings = await getCloudSettings()
  return !!(settings.apiUrl && settings.apiToken)
}

// ==================== 公开 API ====================

export const loadData = async (): Promise<StorageData> => {
  const localBackup = await loadFromLocal()

  // Any valid backup is authoritative, even when it has no tasks. An empty
  // task list can still contain categories and weekly-goal settings.
  if (localBackup) {
    const normalized = normalizeStorageData(localBackup)
    normalized.tasks = normalized.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    return normalized
  }

  // A new install starts with stable defaults. loadState immediately pulls
  // incremental records without relying on the legacy full-snapshot API.
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

export const saveData = async (
  data: StorageData,
  onRemoteData?: (data: StorageData) => void,
  onSyncResult?: (result: { success: boolean; data?: StorageData; error?: string }) => void
): Promise<void> => {
  const localData = normalizeStorageData(data)
  localData.tasks = fixRecurringTasks(localData.tasks)
  await saveToLocal(localData)
  syncIncrementally(localData).then(result => {
    if (result.success && result.data) onRemoteData?.(result.data)
    else if (result.error !== '未配置同步设置') console.warn('[TaskMaster] incremental sync failed:', result.error)
    onSyncResult?.(result)
  }).catch(e => console.warn('[TaskMaster] incremental sync failed:', e))
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
    version: '3.10.0',
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
