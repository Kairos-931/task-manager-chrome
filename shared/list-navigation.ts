export const insertTodayDate = (dates: string[], today: string): string[] => {
  if (dates.includes(today)) return dates
  const dated = dates.filter(date => date !== 'no-date')
  const pool = dates.includes('no-date') ? ['no-date'] : []
  return [...dated.filter(date => date < today), today, ...dated.filter(date => date > today), ...pool]
}

export const isAnchorVisible = (rect: Pick<DOMRect, 'top' | 'bottom'>, viewportHeight: number): boolean => rect.top >= 0 && rect.bottom <= viewportHeight

export const shouldShowBackToTop = (scrollY: number, scrollHeight: number, viewportHeight: number, threshold = 48): boolean => scrollHeight > viewportHeight && scrollY > threshold

export const getTodayScrollBehavior = (reducedMotion: boolean): ScrollBehavior => reducedMotion ? 'auto' : 'smooth'

export interface ListNavigationOptions {
  backToTopButton: HTMLButtonElement | null
  jumpToTodayButton: HTMLButtonElement | null
  todayAnchor: HTMLElement | null
  scrollWindow: Window
  getScrollTop: () => number
  getScrollHeight: () => number
}

export const bindListNavigation = ({
  backToTopButton,
  jumpToTodayButton,
  todayAnchor,
  scrollWindow,
  getScrollTop,
  getScrollHeight,
}: ListNavigationOptions): (() => void) => {
  const updateVisibility = () => {
    if (backToTopButton) {
      backToTopButton.classList.toggle('hidden', !shouldShowBackToTop(getScrollTop(), getScrollHeight(), scrollWindow.innerHeight))
    }
    if (jumpToTodayButton) {
      const anchorVisible = todayAnchor ? isAnchorVisible(todayAnchor.getBoundingClientRect(), scrollWindow.innerHeight) : false
      jumpToTodayButton.classList.toggle('hidden', !todayAnchor || anchorVisible)
    }
  }
  const onScroll = () => updateVisibility()
  const getScrollBehavior = () => getTodayScrollBehavior(scrollWindow.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const onBackToTop = () => {
    scrollWindow.scrollTo({ top: 0, behavior: getScrollBehavior() })
  }
  const onJumpToToday = () => {
    if (!todayAnchor) return
    todayAnchor.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' })
    todayAnchor.classList.add('today-anchor-highlight')
    setTimeout(() => todayAnchor.classList.remove('today-anchor-highlight'), 1500)
    jumpToTodayButton?.classList.add('hidden')
  }

  scrollWindow.addEventListener('scroll', onScroll, { passive: true })
  backToTopButton?.addEventListener('click', onBackToTop)
  if (jumpToTodayButton && todayAnchor) jumpToTodayButton.addEventListener('click', onJumpToToday)
  updateVisibility()

  return () => {
    scrollWindow.removeEventListener('scroll', onScroll)
    backToTopButton?.removeEventListener('click', onBackToTop)
    if (jumpToTodayButton && todayAnchor) jumpToTodayButton.removeEventListener('click', onJumpToToday)
  }
}
