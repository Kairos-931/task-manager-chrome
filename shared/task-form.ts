import type { ViewMode } from './types'

export type TaskEntryMode = 'normal' | 'parent'

export const getTaskEntryDefault = (currentView: ViewMode, currentDate: string, today: string): { dueDate: string; noTimeLimit: boolean } => {
  if (currentView === 'pool') return { dueDate: '', noTimeLimit: true }
  return { dueDate: currentView === 'day' ? currentDate : today, noTimeLimit: false }
}

const setSectionDisabled = (section: HTMLElement | null, disabled: boolean): void => {
  section?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input, textarea, select, button').forEach(control => {
    control.disabled = disabled
  })
}

export const applyTaskEntryMode = (taskForm: HTMLFormElement, mode: TaskEntryMode): void => {
  const normalFields = taskForm.querySelector<HTMLElement>('#normalTaskFields')
  const normalAdvancedFields = taskForm.querySelector<HTMLElement>('#normalAdvancedFields')
  const taskMoreOptions = taskForm.querySelector<HTMLDetailsElement>('#taskMoreOptions')
  const parentFields = taskForm.querySelector<HTMLElement>('#parentChildrenFields')
  const completedField = taskForm.querySelector<HTMLElement>('#taskCompletedField')
  setSectionDisabled(normalFields, mode === 'parent')
  setSectionDisabled(normalAdvancedFields, mode === 'parent')
  setSectionDisabled(parentFields, mode !== 'parent')
  setSectionDisabled(completedField, mode === 'parent')
  normalFields?.classList.toggle('hidden', mode === 'parent')
  normalAdvancedFields?.classList.toggle('hidden', mode === 'parent')
  parentFields?.classList.toggle('hidden', mode !== 'parent')
  completedField?.classList.toggle('hidden', mode === 'parent')
  if (mode === 'parent' && taskMoreOptions) taskMoreOptions.open = true
  taskForm.querySelectorAll<HTMLElement>('[data-task-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.taskMode === mode)
  })
  const submit = taskForm.querySelector<HTMLButtonElement>('#taskSubmitBtn')
  if (submit) submit.textContent = mode === 'parent' ? '创建可拆分任务' : '添加'
}
