import { getFilteredTasks, getState, setState } from './task'
import type { Task } from './types'

export interface TaskLocation {
  task: Task
  hiddenByFilters: boolean
}

export const prepareTaskLocation = (taskId: string): TaskLocation | null => {
  const task = getState().tasks.find(item => item?.id === taskId)
  if (!task) return null

  const hiddenByFilters = !getFilteredTasks().some(item => item.id === taskId)
  setState({ currentView: 'list', taskLocatorId: taskId, showNoTimeLimitOnly: false })
  return { task, hiddenByFilters }
}

export const clearMissingTaskLocation = (): boolean => {
  const { taskLocatorId, tasks } = getState()
  if (!taskLocatorId || tasks.some(task => task?.id === taskLocatorId)) return false
  setState({ taskLocatorId: undefined })
  return true
}
