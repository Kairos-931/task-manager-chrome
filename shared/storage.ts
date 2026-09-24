import type { StorageData, Category, Task, RemoteApplyOptions } from './types'
import { TASKMASTER_API_BASE_URL } from './config'

export const STORAGE_KEY = 'tm_data'

const LOCAL_BACKUP_KEY = 'tm_local_backup'
const INCREMENTAL_CURSOR_KEY = 'tm_incremental_sync_cursor'
const INCREMENTAL_DEVICE_KEY = 'tm_incremental_sync_device'
const INCREMENTAL_SHADOW_KEY = 'tm_incremental_sync_shadow'
const INCREMENTAL_CLOCK_KEY = 'tm_incremental_sync_clock'
const OUTGOING_SYNC_BATCH = 100
let lastSyncTimestamp = 0
let syncQueue: Promise<void> = Promise.resolve()

let localMutationQueue: Promise<void> = Promise.resolve()

const enqueueSync = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = syncQueue.then(operation, operation)
  syncQueue = next.then(() => undefined, () => undefined)
  return next
}

const enqueueLocalMutation = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = localMutationQueue.then(operation, operation)
  localMutationQueue = next.then(() => undefined, () => undefined)
  return next
}

// 生成唯一ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

// Default categories are protocol data, not per-install random data. Tasks use
// these IDs on every device, including the mobile quick-add page.
const DEFAULT_CATEGORY_DEFINITIONS = [
  { id: 'default-work', name: '工作', color: '#3b82f6' },
  { id: 'default-life', name: '生活', color: '#10b981' },
  { id: 'default-learning', name: '学习', color: '#8b5cf6' },
] as const

const LEGACY_STARRED_CATEGORY_ID = 'default-starred'

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

const isValidDateOnly = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  if (!Number.isFinite(date.getTime())) return false
  const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return normalized === value
}

const GOOGLE_SESSION_KEY = 'tm_google_account_session'
const LAST_GOOGLE_SUB_KEY = 'tm_last_google_account_sub'
const ACCOUNT_SWITCH_BACKUP_PREFIX = 'tm_account_switch_backup_'

export interface GoogleAccountSession {
  token: string
  user: { sub: string; email?: string; name?: string }
}

export const getGoogleAccountSession = async (): Promise<GoogleAccountSession | null> => {
  const session = await getLocalValue<GoogleAccountSession | null>(GOOGLE_SESSION_KEY, null)
  return session && typeof session.token === 'string' && typeof session.user?.sub === 'string'
    ? session : null
}

const accountStorageKeys = (sub: string) => {
  const suffix = encodeURIComponent(sub)
  return {
    cursor: `${INCREMENTAL_CURSOR_KEY}_${suffix}`,
    shadow: `${INCREMENTAL_SHADOW_KEY}_${suffix}`,
    clock: `${INCREMENTAL_CLOCK_KEY}_${suffix}`
  }
}

const accountFetch = async (session: GoogleAccountSession, path: string, init: RequestInit = {}): Promise<Response> => fetch(
  `${TASKMASTER_API_BASE_URL}${path}`,
  {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${session.token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    },
    cache: 'no-store'
  }
)

const fetchAccountSnapshot = async (session: GoogleAccountSession): Promise<{ cursor: number; data: StorageData }> => {
  const response = await accountFetch(session, '/api/account/snapshot')
  const result = await response.json().catch(() => ({})) as { cursor?: number; data?: StorageData; error?: string }
  if (!response.ok || !result.data) throw new Error(result.error || `账号数据读取失败 (HTTP ${response.status})`)
  return { cursor: Number(result.cursor) || 0, data: normalizeStorageData(result.data) }
}

const createAccountSwitchBackup = (data: StorageData, oldSub: string): Record<string, string> => {
  const key = `${ACCOUNT_SWITCH_BACKUP_PREFIX}${Date.now()}_${encodeURIComponent(oldSub || 'guest')}`
  return { [key]: JSON.stringify({ createdAt: Date.now(), oldSub, data }) }
}

const activateGoogleAccountNow = async (
  session: GoogleAccountSession,
  switchMode?: 'merge' | 'replace'
): Promise<{ success: boolean; requiresSwitchDecision?: boolean; error?: string }> => {
  if (!session || typeof session.token !== 'string' || !session.token || typeof session.user?.sub !== 'string' || !session.user.sub) {
    return { success: false, error: 'Google 登录返回的账号信息无效' }
  }
  const activeSession = await getGoogleAccountSession()
  const lastSub = await getLocalValue<string>(LAST_GOOGLE_SUB_KEY, '')
  const oldSub = activeSession?.user.sub || lastSub
  const isSwitching = !!oldSub && oldSub !== session.user.sub
  if (isSwitching && !switchMode) return { success: false, requiresSwitchDecision: true }

  try {
    const localData = await loadData()
    const keys = accountStorageKeys(session.user.sub)
    const values: Record<string, unknown> = {
      [GOOGLE_SESSION_KEY]: session,
      [LAST_GOOGLE_SUB_KEY]: session.user.sub,
    }
    if (isSwitching) Object.assign(values, createAccountSwitchBackup(localData, oldSub))

    if (isSwitching && switchMode === 'replace') {
      const snapshot = await fetchAccountSnapshot(session)
      const shadowRecords = buildCurrentRecords(snapshot.data, { records: {} })
      values[LOCAL_BACKUP_KEY] = JSON.stringify(snapshot.data)
      values[keys.cursor] = snapshot.cursor
      values[keys.shadow] = { records: shadowRecords }
      values[keys.clock] = Math.max(0, ...Object.values(shadowRecords).map(record => record.updatedAt))
    } else if (isSwitching) {
      // A forced bootstrap merges this device into the destination account and
      // pulls its cloud-only records without interpreting them as deletions.
      values[keys.cursor] = 0
      values[keys.shadow] = { records: {} }
      values[keys.clock] = 0
    }

    // chrome.storage.local.set applies the account identity, optional backup,
    // and replacement snapshot together so the next save cannot sync A's data
    // under B after a partially completed account switch.
    await setLocalValues(values)
    if (isSwitching) lastSyncTimestamp = 0
    if (activeSession && activeSession.user.sub !== session.user.sub) {
      void accountFetch(activeSession, '/api/auth/logout', { method: 'POST' }).catch(() => {})
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const activateGoogleAccount = (
  session: GoogleAccountSession,
  switchMode?: 'merge' | 'replace'
): Promise<{ success: boolean; requiresSwitchDecision?: boolean; error?: string }> =>
  enqueueLocalMutation(() => enqueueSync(() => activateGoogleAccountNow(session, switchMode)))

const logoutGoogleAccountNow = async (): Promise<void> => {
  const session = await getGoogleAccountSession()
  if (session) void accountFetch(session, '/api/auth/logout', { method: 'POST' }).catch(() => {})
  await new Promise<void>((resolve, reject) => chrome.storage.local.remove([GOOGLE_SESSION_KEY], () => {
    if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
    else resolve()
  }))
}

export const logoutGoogleAccount = (): Promise<void> => enqueueLocalMutation(() => enqueueSync(logoutGoogleAccountNow))

export const discardGoogleAccountSession = async (session: GoogleAccountSession): Promise<void> => {
  await accountFetch(session, '/api/auth/logout', { method: 'POST' }).catch(() => {})
}

export const isGoogleAccountConnected = async (): Promise<boolean> => !!(await getGoogleAccountSession())

export const normalizeStorageData = (data: StorageData): StorageData => {
  const categoryIdMap = new Map<string, string>()
  const categoriesByName = new Map<string, Category>()
  const sourceCategories = Array.isArray(data.categories) ? data.categories : createDefaultCategories()

  for (const category of sourceCategories) {
    if (!category?.id || !category.name) continue
    if (category.id === LEGACY_STARRED_CATEGORY_ID) continue
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
  const requestedDefault = resolveCategoryId(data.defaultCategory || '')
  const defaultCategory = requestedDefault !== LEGACY_STARRED_CATEGORY_ID &&
    categories.some(category => category.id === requestedDefault)
    ? requestedDefault
    : (categories[0]?.id || '')
  const resolveTaskCategory = (id: string): string => {
    const resolved = resolveCategoryId(id)
    return resolved === LEGACY_STARRED_CATEGORY_ID ? defaultCategory : resolved
  }

  return {
    ...data,
    tasks: Array.isArray(data.tasks)
      ? data.tasks.map(task => ({
          ...task,
          category: resolveTaskCategory(task.category || ''),
          hardDeadline: typeof task.hardDeadline === 'string' && task.hardDeadline ? task.hardDeadline : undefined,
          focusDate: typeof task.focusDate === 'string' && task.focusDate ? task.focusDate : undefined,
          repeatEndDate: isValidDateOnly(task.repeatEndDate) ? task.repeatEndDate : undefined,
          parentId: typeof task.parentId === 'string' && task.parentId ? task.parentId : undefined,
          isParent: task.isParent === true || undefined,
          duration: task.isParent === true ? 0 : task.duration,
          noTimeLimit: task.isParent === true ? true : task.noTimeLimit
        }))
      : [],
    categories,
    defaultCategory
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
  sourceDevice?: string
}

interface SyncShadow {
  records: Record<string, SyncRecord>
}

export const getNextLocalSettingsUpdatedAt = (current = 0, now = Date.now()): number =>
  Math.max(now, current + 1)

const recordKey = (type: SyncRecordType, id: string): string => `${type}:${id}`

const nextSyncTimestamp = (): number => {
  lastSyncTimestamp = Math.max(Date.now(), lastSyncTimestamp + 1)
  return lastSyncTimestamp
}

const cloneStorageData = (data: StorageData): StorageData => JSON.parse(JSON.stringify(data)) as StorageData

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

let cachedDeviceId: string | null = null

// applyRemoteChanges runs synchronously and needs the device id to filter out
// this device's own echo. The id is stable, so cache it after the first sync.
export const getSyncDeviceIdAsync = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId
  const existing = await getLocalValue<string>(INCREMENTAL_DEVICE_KEY, '')
  if (existing) {
    cachedDeviceId = existing
    return existing
  }
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : generateId()
  await setLocalValues({ [INCREMENTAL_DEVICE_KEY]: id })
  cachedDeviceId = id
  return id
}

export const getSyncDeviceId = getSyncDeviceIdAsync

const getAccountSyncShadow = async (sub: string): Promise<SyncShadow> => {
  const shadow = await getLocalValue<SyncShadow | null>(accountStorageKeys(sub).shadow, null)
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

const applyRemoteChanges = (
  data: StorageData,
  changes: SyncRecord[],
  options: { ignoreDeviceId?: string } = {}
): StorageData => {
  // Changes uploaded by this device come back in the same response window.
  // Treating them as remote updates would needlessly reset the app view.
  const applicableChanges = options.ignoreDeviceId
    ? changes.filter(change => change.sourceDevice !== options.ignoreDeviceId)
    : changes
  const tasks = new Map(data.tasks.map(task => [task.id, task]))
  const categories = new Map(data.categories.map(category => [category.id, category]))
  let settings = { ...data }

  for (const change of applicableChanges) {
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

const syncIncrementallyNow = async (inputData: StorageData): Promise<{ success: boolean; data?: StorageData; hasForeignChanges?: boolean; accountSub?: string; error?: string }> => {
  try {
    const data = normalizeStorageData(inputData)
    const session = await getGoogleAccountSession()
    if (!session) return { success: false, error: 'not_signed_in' }
    const keys = accountStorageKeys(session.user.sub)

    const [deviceId, shadow, initialCursor, storedClock] = await Promise.all([
      getSyncDeviceId(), getAccountSyncShadow(session.user.sub), getLocalValue<number>(keys.cursor, 0),
      getLocalValue<number>(keys.clock, 0)
    ])
    lastSyncTimestamp = Math.max(lastSyncTimestamp, storedClock)
    let cursor = initialCursor
    let mergedData = data
    const firstSync = initialCursor === 0 && Object.keys(shadow.records).length === 0
    let pending = firstSync && isVirginDefaultData(mergedData)
      ? []
      : buildLocalChanges(buildCurrentRecords(mergedData, shadow), shadow)
    let hasMore = true
    let sawForeignChanges = false
    const receivedChanges: SyncRecord[] = []

    while (pending.length > 0 || hasMore) {
      const outgoing = pending.splice(0, OUTGOING_SYNC_BATCH)
      const resp = await accountFetch(session, '/api/account/sync/incremental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, cursor, changes: outgoing })
      })
      if (!resp.ok) {
        const error = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        if (resp.status === 401) {
          await new Promise<void>(resolve => chrome.storage.local.remove([GOOGLE_SESSION_KEY], () => resolve()))
          return { success: false, error: 'session_expired' }
        }
        return { success: false, error: error.error || `HTTP ${resp.status}` }
      }
      const result = await resp.json()
      const remoteChanges = Array.isArray(result.changes) ? result.changes as SyncRecord[] : []
      const rejectedChanges = Array.isArray(result.rejectedChanges) ? result.rejectedChanges as SyncRecord[] : []
      const foreignChanges = remoteChanges.filter(change => change.sourceDevice !== deviceId)
      if (foreignChanges.length > 0) sawForeignChanges = true
      receivedChanges.push(...foreignChanges, ...rejectedChanges)
      mergedData = applyRemoteChanges(mergedData, [...foreignChanges, ...rejectedChanges])
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
        [keys.cursor]: cursor,
        [keys.shadow]: { records: finalRecords },
        [keys.clock]: lastSyncTimestamp
      })
    ])
    return { success: true, data: finalData, hasForeignChanges: sawForeignChanges, accountSub: session.user.sub }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const syncIncrementally = async (data: StorageData): Promise<{ success: boolean; data?: StorageData; hasForeignChanges?: boolean; accountSub?: string; error?: string }> => {
  const requestedSub = (await getGoogleAccountSession())?.user.sub || null
  return enqueueSync(async () => {
    const activeSub = (await getGoogleAccountSession())?.user.sub || null
    if (activeSub !== requestedSub) return { success: false, error: 'account_changed' }
    return syncIncrementallyNow(cloneStorageData(data))
  })
}

export const isCloudConfigured = async (): Promise<boolean> => {
  return isGoogleAccountConnected()
}

const isRecoverableNetworkError = (error?: string): boolean => {
  if (!error) return false
  return /(?:TypeError:\s*)?Failed to fetch|NetworkError when attempting to fetch resource|Load failed/i.test(error)
}

const warnForSyncFailure = (error?: string): void => {
  if (!error || error === '未配置同步设置' || error === 'not_signed_in' || error === 'account_changed' || isRecoverableNetworkError(error)) return
  console.warn('[TaskMaster] incremental sync failed:', error)
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

/** 修复循环任务数据一致性：补齐完成记录，并保留已完成最后一期的重复系列状态。 */
const fixRecurringTasks = (tasks: any[]): any[] => tasks.map(t => {
  if (t.repeatType && t.repeatType !== 'none') {
    if (!Array.isArray(t.completedDates)) t.completedDates = []
    t.repeatEndDate = isValidDateOnly(t.repeatEndDate) ? t.repeatEndDate : undefined
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
    t.completed = Boolean(t.repeatEndDate && isRecurringSeriesComplete(t))
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

const isRecurringSeriesComplete = (task: any): boolean => {
  if (!isValidDateOnly(task.repeatEndDate)) return false
  const anchorValue = task.repeatStartDate || task.dueDate
  if (!isValidDateOnly(anchorValue) || task.repeatEndDate < anchorValue) return false

  const completed = new Set<string>(Array.isArray(task.completedDates) ? task.completedDates : [])
  const cursor = new Date(`${anchorValue}T00:00:00`)
  const end = new Date(`${task.repeatEndDate}T00:00:00`)
  while (cursor <= end) {
    if (isTaskMatchRepeat(task, cursor)) {
      const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      if (!completed.has(date)) return false
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return true
}

export const saveData = async (
  data: StorageData,
  onRemoteData?: (data: StorageData, options?: RemoteApplyOptions) => void,
  onSyncResult?: (result: { success: boolean; data?: StorageData; error?: string }) => void
): Promise<void> => {
  const localData = normalizeStorageData(data)
  localData.tasks = fixRecurringTasks(localData.tasks)
  const syncContext = await enqueueLocalMutation(async () => {
    await saveToLocal(localData)
    const requestedSub = (await getGoogleAccountSession())?.user.sub || null
    // Enqueue before releasing the local mutation queue so a concurrent
    // account switch cannot make this save upload under a different account.
    return { requestedSub, syncPromise: enqueueSync(() => syncIncrementallyNow(localData)) }
  })
  const { requestedSub, syncPromise } = syncContext
  syncPromise.then(async result => {
    const sameAccount = async () => ((await getGoogleAccountSession())?.user.sub || null) === requestedSub
    if (result.error === 'session_expired') {
      onSyncResult?.(result)
      return
    }
    if (result.success && result.data) {
      if (!await sameAccount() || result.accountSub !== requestedSub) return
      const deviceId = await getSyncDeviceIdAsync()
      if (!await sameAccount()) return
      onRemoteData?.(result.data, { ignoreDeviceId: deviceId })
    } else warnForSyncFailure(result.error)
    if (await sameAccount()) onSyncResult?.(result)
  }).catch((e: unknown) => warnForSyncFailure(String(e)))
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
  kind?: 'automatic' | 'account-switch'
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
        const isAutomatic = key.startsWith(BACKUP_PREFIX)
        const isAccountSwitch = key.startsWith(ACCOUNT_SWITCH_BACKUP_PREFIX)
        if (!isAutomatic && !isAccountSwitch) continue
        try {
          const parsed = typeof all[key] === 'string' ? JSON.parse(all[key]) : all[key]
          const d = parsed.data
          const ts = parsed.timestamp || parsed.createdAt || 0
          const dd = new Date(ts)
          const dateStr = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')} ${String(dd.getHours()).padStart(2, '0')}:${String(dd.getMinutes()).padStart(2, '0')}`
          backups.push({
            key,
            timestamp: ts,
            dateStr,
            taskCount: d?.tasks?.length || 0,
            categoryCount: d?.categories?.length || 0,
            kind: isAccountSwitch ? 'account-switch' : 'automatic'
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
    if (key.startsWith(ACCOUNT_SWITCH_BACKUP_PREFIX)) {
      const session = await getGoogleAccountSession()
      if (!session || session.user.sub !== parsed.oldSub) {
        return { success: false, error: '为避免跨账号同步，请先登录此备份所属的原 Google 账号，再恢复本机数据' }
      }
    }
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
  const backups = (await listBackups()).filter(backup => backup.kind === 'automatic')
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
