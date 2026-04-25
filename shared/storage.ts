import type { StorageData, Category, Task } from './types'

export const STORAGE_KEY = 'tm_data'

const META_KEY = 'tm_meta'
const INDEX_KEY = 'tm_index'
const CHUNK_PREFIX = 'tm_tasks_'
const CHUNK_SIZE = 7000
const LOCAL_BACKUP_KEY = 'tm_local_backup'
const OLD_SIMPLE_KEY = 'task_manager_data'

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
  hideCompleted: false,
  hideOverdue: false,
  showNoTimeLimitOnly: false,
  darkMode: false
})

const splitTasksToChunks = (tasks: Task[]): Task[][] => {
  const chunks: Task[][] = []
  let current: Task[] = []
  let currentSize = 0
  for (const task of tasks) {
    const taskStr = JSON.stringify(task)
    if (currentSize + taskStr.length + 1 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current)
      current = []
      currentSize = 0
    }
    current.push(task)
    currentSize += taskStr.length + 1
  }
  if (current.length > 0) {
    chunks.push(current)
  }
  return chunks
}

// ==================== 分块 Sync 读写 ====================

const loadFromSyncChunked = (): Promise<StorageData | null> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get([META_KEY, INDEX_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[TaskMaster] loadData meta error:', chrome.runtime.lastError)
        resolve(null)
        return
      }
      if (!result[META_KEY]) {
        console.log('[TaskMaster] loadData: no tm_meta found in sync')
        resolve(null)
        return
      }
      const meta = result[META_KEY]
      const index = result[INDEX_KEY] || { chunkCount: 0 }
      const chunkKeys: string[] = []
      for (let i = 0; i < index.chunkCount; i++) {
        chunkKeys.push(CHUNK_PREFIX + i)
      }
      if (chunkKeys.length === 0) {
        resolve({ ...meta, tasks: [] })
        return
      }
      chrome.storage.sync.get(chunkKeys, (chunkResult) => {
        if (chrome.runtime.lastError) {
          console.error('[TaskMaster] loadData chunks error:', chrome.runtime.lastError)
          resolve({ ...meta, tasks: [] })
          return
        }
        const tasks: Task[] = []
        for (let i = 0; i < index.chunkCount; i++) {
          const chunk = chunkResult[CHUNK_PREFIX + i]
          if (Array.isArray(chunk)) {
            tasks.push(...chunk)
          } else {
            console.warn('[TaskMaster] loadData: chunk', i, 'missing or not array', chunk)
          }
        }
        console.log('[TaskMaster] loadData: got', tasks.length, 'tasks from', index.chunkCount, 'chunks')
        resolve({ ...meta, tasks })
      })
    })
  })
}

const saveToSyncChunked = (data: StorageData): Promise<void> => {
  const meta = {
    categories: data.categories,
    hideCompleted: data.hideCompleted,
    hideOverdue: data.hideOverdue,
    showNoTimeLimitOnly: data.showNoTimeLimitOnly,
    darkMode: data.darkMode
  }
  const tasks = data.tasks || []
  const chunks = splitTasksToChunks(tasks)
  const newIndex = { chunkCount: chunks.length }
  const update: Record<string, unknown> = {
    [META_KEY]: meta,
    [INDEX_KEY]: newIndex
  }
  chunks.forEach((chunk, i) => {
    update[CHUNK_PREFIX + i] = chunk
  })
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([INDEX_KEY], (r) => {
      const oldIndex = r[INDEX_KEY]
      const removeKeys: string[] = []
      if (oldIndex) {
        for (let i = chunks.length; i < (oldIndex.chunkCount || 0); i++) {
          removeKeys.push(CHUNK_PREFIX + i)
        }
      }
      chrome.storage.sync.set(update, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
          return
        }
        if (removeKeys.length > 0) {
          chrome.storage.sync.remove(removeKeys, () => resolve())
        } else {
          resolve()
        }
      })
    })
  })
}

// ==================== 旧版 Simple Key 迁移 ====================

const loadFromSyncSimple = (): Promise<StorageData | null> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get([OLD_SIMPLE_KEY], (result) => {
      if (result[OLD_SIMPLE_KEY]) {
        try {
          const parsed = JSON.parse(result[OLD_SIMPLE_KEY])
          if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.categories)) {
            console.log('[TaskMaster] loadData: migrated from old simple key, got', parsed.tasks.length, 'tasks')
            // Clean up old key after successful migration
            chrome.storage.sync.remove([OLD_SIMPLE_KEY])
            resolve(parsed as StorageData)
            return
          }
        } catch { /* ignore */ }
      }
      resolve(null)
    })
  })
}

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
        // 远端更新，替换
        const idx = result.findIndex(t => t.id === remoteTask.id)
        if (idx !== -1) result[idx] = remoteTask
      }
      // 否则保留本地版本
    }
  }

  return result
}

const mergeCategories = (local: Category[], remote: Category[]): Category[] => {
  const map = new Map(local.map(c => [c.id, c] as [string, Category]))
  const result: Category[] = [...local]
  for (const rc of remote) {
    if (!map.has(rc.id)) {
      result.push(rc)
    }
  }
  return result
}

// ==================== 公开 API ====================

export const loadData = async (): Promise<StorageData> => {
  // 1. 尝试从 sync 分块读取（当前版本）
  const syncData = await loadFromSyncChunked()
  if (syncData) {
    // 确保有 updatedAt（兼容旧数据）
    syncData.tasks = syncData.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    await saveToLocal(syncData)
    return syncData
  }

  // 2. 尝试从 sync 旧版 simple key 读取（v1.1.0 build 产物）
  const oldSyncData = await loadFromSyncSimple()
  if (oldSyncData) {
    oldSyncData.tasks = oldSyncData.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    await saveToLocal(oldSyncData)
    await saveToSyncChunked(oldSyncData)
    return oldSyncData
  }

  // 3. 尝试从 local 备份读取
  const localData = await loadFromLocal()
  if (localData) {
    console.warn('[TaskMaster] sync为空，从local恢复数据')
    localData.tasks = localData.tasks.map(t => ({
      ...t,
      updatedAt: t.updatedAt || t.createdAt || Date.now()
    }))
    await saveToSyncChunked(localData)
    return localData
  }

  // 4. 全新安装
  console.warn('[TaskMaster] local和sync都为空，返回默认数据')
  return getDefaultData()
}

export const saveData = async (data: StorageData): Promise<void> => {
  await saveToLocal(data)
  await saveToSyncChunked(data)
}

export const mergeRemoteData = async (remoteData: StorageData): Promise<StorageData> => {
  const localData = await loadData()
  const mergedTasks = mergeTasks(localData.tasks, remoteData.tasks)
  const mergedCategories = mergeCategories(localData.categories, remoteData.categories)
  const merged: StorageData = {
    tasks: mergedTasks,
    categories: mergedCategories,
    hideCompleted: remoteData.darkMode !== undefined ? remoteData.hideCompleted : localData.hideCompleted,
    hideOverdue: remoteData.darkMode !== undefined ? remoteData.hideOverdue : localData.hideOverdue,
    showNoTimeLimitOnly: remoteData.showNoTimeLimitOnly ?? localData.showNoTimeLimitOnly,
    darkMode: remoteData.darkMode ?? localData.darkMode
  }
  await saveData(merged)
  return merged
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
  const date = new Date().toISOString().split('T')[0]
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