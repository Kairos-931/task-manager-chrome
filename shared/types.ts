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
  completedAt?: number
  createdAt: number
  noTimeLimit: boolean
}

interface Category {
  id: string
  name: string
  color: string
}

interface StorageData {
  tasks: Task[]
  categories: Category[]
  hideCompleted: boolean
  hideOverdue: boolean
  showNoTimeLimitOnly: boolean
  darkMode?: boolean
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
