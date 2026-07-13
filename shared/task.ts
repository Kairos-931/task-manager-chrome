import type { Task, Category, StorageData, AppState, Priority } from './types'
import { generateId, loadData, saveData, syncIncrementally, defaultCategories } from './storage'
import { markCloudSynced, markLocalSave, markSaveComplete, markRemoteUpdated, markSyncError } from './sync'

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
  currentView: 'list',
  currentDate: getTodayStr(),
  filterPriority: 'all',
  filterCategory: 'all',
  draggedTaskId: null
}

export const getState = () => state
export const setState = (newState: Partial<AppState>) => {
  state = { ...state, ...newState }
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

export const isTaskDueOnDate = (t: Task, d: string): boolean => {
  if (t.noTimeLimit) return false
  // Non-recurring: exact date match only
  if (!t.repeatType || t.repeatType === 'none') {
    return t.dueDate === d
  }
  // Recurring: use repeatStartDate as anchor for calendar calculations
  const anchor = t.repeatStartDate || t.dueDate
  if (anchor === d) return true
  const date = parseDate(d)
  const anchorDate = parseDate(anchor)
  switch (t.repeatType) {
    case 'daily': return date >= anchorDate
    case 'weekly': return date >= anchorDate && (t.repeatDays || []).includes(date.getDay())
    case 'monthly': return date >= anchorDate && date.getDate() === anchorDate.getDate()
    case 'workdays': return date >= anchorDate && date.getDay() >= 1 && date.getDay() <= 5
    case 'custom':
      if (date < anchorDate) return false
      const daysDiff = Math.floor((date.getTime() - anchorDate.getTime()) / 86400000)
      return daysDiff % (t.repeatInterval || 1) === 0
    default: return anchor === d
  }
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
const applyStorageData = (data: StorageData): void => {
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
    categories: [...catMap.values()],
    editingTask: null,
    draggedTaskId: null
  }
}

export const loadState = async (): Promise<void> => {
  const data = await loadData()
  applyStorageData(data)
  syncIncrementally(data).then(result => {
    if (result.success && result.data) {
      applyStorageData(result.data)
      markRemoteUpdated()
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
    }, (remoteData) => {
      applyStorageData(remoteData)
      markRemoteUpdated()
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
    if (state.showNoTimeLimitOnly && !t.noTimeLimit) return false
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
  state.tasks = state.tasks.filter(t => t.id !== id)
}

// 防止循环任务快速双击导致重复推进日期
let toggleThrottleMap: Map<string, number> = new Map()

export const toggleTask = (id: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (!task) return
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
  if (task) {
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
  const tasks = getFilteredTasks()
  const pending = tasks.filter(t => !t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)
  const done = tasks.filter(t => t.completed && t.repeatType === 'none').reduce((s, t) => s + t.duration, 0)
  const overdueCount = tasks.filter(t => !t.completed && !t.noTimeLimit && isOverdue(t.dueDate, false)).length
  const todayStr = formatDate(new Date())
  const todayTasks = tasks.filter(t => !t.noTimeLimit && isTaskDueOnDate(t, todayStr))
  const todayDone = todayTasks.filter(t => t.completed).length
  return { pending, done, overdueCount, todayTotal: todayTasks.length, todayDone }
}
