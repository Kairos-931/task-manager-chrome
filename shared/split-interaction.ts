import { createResettableSubmissionGuard } from './quick-dates'
import { collectSplitChildren, getSplitChildRows, type SplitRowValue } from './split-scope'

export interface SplitTaskTriggerOptions {
  onOpen: (taskId: string) => void
}

/** Bind every task-level entry point that opens the split-task modal. */
export const bindSplitTaskTriggers = (
  container: HTMLElement,
  { onOpen }: SplitTaskTriggerOptions
): void => {
  container.querySelectorAll<HTMLElement>('.task-split, .overdue-split').forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const taskId = button.dataset.id
      if (taskId) onOpen(taskId)
    })
  })
}

export interface SplitTaskFormOptions {
  form: HTMLFormElement | null
  children: HTMLElement | null
  addButton: HTMLElement | null
  getTaskId: () => string | null
  createChildRow: (index: number) => HTMLElement | null
  splitTask: (taskId: string, children: SplitRowValue[]) => boolean
  onError: (message: string, field?: HTMLElement | null) => void
  onSuccess: (children: SplitRowValue[]) => Promise<boolean | void> | boolean | void
  onRowAdded?: (row: HTMLElement) => void
}

const reportInvalidChild = (
  rows: HTMLDivElement[],
  children: SplitRowValue[],
  onError: SplitTaskFormOptions['onError']
): boolean => {
  if (children.length < 2) {
    onError('至少保留两个子任务。')
    return true
  }

  const invalidChildIndex = children.findIndex(child =>
    !child.title ||
    !Number.isFinite(child.durationHours) ||
    child.durationHours < 0.5 ||
    child.durationHours > 24 ||
    Math.abs(child.durationHours * 2 - Math.round(child.durationHours * 2)) > Number.EPSILON
  )
  if (invalidChildIndex === -1) return false

  const invalidChild = children[invalidChildIndex]
  const invalidRow = rows[invalidChildIndex]
  const invalidField = !invalidChild?.title
    ? invalidRow?.querySelector<HTMLInputElement>('.split-child-title')
    : invalidRow?.querySelector<HTMLInputElement>('.split-child-duration')
  const message = !invalidChild?.title
    ? `请填写子任务 ${invalidChildIndex + 1} 的标题。`
    : `子任务 ${invalidChildIndex + 1} 的预计时间需为 0.5 至 24 小时，并以 0.5 小时递增。`
  onError(message, invalidField)
  return true
}

/** Bind add-row and submit behavior for the split-task modal. */
export const bindSplitTaskForm = ({
  form,
  children,
  addButton,
  getTaskId,
  createChildRow,
  splitTask,
  onError,
  onSuccess,
  onRowAdded
}: SplitTaskFormOptions): void => {
  const submitGuard = createResettableSubmissionGuard()

  const resetSubmitState = () => {
    submitGuard.reset()
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submitButton) submitButton.disabled = false
  }

  addButton?.addEventListener('click', () => {
    if (!children) return
    const row = createChildRow(getSplitChildRows(children).length)
    if (!row) return
    children.appendChild(row)
    onRowAdded?.(row)
    row.querySelector<HTMLInputElement>('.split-child-title')?.focus()
  })

  const submitSplitTask = async (event: Event): Promise<void> => {
    event.preventDefault()
    const taskId = getTaskId()
    if (!taskId || !children) return
    const rows = getSplitChildRows(children)
    const splitChildren = collectSplitChildren(children)
    if (reportInvalidChild(rows, splitChildren, onError)) return
    if (!submitGuard.trySubmit()) return
    if (!splitTask(taskId, splitChildren)) {
      submitGuard.reset()
      onError('该任务当前无法拆分，请确认它不是循环任务。')
      return
    }
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submitButton) submitButton.disabled = true
    const succeeded = await onSuccess(splitChildren)
    if (succeeded === false) {
      resetSubmitState()
      onError('拆分保存失败，请重试')
    }
  }

  form?.addEventListener('submit', (event) => {
    void submitSplitTask(event).catch(error => {
      resetSubmitState()
      console.error('[TaskMaster] split task submit failed:', error)
      onError('拆分保存失败，请重试')
    })
  })
}
