import type { Task } from './types'

export interface TaskProgress {
  completed: number
  total: number
  percent: number
}

export const isExecutableTask = (task: Task): boolean => !task.isParent

export const getTaskPoolTasks = (tasks: Task[]): Task[] => (
  tasks.filter(task => task.noTimeLimit && isExecutableTask(task))
)

export interface HistoricalOverdueFilters {
  hideOverdue: boolean
  showNoTimeLimitOnly: boolean
  priority: Task['priority'] | 'all'
  category: string | 'all'
}

export const getHistoricalOverdueTasks = (
  tasks: Task[],
  weekStart: string,
  filters: HistoricalOverdueFilters
): Task[] => tasks.filter(task => {
  if (!isExecutableTask(task) || task.completed || task.noTimeLimit || !task.dueDate || task.repeatType !== 'none' || task.dueDate >= weekStart) return false
  if (filters.showNoTimeLimitOnly || filters.hideOverdue) return false
  if (filters.priority !== 'all' && task.priority !== filters.priority) return false
  if (filters.category !== 'all' && task.category !== filters.category) return false
  return true
}).sort((first, second) => first.dueDate.localeCompare(second.dueDate))

export const getTaskProgress = (task: Task, tasks: Task[]): TaskProgress => {
  if (!task.isParent) {
    return { completed: task.completed ? 1 : 0, total: 1, percent: task.completed ? 100 : 0 }
  }
  const children = tasks.filter(child => child.parentId === task.id)
  const completed = children.filter(child => child.completed).length
  return {
    completed,
    total: children.length,
    percent: children.length > 0 ? Math.round((completed / children.length) * 100) : 0
  }
}
