import type { StorageData, Category, Task } from './types'

export const STORAGE_KEY = 'task_manager_data'

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

// 检查数据是否为有效的 StorageData（有 tasks 数组和 categories 数组即可）
const isValidData = (data: unknown): data is StorageData => {
  return !!data && typeof data === 'object' && Array.isArray((data as StorageData).tasks) && Array.isArray((data as StorageData).categories)
}

// 从指定 storage area 读取数据
const readFromStorage = (area: typeof chrome.storage.sync | typeof chrome.storage.local): Promise<StorageData | null> => {
  return new Promise((resolve) => {
    area.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        try {
          const parsed = JSON.parse(result[STORAGE_KEY])
          resolve(isValidData(parsed) ? parsed : null)
        } catch {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    })
  })
}

// 写入到指定 storage area
const writeToStorage = (area: typeof chrome.storage.sync | typeof chrome.storage.local, data: StorageData): Promise<void> => {
  return new Promise((resolve, reject) => {
    area.set({ [STORAGE_KEY]: JSON.stringify(data) }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}

// 加载数据：local 为主存储，sync 用于接收其他设备的更新
export const loadData = async (): Promise<StorageData> => {
  const localData = await readFromStorage(chrome.storage.local)
  const syncData = await readFromStorage(chrome.storage.sync)

  const localHas = !!localData
  const syncHas = !!syncData
  console.warn('[TaskManager] loadData:', { localHas, syncHas, localTasks: localData?.tasks?.length, syncTasks: syncData?.tasks?.length })

  // 都有数据：优先用 sync（来自其他设备的最新更新），但备份到 local
  if (syncData && localData) {
    await writeToStorage(chrome.storage.local, syncData)
    return syncData
  }

  // 只有 sync（首次使用新版本，local 还没写过）：备份到 local
  if (syncData) {
    await writeToStorage(chrome.storage.local, syncData)
    return syncData
  }

  // 只有 local（sync 被另一台设备清空了）：恢复到 sync
  if (localData) {
    console.warn('[TaskManager] sync为空，从local恢复数据')
    await writeToStorage(chrome.storage.sync, localData)
    return localData
  }

  // 都没有：全新安装
  console.warn('[TaskManager] local和sync都为空，返回默认数据')
  return getDefaultData()
}

// 保存数据：双写 local + sync（local 先写，确保本地有备份）
export const saveData = async (data: StorageData): Promise<void> => {
  await writeToStorage(chrome.storage.local, data)
  await writeToStorage(chrome.storage.sync, data)
}

// 快捷方法：更新任务
export const updateTasks = async (tasks: Task[]): Promise<void> => {
  const data = await loadData()
  data.tasks = tasks
  await saveData(data)
}

// 快捷方法：更新分类
export const updateCategories = async (categories: Category[]): Promise<void> => {
  const data = await loadData()
  data.categories = categories
  await saveData(data)
}

// ==================== 数据导入/导出 ====================
export interface ExportData {
  version: string
  exportTime: string
  data: StorageData
}

// 导出数据为 JSON 字符串
export const exportData = async (): Promise<string> => {
  const data = await loadData()
  const exportObj: ExportData = {
    version: '1.0.0',
    exportTime: new Date().toISOString(),
    data
  }
  return JSON.stringify(exportObj, null, 2)
}

// 导出数据到文件（触发下载）
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

// 验证导入数据格式
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

// 从文件导入数据
export const importDataFromFile = async (file: File): Promise<{ success: boolean; error?: string; merged?: boolean }> => {
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
        
        // 直接覆盖当前数据
        await saveData(validation.data)
        resolve({ success: true, merged: false })
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
