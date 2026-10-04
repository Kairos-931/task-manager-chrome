import type { Category, StorageData, Task } from './types'

export type ImportChoice = 'current' | 'file'
export type ImportChoices = Record<string, ImportChoice>

export interface ImportDeletionHistory {
  reliable: boolean
  tasks: Set<string>
  categories: Set<string>
  source: 'google' | 'local' | 'backup' | 'none'
}

export interface ImportValidation {
  valid: boolean
  error?: string
  data?: StorageData
  duplicateTasks?: number
  duplicateCategories?: number
  formatVersion?: number
  deletionHistory?: { complete: boolean; tasks: string[]; categories: string[] }
}

export interface ImportConflict<T> {
  id: string
  current: T
  file: T
  choice: ImportChoice
}

export interface ImportPlan {
  valid: boolean
  error?: string
  data?: StorageData
  tasks: {
    added: number
    updated: number
    skipped: number
    retained: number
    duplicates: number
    addedRecords: Task[]
    conflicts: ImportConflict<Task>[]
    deleted: Array<{ record: Task; restored: boolean }>
    blocked: Task[]
  }
  categories: {
    added: number
    updated: number
    skipped: number
    retained: number
    duplicates: number
    addedRecords: Category[]
    conflicts: ImportConflict<Category>[]
    deleted: Array<{ record: Category; restored: boolean }>
  }
}

const priorities = new Set(['high', 'medium', 'low'])
const repeatTypes = new Set(['none', 'daily', 'weekly', 'monthly', 'workdays', 'custom'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value && value.length <= 256

const validDateOnly = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return Number.isFinite(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const effectiveTask = (task: Task): Record<string, unknown> =>
  Object.fromEntries(Object.entries(task).filter(([key, value]) => key !== 'updatedAt' && value !== undefined))

const effectiveCategory = (category: Category): Record<string, unknown> =>
  Object.fromEntries(Object.entries(category).filter(([key, value]) => key !== 'updatedAt' && value !== undefined))

const sameTask = (left: Task, right: Task): boolean =>
  stableStringify(effectiveTask(left)) === stableStringify(effectiveTask(right))

const sameCategory = (left: Category, right: Category): boolean =>
  stableStringify(effectiveCategory(left)) === stableStringify(effectiveCategory(right))

const normalizeTask = (value: unknown): Task | null => {
  if (!isObject(value) || !validId(value.id) || typeof value.title !== 'string' || !value.title.trim()) return null
  if (value.description !== undefined && typeof value.description !== 'string') return null
  if (value.priority !== undefined && !priorities.has(String(value.priority))) return null
  if (value.category !== undefined && typeof value.category !== 'string') return null
  if (value.dueDate !== undefined && value.dueDate !== '' && !validDateOnly(value.dueDate)) return null
  if (value.hardDeadline !== undefined && value.hardDeadline !== '' && !validDateOnly(value.hardDeadline)) return null
  if (value.focusDate !== undefined && value.focusDate !== '' && !validDateOnly(value.focusDate)) return null
  if (!Number.isFinite(value.duration) || Number(value.duration) < 0) return null
  if (value.repeatType !== undefined && !repeatTypes.has(String(value.repeatType))) return null
  if (value.repeatInterval !== undefined && (!Number.isFinite(value.repeatInterval) || Number(value.repeatInterval) < 1)) return null
  if (value.repeatEndDate !== undefined && value.repeatEndDate !== '' && !validDateOnly(value.repeatEndDate)) return null
  if (value.completed !== undefined && typeof value.completed !== 'boolean') return null
  if (value.repeatStartDate !== undefined && value.repeatStartDate !== '' && !validDateOnly(value.repeatStartDate)) return null
  if (value.completedAt !== undefined && !Number.isFinite(value.completedAt)) return null
  if (value.createdAt !== undefined && !Number.isFinite(value.createdAt)) return null
  if (value.updatedAt !== undefined && !Number.isFinite(value.updatedAt)) return null
  if (value.noTimeLimit !== undefined && typeof value.noTimeLimit !== 'boolean') return null
  if (value.isParent !== undefined && typeof value.isParent !== 'boolean') return null
  if (value.parentId !== undefined && value.parentId !== '' && !validId(value.parentId)) return null

  const createdAt = Number.isFinite(value.createdAt) ? Number(value.createdAt) : 0
  const task: Task = {
    id: value.id,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    priority: priorities.has(String(value.priority)) ? value.priority as Task['priority'] : 'medium',
    category: typeof value.category === 'string' ? value.category : '',
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : '',
    duration: Number(value.duration),
    repeatType: repeatTypes.has(String(value.repeatType)) ? value.repeatType as Task['repeatType'] : 'none',
    repeatDays: Array.isArray(value.repeatDays)
      ? value.repeatDays.filter((day: unknown): day is number => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6)
      : [],
    repeatInterval: Number.isFinite(value.repeatInterval) ? Number(value.repeatInterval) : 1,
    completed: value.completed === true,
    completedDates: Array.isArray(value.completedDates)
      ? value.completedDates.filter((date: unknown): date is string => validDateOnly(date))
      : [],
    createdAt,
    updatedAt: Number.isFinite(value.updatedAt) ? Number(value.updatedAt) : createdAt,
    noTimeLimit: value.noTimeLimit === true || (!value.dueDate && value.noTimeLimit !== false),
  }

  if (typeof value.hardDeadline === 'string' && value.hardDeadline) task.hardDeadline = value.hardDeadline
  if (typeof value.focusDate === 'string' && value.focusDate) task.focusDate = value.focusDate
  if (typeof value.repeatEndDate === 'string' && value.repeatEndDate) task.repeatEndDate = value.repeatEndDate
  if (typeof value.repeatStartDate === 'string' && value.repeatStartDate) task.repeatStartDate = value.repeatStartDate
  if (Number.isFinite(value.completedAt)) task.completedAt = Number(value.completedAt)
  if (value.isParent === true) task.isParent = true
  if (typeof value.parentId === 'string' && value.parentId) task.parentId = value.parentId
  return task
}

const normalizeCategory = (value: unknown): Category | null => {
  if (!isObject(value) || !validId(value.id) || typeof value.name !== 'string' || !value.name.trim() || typeof value.color !== 'string' || !value.color.trim()) return null
  if (value.updatedAt !== undefined && !Number.isFinite(value.updatedAt)) return null
  return {
    id: value.id,
    name: value.name,
    color: value.color,
    ...(Number.isFinite(value.updatedAt) ? { updatedAt: Number(value.updatedAt) } : {}),
  }
}

const dedupeRecords = <T extends { id: string; updatedAt?: number }>(
  values: T[],
  same: (left: T, right: T) => boolean,
): { records: T[]; duplicates: number; error?: string } => {
  const byId = new Map<string, T>()
  let duplicates = 0
  for (const value of values) {
    const previous = byId.get(value.id)
    if (!previous) {
      byId.set(value.id, value)
    } else if (!same(previous, value)) {
      return { records: [], duplicates, error: `文件中 ID「${value.id}」重复但内容不同` }
    } else {
      duplicates++
      if ((value.updatedAt || 0) > (previous.updatedAt || 0)) byId.set(value.id, value)
    }
  }
  return { records: [...byId.values()], duplicates }
}

const validateBackupRelationships = (tasks: Task[]): string | undefined => {
  const tasksById = new Map(tasks.map(task => [task.id, task]))
  for (const task of tasks) {
    if (task.parentId && task.isParent) return `父任务「${task.title}」不能同时隶属于另一个父任务`
    if (task.parentId) {
      const parent = tasksById.get(task.parentId)
      if (parent && !parent.isParent) return `任务「${task.title}」引用的父任务「${parent.title}」不是父任务`
    }
  }

  for (const task of tasks) {
    const seen = new Set<string>([task.id])
    let parentId = task.parentId
    while (parentId) {
      if (seen.has(parentId)) return `父子关系存在循环：任务「${task.title}」`
      seen.add(parentId)
      parentId = tasksById.get(parentId)?.parentId
    }
  }
  return undefined
}

const cleanSettings = (value: Record<string, unknown>): Pick<StorageData,
  'defaultCategory' | 'hideCompleted' | 'hideOverdue' | 'showNoTimeLimitOnly' | 'darkMode' | 'weeklyGoalMinutes' | 'weeklyGoalAnchor'> => ({
  defaultCategory: typeof value.defaultCategory === 'string' ? value.defaultCategory : '',
  hideCompleted: value.hideCompleted === true,
  hideOverdue: value.hideOverdue === true,
  showNoTimeLimitOnly: value.showNoTimeLimitOnly === true,
  darkMode: value.darkMode === true,
  ...(Number.isFinite(value.weeklyGoalMinutes) ? { weeklyGoalMinutes: Number(value.weeklyGoalMinutes) } : {}),
  ...(typeof value.weeklyGoalAnchor === 'string' && validDateOnly(value.weeklyGoalAnchor) ? { weeklyGoalAnchor: value.weeklyGoalAnchor } : {}),
})

export const validateImportObject = (input: unknown): ImportValidation => {
  if (!isObject(input)) return { valid: false, error: '数据格式无效' }
  const exportObj = input
  const rawData = isObject(exportObj.data) ? exportObj.data : exportObj
  if (!Array.isArray(rawData.tasks)) return { valid: false, error: 'tasks 必须是数组' }
  if (!Array.isArray(rawData.categories)) return { valid: false, error: 'categories 必须是数组' }

  const tasks: Task[] = []
  for (let index = 0; index < rawData.tasks.length; index++) {
    const task = normalizeTask(rawData.tasks[index])
    if (!task) return { valid: false, error: `第 ${index + 1} 条任务结构无效或缺少有效 ID` }
    tasks.push(task)
  }
  const categories: Category[] = []
  for (let index = 0; index < rawData.categories.length; index++) {
    const category = normalizeCategory(rawData.categories[index])
    if (!category) return { valid: false, error: `第 ${index + 1} 个分类结构无效或缺少有效 ID` }
    categories.push(category)
  }

  const uniqueTasks = dedupeRecords(tasks, sameTask)
  if (uniqueTasks.error) return { valid: false, error: uniqueTasks.error }
  const uniqueCategories = dedupeRecords(categories, sameCategory)
  if (uniqueCategories.error) return { valid: false, error: uniqueCategories.error }
  const relationshipError = validateBackupRelationships(uniqueTasks.records)
  if (relationshipError) return { valid: false, error: relationshipError }

  let deletionHistory: ImportValidation['deletionHistory']
  if (exportObj.deletionHistory !== undefined) {
    if (!isObject(exportObj.deletionHistory) || typeof exportObj.deletionHistory.complete !== 'boolean' ||
        !Array.isArray(exportObj.deletionHistory.tasks) || !Array.isArray(exportObj.deletionHistory.categories) ||
        exportObj.deletionHistory.tasks.some(id => !validId(id)) || exportObj.deletionHistory.categories.some(id => !validId(id))) {
      return { valid: false, error: '删除历史元数据无效' }
    }
    deletionHistory = {
      complete: exportObj.deletionHistory.complete,
      tasks: [...new Set(exportObj.deletionHistory.tasks as string[])],
      categories: [...new Set(exportObj.deletionHistory.categories as string[])],
    }
  }

  const data: StorageData = {
    tasks: uniqueTasks.records,
    categories: uniqueCategories.records,
    ...cleanSettings(rawData),
  }
  return {
    valid: true,
    data,
    duplicateTasks: uniqueTasks.duplicates,
    duplicateCategories: uniqueCategories.duplicates,
    formatVersion: Number.isInteger(exportObj.formatVersion) ? Number(exportObj.formatVersion) : undefined,
    deletionHistory,
  }
}

const choiceFor = (choices: ImportChoices, type: 'task' | 'category', id: string): ImportChoice =>
  choices[`${type}:${id}`] === 'file' ? 'file' : 'current'

const cloneTaskForImport = (fileTask: Task, current?: Task, now = Date.now()): Task => ({
  ...fileTask,
  id: current?.id || fileTask.id,
  createdAt: current?.createdAt ?? fileTask.createdAt,
  updatedAt: now,
})

const cloneCategoryForImport = (fileCategory: Category, current?: Category, now = Date.now()): Category => ({
  ...fileCategory,
  id: current?.id || fileCategory.id,
  updatedAt: now,
})

const validateMergedRelationships = (data: StorageData, importedTaskIds: Set<string>): string | undefined => {
  const tasksById = new Map(data.tasks.map(task => [task.id, task]))
  const categoriesById = new Set(data.categories.map(category => category.id))
  for (const id of importedTaskIds) {
    const task = tasksById.get(id)
    if (!task) continue
    if (task.category && !categoriesById.has(task.category)) return `导入任务「${task.title}」的分类当前不存在`
    if (task.parentId) {
      const parent = tasksById.get(task.parentId)
      if (!parent || !parent.isParent) return `导入任务「${task.title}」的父任务无法保留，已阻止写入`
    }
    const seen = new Set<string>([task.id])
    let parentId = task.parentId
    while (parentId) {
      if (seen.has(parentId)) return `导入任务「${task.title}」会造成父子循环，已阻止写入`
      seen.add(parentId)
      parentId = tasksById.get(parentId)?.parentId
    }
  }
  return undefined
}

export const planImportMerge = (
  current: StorageData,
  fileData: StorageData,
  history: ImportDeletionHistory,
  choices: ImportChoices = {},
  restoreTaskIds: Set<string> = new Set(),
  restoreCategoryIds: Set<string> = new Set(),
  duplicateTasks = 0,
  duplicateCategories = 0,
  now = Date.now(),
): ImportPlan => {
  const emptyTaskStats: ImportPlan['tasks'] = {
    added: 0, updated: 0, skipped: duplicateTasks, retained: 0, duplicates: duplicateTasks,
    addedRecords: [], conflicts: [], deleted: [], blocked: [],
  }
  const emptyCategoryStats: ImportPlan['categories'] = {
    added: 0, updated: 0, skipped: duplicateCategories, retained: 0, duplicates: duplicateCategories,
    addedRecords: [], conflicts: [], deleted: [],
  }
  const currentTaskIds = new Set(current.tasks.map(task => task.id))
  const currentCategoryIdsForValidation = new Set(current.categories.map(category => category.id))
  const fileTaskIdsForValidation = new Set(fileData.tasks.map(task => task.id))
  const fileCategoryIdsForValidation = new Set(fileData.categories.map(category => category.id))
  for (const task of fileData.tasks) {
    if (task.category && !fileCategoryIdsForValidation.has(task.category) && !currentCategoryIdsForValidation.has(task.category)) {
      return { valid: false, error: `任务「${task.title}」引用了不存在的分类 ID「${task.category}」`, tasks: emptyTaskStats, categories: emptyCategoryStats }
    }
    if (task.parentId && !fileTaskIdsForValidation.has(task.parentId) && !currentTaskIds.has(task.parentId)) {
      return { valid: false, error: `任务「${task.title}」引用了不存在的父任务 ID「${task.parentId}」`, tasks: emptyTaskStats, categories: emptyCategoryStats }
    }
  }

  const currentCategories = new Map(current.categories.map(category => [category.id, category]))
  const mergedCategories = new Map(currentCategories)
  const categoryConflicts: ImportConflict<Category>[] = []
  const deletedCategories: ImportPlan['categories']['deleted'] = []
  let categoryAdded = 0
  let categoryUpdated = 0
  let categorySkipped = duplicateCategories
  let categoryRetained = 0
  const categoryFileIds = new Set(fileData.categories.map(category => category.id))

  for (const fileCategory of fileData.categories) {
    const local = currentCategories.get(fileCategory.id)
    if (!local && history.categories.has(fileCategory.id) && !restoreCategoryIds.has(fileCategory.id)) {
      deletedCategories.push({ record: fileCategory, restored: false })
      categorySkipped++
      continue
    }
    if (!local && history.categories.has(fileCategory.id)) deletedCategories.push({ record: fileCategory, restored: true })
    if (!local) {
      const imported = cloneCategoryForImport(fileCategory, undefined, now)
      mergedCategories.set(imported.id, imported)
      categoryAdded++
      continue
    }
    if (sameCategory(local, fileCategory)) {
      categorySkipped++
      continue
    }
    const choice = choiceFor(choices, 'category', fileCategory.id)
    categoryConflicts.push({ id: fileCategory.id, current: local, file: fileCategory, choice })
    if (choice === 'file') {
      mergedCategories.set(local.id, cloneCategoryForImport(fileCategory, local, now))
      categoryUpdated++
    } else {
      categoryRetained++
    }
  }
  for (const id of currentCategories.keys()) if (!categoryFileIds.has(id)) categoryRetained++

  const currentTasks = new Map(current.tasks.map(task => [task.id, task]))
  const fileTaskIds = new Set(fileData.tasks.map(task => task.id))
  const unavailableTaskIds = new Set<string>()
  const blockedByTombstone = new Set<string>()
  for (const fileTask of fileData.tasks) {
    if (!currentTasks.has(fileTask.id) && history.tasks.has(fileTask.id) && !restoreTaskIds.has(fileTask.id)) {
      unavailableTaskIds.add(fileTask.id)
      blockedByTombstone.add(fileTask.id)
    }
  }

  const currentCategoryIds = new Set(current.categories.map(category => category.id))
  for (const fileCategory of fileData.categories) {
    if (!mergedCategories.has(fileCategory.id) && !currentCategoryIds.has(fileCategory.id)) {
      for (const task of fileData.tasks) if (task.category === fileCategory.id && !currentTasks.has(task.id)) unavailableTaskIds.add(task.id)
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const task of fileData.tasks) {
      if (unavailableTaskIds.has(task.id) || !task.parentId) continue
      if (!currentTasks.has(task.parentId) && unavailableTaskIds.has(task.parentId)) {
        unavailableTaskIds.add(task.id)
        changed = true
      }
    }
  }

  const mergedTasks = new Map(currentTasks)
  const taskConflicts: ImportConflict<Task>[] = []
  const deletedTasks: ImportPlan['tasks']['deleted'] = []
  const blockedTasks: Task[] = []
  const importedTaskIds = new Set<string>()
  let taskAdded = 0
  let taskUpdated = 0
  let taskSkipped = duplicateTasks
  let taskRetained = 0

  for (const fileTask of fileData.tasks) {
    const local = currentTasks.get(fileTask.id)
    if (!local && history.tasks.has(fileTask.id) && !restoreTaskIds.has(fileTask.id)) {
      deletedTasks.push({ record: fileTask, restored: false })
      taskSkipped++
      continue
    }
    if (unavailableTaskIds.has(fileTask.id) && !local) {
      if (!blockedByTombstone.has(fileTask.id)) {
        taskSkipped++
        blockedTasks.push(fileTask)
      }
      continue
    }
    if (!local && history.tasks.has(fileTask.id)) deletedTasks.push({ record: fileTask, restored: true })
    if (!local) {
      const imported = cloneTaskForImport(fileTask, undefined, now)
      mergedTasks.set(imported.id, imported)
      importedTaskIds.add(imported.id)
      taskAdded++
      continue
    }
    if (sameTask(local, fileTask)) {
      taskSkipped++
      continue
    }
    const choice = choiceFor(choices, 'task', fileTask.id)
    taskConflicts.push({ id: fileTask.id, current: local, file: fileTask, choice })
    if (choice === 'file') {
      mergedTasks.set(local.id, cloneTaskForImport(fileTask, local, now))
      importedTaskIds.add(local.id)
      taskUpdated++
    } else {
      taskRetained++
    }
  }
  for (const id of currentTasks.keys()) if (!fileTaskIds.has(id)) taskRetained++

  const mergedData: StorageData = {
    ...current,
    tasks: [...mergedTasks.values()],
    categories: [...mergedCategories.values()],
  }
  const relationshipError = validateMergedRelationships(mergedData, importedTaskIds)
  return {
    valid: !relationshipError,
    ...(relationshipError ? { error: relationshipError } : {}),
    ...(relationshipError ? {} : { data: mergedData }),
    tasks: {
      added: taskAdded,
      updated: taskUpdated,
      skipped: taskSkipped,
      retained: taskRetained,
      duplicates: duplicateTasks,
      addedRecords: [...mergedTasks.values()].filter(task => importedTaskIds.has(task.id) && !currentTasks.has(task.id)),
      conflicts: taskConflicts,
      deleted: deletedTasks,
      blocked: blockedTasks,
    },
    categories: {
      added: categoryAdded,
      updated: categoryUpdated,
      skipped: categorySkipped,
      retained: categoryRetained,
      duplicates: duplicateCategories,
      addedRecords: [...mergedCategories.values()].filter(category => !currentCategories.has(category.id) && fileData.categories.some(fileCategory => fileCategory.id === category.id)),
      conflicts: categoryConflicts,
      deleted: deletedCategories,
    },
  }
}

export const importRecordKey = (type: 'task' | 'category', id: string): string => `${type}:${id}`
