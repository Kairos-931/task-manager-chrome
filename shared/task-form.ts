export type TaskEntryMode = 'normal' | 'parent'

const setSectionDisabled = (section: HTMLElement | null, disabled: boolean): void => {
  section?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input, textarea, select, button').forEach(control => {
    control.disabled = disabled
  })
}

export const applyTaskEntryMode = (taskForm: HTMLFormElement, mode: TaskEntryMode): void => {
  const normalFields = taskForm.querySelector<HTMLElement>('#normalTaskFields')
  const parentFields = taskForm.querySelector<HTMLElement>('#parentChildrenFields')
  const completedField = taskForm.querySelector<HTMLElement>('#taskCompletedField')
  setSectionDisabled(normalFields, mode === 'parent')
  setSectionDisabled(parentFields, mode !== 'parent')
  setSectionDisabled(completedField, mode === 'parent')
  normalFields?.classList.toggle('hidden', mode === 'parent')
  parentFields?.classList.toggle('hidden', mode !== 'parent')
  completedField?.classList.toggle('hidden', mode === 'parent')
  taskForm.querySelectorAll<HTMLElement>('[data-task-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.taskMode === mode)
  })
  const submit = taskForm.querySelector<HTMLButtonElement>('#taskSubmitBtn')
  if (submit) submit.textContent = mode === 'parent' ? '创建可拆分任务' : '添加'
}
