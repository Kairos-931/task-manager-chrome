import { bindSplitQuickDates, createResettableSubmissionGuard } from './quick-dates'
import type { SplitChildInput } from './task'

export interface SplitTaskSaveResult {
  applied: boolean
  saved: boolean
}

export interface SplitTaskModalOptions {
  modal: HTMLElement
  getSplittingTaskId: () => string | null
  renderChildRow: (index: number) => string
  persistChildren: (taskId: string, children: SplitChildInput[]) => Promise<SplitTaskSaveResult>
  onSaved: (children: SplitChildInput[]) => void
}

export const bindSplitTaskModalInteractions = ({
  modal,
  getSplittingTaskId,
  renderChildRow,
  persistChildren,
  onSaved,
}: SplitTaskModalOptions): void => {
  const form = modal.querySelector<HTMLFormElement>('#splitTaskForm')
  const childrenList = form?.querySelector<HTMLElement>('#splitChildren')
  const error = form?.querySelector<HTMLElement>('#splitTaskError')
  if (!form || !childrenList || !error) return

  const getRows = (): HTMLDivElement[] => [...childrenList.querySelectorAll<HTMLDivElement>('.split-child-row')]
  const showError = (message: string): void => {
    error.textContent = message
    error.classList.remove('hidden')
  }

  childrenList.addEventListener('click', event => {
    const target = event.target as HTMLElement
    const removeButton = target.closest('.remove-split-child')
    if (!removeButton || !childrenList.contains(removeButton)) return
    const row = removeButton.closest('.split-child-row')
    if (!row || !childrenList.contains(row)) return
    if (getRows().length <= 2) {
      showError('至少保留两个子任务。')
      return
    }
    row.remove()
  })

  form.querySelector<HTMLButtonElement>('#addSplitChildBtn')?.addEventListener('click', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = renderChildRow(getRows().length)
    const row = wrapper.firstElementChild as HTMLElement | null
    if (!row) return
    childrenList.appendChild(row)
    row.querySelector<HTMLInputElement>('.split-child-title')?.focus()
  })

  childrenList.addEventListener('click', event => {
    const target = event.target as HTMLElement
    const isDec = target.classList.contains('split-duration-decrease')
    const isInc = target.classList.contains('split-duration-increase')
    if (!isDec && !isInc) return
    const row = target.closest('.split-child-row')
    if (!row || !childrenList.contains(row)) return
    const input = row.querySelector<HTMLInputElement>('.split-child-duration')
    if (!input) return
    const current = Number.parseFloat(input.value) || 0
    const next = isDec ? Math.max(0, current - 0.5) : Math.min(24, current + 0.5)
    input.value = next > 0 ? next.toFixed(1) : ''
  })

  bindSplitQuickDates(childrenList)

  const submissionGuard = createResettableSubmissionGuard()
  form.addEventListener('submit', event => {
    event.preventDefault()
    void (async () => {
      const taskId = getSplittingTaskId()
      if (!taskId) {
        showError('当前拆分目标已失效，请关闭弹窗后重试。')
        return
      }

      error.textContent = ''
      error.classList.add('hidden')
      const rows = getRows()
      const rowValues = rows.map(row => {
        const titleInput = row.querySelector<HTMLInputElement>('.split-child-title')
        const durationInput = row.querySelector<HTMLInputElement>('.split-child-duration')
        const dateInput = row.querySelector<HTMLInputElement>('.split-child-date')
        const durationValue = durationInput?.value.trim() || ''
        const durationHours = durationInput ? (durationValue ? Number.parseFloat(durationValue) : 0) : Number.NaN
        return {
          row,
          child: {
            id: row.dataset.childId,
            title: titleInput?.value.trim() || '',
            durationHours,
            duration: Math.round(durationHours * 60),
            dueDate: dateInput?.value || '',
          },
        }
      })
      if (rowValues.length < 2) {
        showError('至少保留两个子任务。')
        return
      }

      const invalidIndex = rowValues.findIndex(({ child }) =>
        !child.title ||
        !Number.isFinite(child.durationHours) ||
        child.durationHours < 0 ||
        child.durationHours > 24 ||
        Math.abs(child.durationHours * 2 - Math.round(child.durationHours * 2)) > Number.EPSILON
      )
      if (invalidIndex !== -1) {
        const invalid = rowValues[invalidIndex]
        const invalidTitle = !invalid.child.title
        const invalidField = invalid.row.querySelector<HTMLInputElement>(invalidTitle ? '.split-child-title' : '.split-child-duration')
        showError(invalidTitle
          ? `请填写子任务 ${invalidIndex + 1} 的标题。`
          : `子任务 ${invalidIndex + 1} 的预计时间需为 0 至 24 小时，并以 0.5 小时递增；可留空。`)
        invalidField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        invalidField?.focus()
        return
      }
      if (!submissionGuard.trySubmit()) return

      const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
      if (submitButton) submitButton.disabled = true
      const children = rowValues.map(({ child }) => ({
        id: child.id,
        title: child.title,
        duration: child.duration,
        dueDate: child.dueDate,
      }))
      let result: SplitTaskSaveResult
      try {
        result = await persistChildren(taskId, children)
      } catch {
        result = { applied: true, saved: false }
      }

      if (!result.applied) {
        submissionGuard.reset()
        if (submitButton) submitButton.disabled = false
        showError('该任务当前无法拆分，请确认它不是循环任务。')
        return
      }
      if (!result.saved) {
        submissionGuard.reset()
        if (submitButton) submitButton.disabled = false
        showError('拆分保存失败，填写内容已保留，请重试。')
        return
      }
      onSaved(children)
    })()
  })
}
