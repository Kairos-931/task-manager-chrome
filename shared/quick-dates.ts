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
      refresh()
    })
  })
  taskModal.querySelector<HTMLInputElement>('input[name="dueDate"]')?.addEventListener('change', refresh)
  return refresh
}

export const bindSplitQuickDates = (splitTaskModal: HTMLElement): void => {
  splitTaskModal.addEventListener('click', event => {
    const target = event.target as HTMLElement
    const button = target.closest('.split-quick-dates .quick-date-btn') as HTMLElement | null
    const row = button?.closest('.split-child-row') as HTMLElement | null
    const input = row?.querySelector<HTMLInputElement>('.split-child-date')
    const date = button?.dataset.date
    if (!button || !row || !input || !date) return
    input.value = date
    row.querySelectorAll<HTMLElement>('.quick-date-btn').forEach(item => {
      const selected = item.dataset.date === date
      item.classList.toggle('selected', selected)
      item.setAttribute('aria-pressed', String(selected))
    })
  })
  splitTaskModal.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (!input.classList.contains('split-child-date')) return
    const row = input.closest('.split-child-row') as HTMLElement | null
    if (!row) return
    row.querySelectorAll<HTMLElement>('.quick-date-btn').forEach(button => {
      const selected = button.dataset.date === input.value
      button.classList.toggle('selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
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
