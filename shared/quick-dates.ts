export const bindTaskQuickDates = (taskModal: HTMLElement): (() => void) => {
  const refresh = () => {
    const input = taskModal.querySelector<HTMLInputElement>('input[name="dueDate"]')
    if (!input) return
    taskModal.querySelectorAll<HTMLElement>('.quick-date-btn').forEach(button => {
      const selected = button.dataset.date === input.value
      button.classList.toggle('selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
  }
  taskModal.querySelectorAll<HTMLElement>('.quick-date-btn').forEach(button => {
    button.addEventListener('click', () => {
      const date = button.dataset.date
      const input = taskModal.querySelector<HTMLInputElement>('input[name="dueDate"]')
      if (!date || !input) return
      input.value = date
      input.dispatchEvent?.(new Event('change', { bubbles: true }))
      refresh()
    })
  })
  taskModal.querySelector<HTMLInputElement>('input[name="dueDate"]')?.addEventListener('change', refresh)
  return refresh
}

export const bindSplitQuickDates = (splitTaskModal: HTMLElement): void => {
  const syncSplitDateRow = (row: HTMLElement, date: string): void => {
    row.querySelectorAll<HTMLElement>('.quick-date-btn').forEach(button => {
      const selected = button.dataset.date === date
      button.classList.toggle('selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    const unscheduled = row.querySelector<HTMLButtonElement>('.split-child-unscheduled')
    const isUnscheduled = date.length === 0
    unscheduled?.classList.toggle('selected', isUnscheduled)
    unscheduled?.setAttribute('aria-pressed', String(isUnscheduled))
    const status = row.querySelector<HTMLElement>('.split-child-date-status')
    if (status) {
      status.dataset.dateState = isUnscheduled ? 'unscheduled' : 'scheduled'
      status.textContent = isUnscheduled ? '暂不安排 · 进入任务池' : `已安排 ${date}`
    }
  }

  splitTaskModal.addEventListener('click', event => {
    const target = event.target as HTMLElement
    const unscheduled = target.closest('.split-child-unscheduled') as HTMLElement | null
    const button = target.closest('.split-quick-dates .quick-date-btn') as HTMLElement | null
    const row = (unscheduled || button)?.closest('.split-child-row') as HTMLElement | null
    const input = row?.querySelector<HTMLInputElement>('.split-child-date')
    const date = button?.dataset.date
    if (!row || !input) return
    if (unscheduled) {
      input.value = ''
      syncSplitDateRow(row, '')
      return
    }
    if (!button || !date) return
    input.value = date
    syncSplitDateRow(row, date)
  })
  splitTaskModal.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (!input.classList.contains('split-child-date')) return
    const row = input.closest('.split-child-row') as HTMLElement | null
    if (!row) return
    syncSplitDateRow(row, input.value)
  })
}

export const createSubmissionGuard = (): (() => boolean) => {
  let submitted = false
  return () => {
    if (submitted) return false
    submitted = true
    return true
  }
}

export const createResettableSubmissionGuard = (): { trySubmit: () => boolean; reset: () => void } => {
  let submitting = false
  return {
    trySubmit: () => {
      if (submitting) return false
      submitting = true
      return true
    },
    reset: () => { submitting = false }
  }
}
