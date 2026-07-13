// ==================== 类型定义 ====================
type Priority = 'high' | 'medium' | 'low'
type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'workdays' | 'custom'
type ViewMode = 'list' | 'day' | 'week' | 'month'

interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  category: string
  dueDate: string
  duration: number // 分钟
  repeatType: RepeatType
  repeatDays: number[]
  repeatInterval: number
  completed: boolean
  completedDates: string[] // 循环任务：记录每个实例的完成日期
  repeatStartDate?: string // 循环任务锚点日期，用于日历计算
  completedAt?: number
  createdAt: number
  updatedAt: number
  noTimeLimit: boolean
}

interface Category {
  id: string
  name: string
  color: string
  updatedAt?: number
}

interface StorageData {
  tasks: Task[]
  categories: Category[]
  defaultCategory: string
  hideCompleted: boolean
  hideOverdue: boolean
  showNoTimeLimitOnly: boolean
  darkMode?: boolean
  weeklyGoalMinutes?: number       // 每周目标时长（分钟），默认 600（10h）
  weeklyGoalAnchor?: string        // 锚点日期 YYYY-MM-DD
  syncSettingsUpdatedAt?: number   // 设置记录的增量同步时间戳
}

interface AppState extends StorageData {
  editingTask: Task | null
  currentView: ViewMode
  currentDate: string
  filterPriority: Priority | 'all'
  filterCategory: string | 'all'
  draggedTaskId: string | null
}

export type { Task, Category, StorageData, AppState, Priority, RepeatType, ViewMode }
