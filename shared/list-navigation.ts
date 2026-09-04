export const insertTodayDate = (dates: string[], today: string): string[] => {
  if (dates.includes(today)) return dates
  const dated = dates.filter(date => date !== 'no-date')
  const pool = dates.includes('no-date') ? ['no-date'] : []
  return [...dated.filter(date => date < today), today, ...dated.filter(date => date > today), ...pool]
}

export const isAnchorVisible = (rect: Pick<DOMRect, 'top' | 'bottom'>, viewportHeight: number): boolean => rect.top >= 0 && rect.bottom <= viewportHeight

export const getTodayScrollBehavior = (reducedMotion: boolean): ScrollBehavior => reducedMotion ? 'auto' : 'smooth'
