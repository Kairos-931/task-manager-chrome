import type { Task, Category, AppState, Priority } from './types'
import { generateId, loadData, saveData, defaultCategories } from './storage'
import { markLocalSave, markSaveComplete } from './sync'

// ==================== 工具函数 ====================
export const escapeHtml = (str: string): string => {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export const formatDate = (d: Date): string => d.toISOString().split('T')[0]

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
  if (t.dueDate === d) return true
  const date = parseDate(d)
  const taskDate = parseDate(t.dueDate)
  switch (t.repeatType) {
    case 'daily': return date >= taskDate
    case 'weekly': return date >= taskDate && t.repeatDays.includes(date.getDay())
    case 'monthly': return date >= taskDate && date.getDate() === taskDate.getDate()
    case 'workdays': return date >= taskDate && date.getDay() >= 1 && date.getDay() <= 5
    case 'custom':
      if (date < taskDate) return false
      const daysDiff = Math.floor((date.getTime() - taskDate.getTime()) / 86400000)
      return daysDiff % t.repeatInterval === 0
    default: return d === t.dueDate
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
export const loadState = async (): Promise<void> => {
  const data = await loadData()
  state = {
    ...state,
    ...data,
    categories: data.categories || defaultCategories,
    editingTask: null,
    draggedTaskId: null
  }
}

export const persistState = async (): Promise<void> => {
  markLocalSave()
  try {
    await saveData({
      tasks: state.tasks,
      categories: state.categories,
      hideCompleted: state.hideCompleted,
      hideOverdue: state.hideOverdue,
      showNoTimeLimitOnly: state.showNoTimeLimitOnly,
      darkMode: state.darkMode
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

export const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt' | 'updatedAt'>): void => {
  const now = Date.now()
  state.tasks.push({
    ...task,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    completed: false
  })
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

export const toggleTask = (id: string): void => {
  const task = state.tasks.find(t => t.id === id)
  if (task) {
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

export const addCategory = (name: string, color: string): void => {
  state.categories.push({ id: generateId(), name, color })
}

export const updateCategory = (id: string, name: string, color: string): void => {
  const cat = state.categories.find(c => c.id === id)
  if (cat) {
    cat.name = name
    cat.color = color
  }
}

export const deleteCategory = (id: string): void => {
  if (state.categories.length > 1) {
    state.categories = state.categories.filter(c => c.id !== id)
    if (state.filterCategory === id) state.filterCategory = 'all'
  }
}

export const getStats = () => {
  const tasks = getFilteredTasks()
  const pending = tasks.filter(t => !t.completed).reduce((s, t) => s + t.duration, 0)
  const done = tasks.filter(t => t.completed).reduce((s, t) => s + t.duration, 0)
  const overdueCount = tasks.filter(t => !t.completed && !t.noTimeLimit && isOverdue(t.dueDate, false)).length
  const todayStr = formatDate(new Date())
  const todayTasks = tasks.filter(t => !t.noTimeLimit && isTaskDueOnDate(t, todayStr))
  const todayDone = todayTasks.filter(t => t.completed).length
  return { pending, done, overdueCount, todayTotal: todayTasks.length, todayDone }
}
