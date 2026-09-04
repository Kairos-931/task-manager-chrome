import type { Task, Category, StorageData, AppState, Priority } from './types'
import { generateId, getNextLocalSettingsUpdatedAt, loadData, saveData, syncIncrementally, defaultCategories, getSyncDeviceIdAsync } from './storage'
import { markCloudSynced, markLocalSave, markSaveComplete, markRemoteUpdated, markSyncError } from './sync'
import { isTaskDueOnDate } from './calendar'
import { getTaskProgress, isExecutableTask } from './planning'
export { getWeekDates, isTaskDueOnDate, isTaskCompletedOnDate, summarizeTaskDurationsForDates, shiftMonth } from './calendar'
export { getTaskProgress } from './planning'

// ==================== 工具函数 ====================
export const escapeHtml = (str: string): string => {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export const formatDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const parseDate = (s: string): Date => new Date(s + 'T00:00:00')

export const formatHours = (m: number): string => (m / 60).toFixed(1) + 'h'

export const getDateLabel = (d: string): string => {
  const today = formatDate(new Date())
  const tomorrow = formatDate(new Date(Date.now() + 86400000))
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  if (d === today) return '今天'
  if (d === tomorrow) return '明天'
  if (d === yesterday) return '昨天'
  const date = parseDate(d)
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 ${w}`
}

// 获取今天的日期字符串（YYYY-MM-DD）
export const getTodayStr = (): string => formatDate(new Date())

// ==================== 状态管理 ====================
let state: AppState = {
  tasks: [],
  categories: [],
  defaultCategory: '',
  hideCompleted: false,
  hideOverdue: false,
  showNoTimeLimitOnly: false,
  darkMode: false,
  editingTask: null,
  currentView: 'focus',
  currentDate: getTodayStr(),
  filterPriority: 'all',
  filterCategory: 'all',
  draggedTaskId: null,
  replanningTaskId: null,
  splittingTaskId: null,
  overdueCollapsed: true
}

export const getState = () => state
export const setState = (newState: Partial<AppState>) => {
  state = { ...state, ...newState }
}

type LocalSettingsUpdate = Partial<Pick<AppState,
  'defaultCategory' | 'hideCompleted' | 'hideOverdue' | 'darkMode' |
  'weeklyGoalMinutes' | 'weeklyGoalAnchor'
>>

export const setLocalSettings = (updates: LocalSettingsUpdate): void => {
  const changed = Object.entries(updates).some(([key, value]) =>
    state[key as keyof LocalSettingsUpdate] !== value
  )
  state = { ...state, ...updates }
  if (changed) {
    state.syncSettingsUpdatedAt = getNextLocalSettingsUpdatedAt(state.syncSettingsUpdatedAt)
  }
}

export const resetEditingTask = () => { state.editingTask = null }

export const getRemainingTime = (d: string, completed: boolean): string => {
  if (completed) return '已完成'
  const todayStr = getTodayStr()
  const tomorrowStr = formatDate(new Date(Date.now() + 86400000))
  
  if (d === todayStr) return '今天到期'
  if (d === tomorrowStr) return '明天到期'
  
  const date = parseDate(d)
  const today = parseDate(todayStr)
  const diff = date.getTime() - today.getTime()
  const days = Math.floor(diff / 86400000)
  
  if (days < 0) {
    const overdueDays = Math.abs(days)
    return overdueDays === 1 ? '已过期' : `已过期 ${overdueDays} 天`
  }
  return `${days} 天后到期`
}

export const isOverdue = (d: string, completed: boolean): boolean => {
  if (completed) return false
  const todayStr = getTodayStr()
  // 只有截止日期 < 今天 才算过期
  return d < todayStr
}

export const getPriorityColor = (p: Priority): string => {
  switch (p) {
    case 'high': return 'bg-red-500'
    case 'medium': return 'bg-yellow-500'
    case 'low': return 'bg-green-500'
  }
}

export const getCatColor = (id: string): string => {
  const c = state.categories.find(x => x.id === id)
  return c ? c.color : '#6b7280'
}

export const getCatName = (id: string): string => {
  const c = state.categories.find(x => x.id === id)
  return c ? c.name : ''
}

// ==================== 数据操作 ====================
interface ApplyStorageOptions {
  ignoreDeviceId?: string
}

const applyStorageData = (data: StorageData, _options?: ApplyStorageOptions): void => {
  const activeEditingTask = state.editingTask
  // Keep the original category id for existing task references while removing
  // duplicate names left by older versions of the sync implementation.
  const catMap = new Map<string, Category>()
  const cats = data.categories || defaultCategories
  for (const c of cats) {
    const normalized = { ...c, updatedAt: c.updatedAt || Date.now() }
    if (catMap.has(normalized.name)) {
      const existing = catMap.get(normalized.name)!
      catMap.set(normalized.name, { ...existing, color: normalized.color, updatedAt: normalized.updatedAt })
    } else {
      catMap.set(normalized.name, normalized)
    }
  }
  state = {
    ...state,
    ...data,
    showNoTimeLimitOnly: false,
    categories: [...catMap.values()],
    editingTask: activeEditingTask,
    draggedTaskId: null,
    replanningTaskId: null,
    splittingTaskId: null
  }
}

export const loadState = async (): Promise<void> => {
  const data = await loadData()
  applyStorageData(data)
  const deviceId = await getSyncDeviceIdAsync()
  syncIncrementally(data).then(result => {
    if (result.success && result.data) {
      applyStorageData(result.data, { ignoreDeviceId: deviceId })
      // Only a genuinely foreign update should refresh the app. Echoing this
      // device's own upload back would close popovers and reset the view.
      if (result.hasForeignChanges) markRemoteUpdated()
    }
  }).catch(() => {})
}

export const persistState = async (): Promise<void> => {
  markLocalSave()
  try {
    await saveData({
      tasks: state.tasks,
      categories: state.categories,
      defaultCategory: state.defaultCategory,
      hideCompleted: state.hideCompleted,
      hideOverdue: state.hideOverdue,
      showNoTimeLimitOnly: state.showNoTimeLimitOnly,
      darkMode: state.darkMode,
      weeklyGoalMinutes: state.weeklyGoalMinutes,
      weeklyGoalAnchor: state.weeklyGoalAnchor,
      syncSettingsUpdatedAt: state.syncSettingsUpdatedAt
    }, async (remoteData, options) => {
      const deviceId = options?.ignoreDeviceId ?? await getSyncDeviceIdAsync()
      applyStorageData(remoteData, { ignoreDeviceId: deviceId })
    }, (result) => {
      if (result.success) markCloudSynced()
      else if (result.error !== '未配置同步设置') markSyncError()
    })
    markSaveComplete()
  } catch {
    // markSaveComplete won't be called, sync status stays at saving
  }
}

export const getFilteredTasks = (): Task[] => {
  return state.tasks.filter(t => {
    if (state.hideCompleted && t.completed) return false
    if (state.hideOverdue && !t.noTimeLimit && t.dueDate < getTodayStr()) return false
    if (state.filterPriority !== 'all' && t.priority !== state.filterPriority) return false
    if (state.filterCategory !== 'all' && t.category !== state.filterCategory) return false
    return true
  }).sort((a, b) => {
    if (a.noTimeLimit !== b.noTimeLimit) return a.noTimeLimit ? 1 : -1
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    // 无期限任务按创建时间排序，有期限任务按截止日期排序
    if (a.noTimeLimit && b.noTimeLimit) return b.createdAt - a.createdAt
    return parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime()
  })
}

export const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'updatedAt' | 'completedDates' | 'repeatStartDate'>): void => {
  const now = Date.now()
  const newTask: Task = {
    ...task,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    completed: task.completed || false,
    completedDates: []
  }
  if (newTask.repeatType && newTask.repeatType !== 'none' && !newTask.noTimeLimit) {
    newTask.repeatStartDate = newTask.dueDate
  }
  state.tasks.push(newTask)
}

export const updateTask = (id: string, updates: Partial<Task>): void => {
  const idx = state.tasks.findIndex(t => t.id === id)
  if (idx !== -1) {
    state.tasks[idx] = { ...state.tasks[idx], ...updates, updatedAt: Date.now() }
  }
}

export const deleteTask = (id: string): void => {
  const task = state.tasks.find(t => t.id === id)
  state.tasks = task?.isParent
    ? state.tasks.filter(t => t.id !== id && t.parentId !== id)
    : state.tasks.filter(t => t.id !== id)
}

// 防止循环任务快速双击导致重复推进日期
let toggleThrottleMap: Map<string, number> = new Map()

export const toggleTask = (id: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (!task) return
  // 父任务：独立的手工完成状态，不受子任务影响，也没有循环推进逻辑
  if (task.isParent) {
    task.completed = !task.completed
    task.completedAt = task.completed ? Date.now() : undefined
    task.updatedAt = Date.now()
    // 标记父任务完成时，把所有未完成的子任务一并标记完成（非循环子任务）
    if (task.completed) {
      const now = Date.now()
      for (const child of state.tasks) {
        if (child.parentId !== id || child.completed || child.repeatType !== 'none') continue
        child.completed = true
        child.completedAt = now
        child.updatedAt = now
      }
    }
    return
  }
  if (!task.completed && task.repeatType && task.repeatType !== 'none') {
    // 防重入：500ms 内不重复 toggle 同一个循环任务
    const last = toggleThrottleMap.get(id) || 0
    if (Date.now() - last < 500) return
    toggleThrottleMap.set(id, Date.now())
    // Recurring task: record completion date, advance to next uncompleted
    const completedDate = task.dueDate
    if (!task.completedDates) task.completedDates = []
    if (!task.completedDates.includes(completedDate)) {
      task.completedDates.push(completedDate)
    }
    // Ensure repeatStartDate is set for existing tasks
    if (!task.repeatStartDate) {
      task.repeatStartDate = task.dueDate
    }
    task.dueDate = getNextUncompletedDate(task, completedDate)
    task.updatedAt = Date.now()
  } else {
    task.completed = !task.completed
    task.completedAt = task.completed ? Date.now() : undefined
    task.updatedAt = Date.now()
  }
}

export const moveTaskToDate = (id: string, date: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (task && !task.isParent) {
    task.dueDate = date
    task.noTimeLimit = false
    task.updatedAt = Date.now()
  }
}

const getNextUncompletedDate = (task: Task, afterDate?: string): string => {
  const completed = task.completedDates || []
  const after = afterDate ? parseDate(afterDate) : parseDate(getTodayStr())
  const start = new Date(after)
  start.setDate(start.getDate() + 1)
  for (let i = 0; i < 365; i++) {
    const candidate = new Date(start)
    candidate.setDate(candidate.getDate() + i)
    const dateStr = formatDate(candidate)
    if (isTaskDueOnDate(task, dateStr) && !completed.includes(dateStr)) {
      return dateStr
    }
  }
  return formatDate(start)
}

export const addCategory = (name: string, color: string): void => {
  const trimmed = name.trim()
  if (!trimmed) return
  if (state.categories.some(c => c.name === trimmed)) return
  state.categories.push({ id: generateId(), name: trimmed, color, updatedAt: Date.now() })
}

export const updateCategory = (id: string, name: string, color: string): void => {
  const cat = state.categories.find(c => c.id === id)
  if (cat) {
    cat.name = name
    cat.color = color
    cat.updatedAt = Date.now()
  }
}

export const toggleTaskOnDate = (id: string, date: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (!task || task.isParent) return
  if (!task.repeatType || task.repeatType === 'none') {
    toggleTask(id)
    return
  }

  if (!task.repeatStartDate) task.repeatStartDate = task.dueDate || date
  const completedDates = task.completedDates || []
  if (completedDates.includes(date)) {
    task.completedDates = completedDates.filter(completedDate => completedDate !== date)
    if (!task.dueDate || date < task.dueDate) task.dueDate = date
  } else {
    task.completedDates = [...completedDates, date]
    if (task.dueDate === date) task.dueDate = getNextUncompletedDate(task, date)
  }
  task.updatedAt = Date.now()
}

export const focusTaskToday = (id: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (!task || task.isParent) return
  const today = getTodayStr()
  task.dueDate = today
  task.noTimeLimit = false
  task.focusDate = today
  task.updatedAt = Date.now()
}

export const replanTask = (id: string, date: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (!task || task.isParent) return
  task.dueDate = date
  task.noTimeLimit = false
  task.focusDate = date === getTodayStr() ? date : undefined
  task.updatedAt = Date.now()
}

export const moveTaskToPool = (id: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (!task || task.isParent) return
  task.dueDate = ''
  task.noTimeLimit = true
  task.focusDate = undefined
  task.updatedAt = Date.now()
}

export interface SplitChildInput {
  title: string
  duration: number
  dueDate: string
  id?: string // 已有子任务 ID；用于继续编辑父任务时匹配更新而不是重复创建
}

export const splitTask = (id: string, children: SplitChildInput[]): boolean => {
  const task = state.tasks.find(t => t.id === id)
  const validChildren = children.filter(child => child.title.trim() && child.duration > 0 && child.dueDate)
  if (!task || task.repeatType !== 'none' || validChildren.length < 2) return false

  const now = Date.now()

  // 已是父任务：保留现有子任务，只更新已有行并追加新行（继续编辑场景）
  if (task.isParent) {
    const existingChildren = state.tasks.filter(t => t.parentId === id)
    for (const child of validChildren) {
      const match = child.id ? existingChildren.find(t => t.id === child.id) : undefined
      if (match) {
        match.title = child.title.trim()
        match.duration = child.duration
        match.dueDate = child.dueDate
        match.focusDate = child.dueDate === getTodayStr() ? getTodayStr() : undefined
        match.updatedAt = now
      } else {
        state.tasks.push({
          id: generateId(),
          title: child.title.trim(),
          description: '',
          priority: task.priority,
          category: task.category,
          dueDate: child.dueDate,
          hardDeadline: task.hardDeadline,
          focusDate: child.dueDate === getTodayStr() ? getTodayStr() : undefined,
          duration: child.duration,
          repeatType: 'none',
          repeatDays: [],
          repeatInterval: 1,
          completed: false,
          completedDates: [],
          createdAt: now,
          updatedAt: now,
          noTimeLimit: false,
          parentId: task.id
        })
      }
    }
    return true
  }

  // 首次拆分：把原任务转换为父任务并创建子任务
  task.isParent = true
  task.duration = 0
  task.completed = false
  task.completedAt = undefined
  task.completedDates = []
  task.repeatType = 'none'
  task.repeatDays = []
  task.repeatInterval = 1
  task.repeatStartDate = undefined
  task.noTimeLimit = true
  task.dueDate = ''
  task.focusDate = undefined
  task.updatedAt = now

  for (const child of validChildren) {
    const childDate = child.dueDate
    state.tasks.push({
      id: generateId(),
      title: child.title.trim(),
      description: '',
      priority: task.priority,
      category: task.category,
      dueDate: childDate,
      hardDeadline: task.hardDeadline,
      focusDate: childDate === getTodayStr() ? getTodayStr() : undefined,
      duration: child.duration,
      repeatType: 'none',
      repeatDays: [],
      repeatInterval: 1,
      completed: false,
      completedDates: [],
      createdAt: now,
      updatedAt: now,
      noTimeLimit: false,
      parentId: task.id
    })
  }
  return true
}

export const deleteCategory = (id: string): void => {
  if (state.categories.length > 1) {
    const fallback = state.categories.find(category => category.id !== id)
    if (!fallback) return
    const now = Date.now()
    state.tasks = state.tasks.map(task => task.category === id
      ? { ...task, category: fallback.id, updatedAt: now }
      : task)
    state.categories = state.categories.filter(c => c.id !== id)
    if (state.defaultCategory === id) state.defaultCategory = fallback.id
    if (state.filterCategory === id) state.filterCategory = 'all'
  }
}

export interface WeeklyGoalStats {
  anchorDate: string
  weeksElapsed: number
  weeklyGoalMinutes: number
  expectedMinutes: number
  actualMinutes: number
  completedCount: number
  paceMinutesPerWeek: number
  gapMinutes: number
  gapWeeks: number
  progressPercent: number
  behindExpected: boolean
}

export const getWeeklyGoalStats = (): WeeklyGoalStats | null => {
  const { weeklyGoalMinutes = 600, weeklyGoalAnchor } = state

  // 锚点：优先用设置值，没有则取最早完成日期
  let anchor = weeklyGoalAnchor
  if (!anchor) {
    let earliest = Infinity
    for (const t of state.tasks) {
      if (!isExecutableTask(t)) continue
      if (t.completed && (!t.repeatType || t.repeatType === 'none')) {
        const date = t.completedAt || parseDate(t.dueDate).getTime()
        if (date < earliest) earliest = date
      }
      if (t.repeatType && t.repeatType !== 'none' && t.completedDates?.length > 0) {
        const firstDate = parseDate(t.completedDates[0]).getTime()
        if (firstDate < earliest) earliest = firstDate
      }
    }
    if (earliest === Infinity) return null
    anchor = formatDate(new Date(earliest))
  }

  const anchorMs = parseDate(anchor).getTime()
  const nowMs = Date.now()
  const weeksElapsed = Math.max(0.1, (nowMs - anchorMs) / (7 * 86400000))

  // 统计已完成任务时长
  let totalMinutes = 0
  let completedCount = 0
  for (const t of state.tasks) {
    if (!isExecutableTask(t)) continue
    if (t.completed && (!t.repeatType || t.repeatType === 'none')) {
      totalMinutes += t.duration
      completedCount++
    }
    if (t.repeatType && t.repeatType !== 'none' && t.completedDates?.length > 0) {
      totalMinutes += t.duration * t.completedDates.length
      completedCount += t.completedDates.length
    }
  }

  const expectedMinutes = Math.round(weeklyGoalMinutes * weeksElapsed)
  const pace = Math.round((totalMinutes / weeksElapsed) * 10) / 10
  const gap = totalMinutes - expectedMinutes
  const progress = expectedMinutes > 0 ? Math.min(100, Math.round((totalMinutes / expectedMinutes) * 100)) : 0

  return {
    anchorDate: anchor,
    weeksElapsed: Math.round(weeksElapsed * 10) / 10,
    weeklyGoalMinutes,
    expectedMinutes,
    actualMinutes: totalMinutes,
    completedCount,
    paceMinutesPerWeek: pace,
    gapMinutes: gap,
    gapWeeks: Math.round((Math.abs(gap) / weeklyGoalMinutes) * 10) / 10,
    progressPercent: progress,
    behindExpected: gap < 0
  }
}

export const getStats = () => {
  const tasks = getFilteredTasks().filter(isExecutableTask)
  const pending = tasks.filter(t => !t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)
  const done = tasks.filter(t => t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)
  const overdueCount = tasks.filter(t => !t.completed && !t.noTimeLimit && isOverdue(t.dueDate, false)).length
  const todayStr = formatDate(new Date())
  const todayTasks = tasks.filter(t => !t.noTimeLimit && isTaskDueOnDate(t, todayStr))
  const todayDone = todayTasks.filter(t => t.completed).length
  return { pending, done, overdueCount, todayTotal: todayTasks.length, todayDone }
}

export const getParentTaskProgress = (task: Task) => getTaskProgress(task, state.tasks)
