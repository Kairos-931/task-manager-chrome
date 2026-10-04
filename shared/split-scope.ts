export const getSplitChildRows = (splitChildren: HTMLElement | null): HTMLDivElement[] => {
  return splitChildren ? [...splitChildren.querySelectorAll<HTMLDivElement>(':scope > .split-child-row')] : []
}

export interface SplitRowValue { id?: string; title: string; durationHours: number; duration: number; dueDate: string }

export const collectSplitChildren = (splitChildren: HTMLElement | null): SplitRowValue[] => getSplitChildRows(splitChildren).map(row => {
  const durationHours = Number.parseFloat(row.querySelector<HTMLInputElement>('.split-child-duration')?.value || '0')
  return {
    id: row.dataset.childId,
    title: (row.querySelector<HTMLInputElement>('.split-child-title')?.value || '').trim(),
    durationHours,
    duration: Math.round(durationHours * 60),
    dueDate: row.querySelector<HTMLInputElement>('.split-child-date')?.value || ''
  }
})
