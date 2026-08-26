import type { Task } from './types'

const parseLocalDate = (date: string): Date => new Date(`${date}T00:00:00`)

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isTaskDueOnDate = (task: Task, dateString: string): boolean => {
  if (task.noTimeLimit || task.isParent) return false
  if (!task.repeatType || task.repeatType === 'none') return task.dueDate === dateString

  const anchor = task.repeatStartDate || task.dueDate
  if (anchor === dateString) return true
  const date = parseLocalDate(dateString)
  const anchorDate = parseLocalDate(anchor)
  switch (task.repeatType) {
    case 'daily': return date >= anchorDate
    case 'weekly': return date >= anchorDate && (task.repeatDays || []).includes(date.getDay())
    case 'monthly': return date >= anchorDate && date.getDate() === anchorDate.getDate()
    case 'workdays': return date >= anchorDate && date.getDay() >= 1 && date.getDay() <= 5
    case 'custom': {
      if (date < anchorDate) return false
      const daysDiff = Math.floor((date.getTime() - anchorDate.getTime()) / 86400000)
      return daysDiff % (task.repeatInterval || 1) === 0
    }
    default: return anchor === dateString
  }
}

export const isTaskCompletedOnDate = (task: Task, date: string): boolean => {
  if (task.repeatType && task.repeatType !== 'none') {
    return (task.completedDates || []).includes(date)
  }
  return task.completed
}

export const summarizeTaskDurationsForDates = (
  tasks: Task[],
  dates: string[]
): { pending: number; done: number } => {
  const uniqueDates = [...new Set(dates)]
  return uniqueDates.reduce((summary, date) => {
    for (const task of tasks) {
      if (!isTaskDueOnDate(task, date)) continue
      if (isTaskCompletedOnDate(task, date)) summary.done += task.duration
      else summary.pending += task.duration
    }
    return summary
  }, { pending: 0, done: 0 })
}

export const getWeekDates = (anchorDate: string): string[] => {
  const anchor = parseLocalDate(anchorDate)
  const monday = new Date(anchor)
  const weekday = anchor.getDay()
  monday.setDate(anchor.getDate() + (weekday === 0 ? -6 : 1 - weekday))

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return formatLocalDate(date)
  })
}

export const shiftMonth = (currentDate: string, offset: number): string => {
  const date = parseLocalDate(currentDate)
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return formatLocalDate(date)
}
