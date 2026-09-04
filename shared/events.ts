import type { Priority, Task, ViewMode } from './types'
import { getState, setState, setLocalSettings, resetEditingTask, formatDate, persistState, moveTaskToDate, loadState, shiftMonth } from './task'
import { toggleTask as toggleTaskAction, toggleTaskOnDate, deleteTask as deleteTaskAction, addTask, updateTask, addCategory, updateCategory, deleteCategory as deleteCategoryAction, focusTaskToday, replanTask, moveTaskToPool, splitTask } from './task'
import { renderApp, renderQuickDates } from './render'
import { downloadExportFile, importDataFromFile } from './storage'
import { showToast } from './sync'
import { bindTaskQuickDates, bindSplitQuickDates, createSubmissionGuard } from './quick-dates'

let draggedTaskId: string | null = null
let currentContainer: HTMLElement | null = null
let taskMenuDismissHandler: ((event: PointerEvent) => void) | null = null

const closePopupTaskMenus = (container: HTMLElement): void => {
  container.querySelectorAll<HTMLDetailsElement>('details.task-more-menu[open]').forEach(menu => {
    menu.open = false
    const popover = menu.querySelector<HTMLElement>('.task-more-popover')
    if (popover) popover.style.visibility = 'hidden'
  })
}

const positionPopupTaskMenu = (menu: HTMLDetailsElement): void => {
  const trigger = menu.querySelector<HTMLElement>('.task-more-trigger')
  const popover = menu.querySelector<HTMLElement>('.task-more-popover')
  if (!trigger || !popover) return

  // Fixed positioning lets the menu escape rounded list panels with
  // overflow:hidden. Measure after opening, then keep it inside the Popup
  // viewport for first, middle, last, and edge-adjacent rows.
  popover.style.position = 'fixed'
  popover.style.visibility = 'hidden'
  popover.style.left = '0px'
  popover.style.top = '0px'
  const triggerRect = trigger.getBoundingClientRect()
  const menuRect = popover.getBoundingClientRect()
  const margin = 8
  const gap = 4
  const maxLeft = Math.max(margin, window.innerWidth - menuRect.width - margin)
  const left = Math.min(Math.max(margin, triggerRect.right - menuRect.width), maxLeft)
  const fitsBelow = triggerRect.bottom + gap + menuRect.height <= window.innerHeight - margin
  const preferredTop = fitsBelow
    ? triggerRect.bottom + gap
    : triggerRect.top - menuRect.height - gap
  const maxTop = Math.max(margin, window.innerHeight - menuRect.height - margin)
  const top = Math.min(Math.max(margin, preferredTop), maxTop)
  popover.style.left = `${Math.round(left)}px`
  popover.style.top = `${Math.round(top)}px`
  popover.style.visibility = 'visible'
}

const bindPopupTaskMenus = (container: HTMLElement): void => {
  if (!window.location.pathname.includes('popup')) return

  taskMenuDismissHandler && document.removeEventListener('pointerdown', taskMenuDismissHandler)
  taskMenuDismissHandler = (event: PointerEvent) => {
    const target = event.target as Node | null
    if (target && (target as Element).closest?.('.task-more-menu')) return
    closePopupTaskMenus(container)
  }
  document.addEventListener('pointerdown', taskMenuDismissHandler)

  const menus = [...container.querySelectorAll<HTMLDetailsElement>('details.task-more-menu')]
  menus.forEach(menu => {
    menu.addEventListener('toggle', () => {
      const popover = menu.querySelector<HTMLElement>('.task-more-popover')
      if (!menu.open) {
        if (popover) popover.style.visibility = 'hidden'
        return
      }
      menus.filter(other => other !== menu).forEach(other => { other.open = false })
      positionPopupTaskMenu(menu)
    })
  })
}

// 同步面板内联反馈
function showSyncFeedback(container: HTMLElement, message: string, type: 'success' | 'error' | 'info' = 'success') {
  const el = container.querySelector('#syncFeedback') as HTMLElement
  if (!el) return
  const colors: Record<string, string> = {
    success: 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;',
    error: 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca;',
    info: 'background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;',
  }
  el.style.cssText = `margin:0 24px 0;padding:8px 12px;border-radius:8px;font-size:12px;display:block;${colors[type]}`
  el.textContent = message
}

// 同步操作反馈 toast（inline styles，不依赖 Tailwind 编译）
function syncToast(message: string, type: 'success' | 'error' = 'success') {
  document.querySelectorAll('.sync-action-toast').forEach(el => el.remove())
  const toast = document.createElement('div')
  toast.className = 'sync-action-toast'
  const bgColor = type === 'success' ? '#22c55e' : '#ef4444'
  toast.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);padding:0.75rem 1.5rem;border-radius:0.75rem;box-shadow:0 10px 25px rgba(0,0,0,0.15);color:#fff;font-size:0.875rem;font-weight:500;z-index:10000;background:${bgColor};transition:opacity 0.3s;white-space:nowrap;`
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// 封装渲染和事件绑定
function reRender() {
  if (!currentContainer) return
  renderApp(currentContainer)
  attachEventListeners(currentContainer)
}

export const attachEventListeners = (container: HTMLElement): void => {
  currentContainer = container
  bindPopupTaskMenus(container)
  
  // 添加任务按钮
  container.querySelector('#addTaskBtn')?.addEventListener('click', () => {
    resetEditingTask()
    reRender()
    const modal = container.querySelector('#taskModal') as HTMLElement
    modal?.classList.remove('hidden')
    container.querySelector<HTMLInputElement>('input[name="title"]')?.focus()
  })

  // 新标签页打开
  container.querySelector('#openFullPage')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openNewTab' })
  })

  // 深色模式切换
  container.querySelector('#darkModeBtn')?.addEventListener('click', async () => {
    const { darkMode } = getState()
    setLocalSettings({ darkMode: !darkMode })
    await persistState()
    reRender()
  })

  container.querySelector('#toggleFiltersBtn')?.addEventListener('click', (e) => {
    const button = e.currentTarget as HTMLButtonElement
    const filters = container.querySelector('#taskFilters') as HTMLElement | null
    if (!filters) return
    const expanded = filters.classList.contains('hidden')
    filters.classList.toggle('hidden', !expanded)
    button.setAttribute('aria-expanded', String(expanded))
    button.title = expanded ? '收起筛选' : '展开筛选'
  })

  // 视图切换
  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = (e.currentTarget as HTMLElement).dataset.view as ViewMode
      setState({ currentView: view, showNoTimeLimitOnly: false })
      reRender()
    })
  })

  // 筛选器
  container.querySelector('#filterPriority')?.addEventListener('change', async (e) => {
    setState({ filterPriority: (e.target as HTMLSelectElement).value as Priority | 'all' })
    await persistState()
    reRender()
  })

  container.querySelector('#filterCategory')?.addEventListener('change', async (e) => {
    setState({ filterCategory: (e.target as HTMLSelectElement).value })
    await persistState()
    reRender()
  })

  container.querySelector('#hideCompleted')?.addEventListener('change', async (e) => {
    setLocalSettings({ hideCompleted: (e.target as HTMLInputElement).checked })
    await persistState()
    reRender()
  })

  container.querySelector('#hideOverdue')?.addEventListener('change', async (e) => {
    setLocalSettings({ hideOverdue: (e.target as HTMLInputElement).checked })
    await persistState()
    reRender()
  })

  // 日期导航 - 日视图
  container.querySelector('#prevDay')?.addEventListener('click', () => {
    const { currentDate } = getState()
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    setState({ currentDate: formatDate(d) })
    reRender()
  })

  container.querySelector('#nextDay')?.addEventListener('click', () => {
    const { currentDate } = getState()
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    setState({ currentDate: formatDate(d) })
    reRender()
  })

  container.querySelector('#goTodayDay')?.addEventListener('click', () => {
    setState({ currentDate: formatDate(new Date()) })
    reRender()
  })

  // 日期导航 - 周视图
  container.querySelector('#prevWeek')?.addEventListener('click', () => {
    const { currentDate } = getState()
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setState({ currentDate: formatDate(d) })
    reRender()
  })

  container.querySelector('#nextWeek')?.addEventListener('click', () => {
    const { currentDate } = getState()
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setState({ currentDate: formatDate(d) })
    reRender()
  })

  container.querySelector('#goTodayWeek')?.addEventListener('click', () => {
    setState({ currentDate: formatDate(new Date()) })
    reRender()
  })

  // 日期导航 - 月视图
  container.querySelector('#prevMonth')?.addEventListener('click', () => {
    const { currentDate } = getState()
    setState({ currentDate: shiftMonth(currentDate, -1) })
    reRender()
  })

  container.querySelector('#toggleOverdueSection')?.addEventListener('click', () => {
    setState({ overdueCollapsed: !getState().overdueCollapsed })
    reRender()
  })

  container.querySelector('#nextMonth')?.addEventListener('click', () => {
    const { currentDate } = getState()
    setState({ currentDate: shiftMonth(currentDate, 1) })
    reRender()
  })

  // 任务操作
  container.querySelectorAll('.task-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = (e.currentTarget as HTMLElement).dataset.taskId
      if (id) {
        const date = (e.currentTarget as HTMLElement).dataset.taskDate
        if (date) toggleTaskOnDate(id, date)
        else toggleTaskAction(id)
        await persistState()
        reRender()
      }
    })
  })

  container.querySelectorAll('.task-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (e.currentTarget as HTMLElement).dataset.id
      if (id) {
        const task = getState().tasks.find(t => t.id === id)
        if (task) {
          setState({ editingTask: task })
          reRender()
          const modal = container.querySelector('#taskModal') as HTMLElement
          modal?.classList.remove('hidden')
        }
      }
    })
  })

  container.querySelectorAll('.task-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = (e.currentTarget as HTMLElement).dataset.id
      const task = id ? getState().tasks.find(item => item.id === id) : undefined
      const message = task?.isParent ? '确定删除此父任务及其全部子任务？' : '确定删除此任务？'
      if (id && confirm(message)) {
        deleteTaskAction(id)
        await persistState()
        reRender()
      }
    })
  })

  // 任务表单提交
  const taskForm = container.querySelector('#taskForm') as HTMLFormElement
  taskForm?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const { editingTask } = getState()

    const commonData = {
      title: (formData.get('title') as string).trim(),
      description: formData.get('description') as string,
      priority: formData.get('priority') as Priority,
      category: formData.get('category') as string,
      hardDeadline: (formData.get('hardDeadline') as string) || undefined
    }

    if (editingTask?.isParent) {
      const parentCompleted = (form.querySelector('#taskCompleted') as HTMLInputElement)?.checked || false
      updateTask(editingTask.id, {
        ...commonData,
        completed: parentCompleted,
        completedAt: parentCompleted ? (editingTask.completedAt ?? Date.now()) : undefined
      })
      // 勾选父任务完成时，同步把所有未完成的非循环子任务标记完成
      if (parentCompleted && !editingTask.completed) {
        const now = Date.now()
        for (const child of getState().tasks) {
          if (child.parentId !== editingTask.id || child.completed || child.repeatType !== 'none') continue
          child.completed = true
          child.completedAt = now
          child.updatedAt = now
        }
      }
      await persistState()
      resetEditingTask()
      reRender()
      return
    }

    const noTimeLimit = (form.querySelector('#noTimeLimit') as HTMLInputElement)?.checked || false
    const repeatDays: number[] = []
    form.querySelectorAll('[name="repeatDays"]:checked').forEach(cb => {
      repeatDays.push(parseInt((cb as HTMLInputElement).value))
    })
    const durationInput = form.querySelector('#durationInput') as HTMLInputElement
    const duration = Math.round(parseFloat(durationInput?.value || '1') * 60) || 60
    const repeatType = formData.get('repeatType') as Task['repeatType']
    const dueDate = noTimeLimit ? '' : (formData.get('dueDate') as string)

    const taskData = {
      ...commonData,
      dueDate,
      focusDate: dueDate === formatDate(new Date()) ? dueDate : undefined,
      duration,
      completed: (form.querySelector('#taskCompleted') as HTMLInputElement)?.checked || false,
      repeatType,
      repeatDays,
      repeatInterval: parseInt(formData.get('repeatInterval') as string) || 1,
      noTimeLimit,
    }
    
    if (editingTask) {
      updateTask(editingTask.id, taskData)
    } else {
      addTask(taskData)
    }
    await persistState()
    resetEditingTask()
    reRender()
  })

  // 模态框关闭
  let taskFormDirty = false
  taskForm?.addEventListener('input', () => {
    taskFormDirty = true
  })

  container.querySelectorAll('.task-focus-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = (e.currentTarget as HTMLElement).dataset.id
      if (!id) return
      focusTaskToday(id)
      await persistState()
      reRender()
    })
  })

  container.querySelectorAll('.overdue-focus').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id
      if (!id) return
      focusTaskToday(id)
      await persistState()
      reRender()
      showToast(container, '已加入今日聚焦', 'success')
    })
  })

  container.querySelectorAll('.overdue-complete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id
      if (!id) return
      toggleTaskAction(id)
      await persistState()
      reRender()
      showToast(container, '任务已完成', 'success')
    })
  })

  container.querySelectorAll('.pool-focus').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id
      if (!id) return
      focusTaskToday(id)
      await persistState()
      reRender()
      showToast(container, '已安排到今天', 'success')
    })
  })

  container.querySelectorAll('.week-plan-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = (btn as HTMLElement).dataset.id
      if (!taskId) return
      const picker = container.querySelector(`.week-day-picker[data-id="${taskId}"]`) as HTMLElement | null
      if (!picker) return
      const willOpen = picker.classList.contains('hidden')
      container.querySelectorAll('.week-day-picker').forEach(other => other.classList.add('hidden'))
      container.querySelectorAll('.week-plan-toggle').forEach(other => other.setAttribute('aria-expanded', 'false'))
      picker.classList.toggle('hidden', !willOpen)
      btn.setAttribute('aria-expanded', String(willOpen))
    })
  })

  container.querySelectorAll('.week-plan-date').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = (btn as HTMLElement).dataset.id
      const date = (btn as HTMLElement).dataset.date
      if (!taskId || !date) return
      replanTask(taskId, date)
      await persistState()
      reRender()
      showToast(container, `已安排到 ${date}`, 'success')
    })
  })

  container.querySelectorAll('.overdue-replan').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id
      if (!id) return
      setState({ replanningTaskId: id })
      reRender()
    })
  })

  container.querySelectorAll('.overdue-split').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id
      if (!id) return
      setState({ splittingTaskId: id })
      reRender()
    })
  })

  container.querySelectorAll('.task-split').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.id
      if (!id) return
      setState({ splittingTaskId: id })
      reRender()
    })
  })

  container.querySelectorAll('.overdue-pool').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id
      if (!id) return
      moveTaskToPool(id)
      await persistState()
      reRender()
      showToast(container, '已放回任务池', 'success')
    })
  })

  const closeReplanModal = () => {
    setState({ replanningTaskId: null })
    reRender()
  }
  container.querySelector('#cancelReplanBtn')?.addEventListener('click', closeReplanModal)
  container.querySelector('#closeReplanBtn')?.addEventListener('click', closeReplanModal)
  container.querySelector('#replanModal')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      e.preventDefault()
      closeReplanModal()
    }
  })
  const popupReplan = window.location.pathname.includes('popup')
  let replanSubmitting = false
  const replanDateInput = container.querySelector<HTMLInputElement>('#replanDate')
  const replanConfirmButton = container.querySelector<HTMLButtonElement>('#confirmReplanBtn')
  const replanError = container.querySelector<HTMLElement>('#replanError')
  if (popupReplan && getState().replanningTaskId) {
    container.querySelector<HTMLElement>('#replanModal')?.focus()
  }
  const setReplanError = (message: string) => {
    if (replanError) replanError.textContent = message
  }
  const syncReplanQuickDateSelection = (date: string) => {
    container.querySelectorAll<HTMLElement>('.popup-replan-quick-dates .quick-date-btn').forEach(button => {
      const selected = button.dataset.date === date
      button.classList.toggle('selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    if (replanConfirmButton) replanConfirmButton.disabled = !date || date < formatDate(new Date())
  }
  if (popupReplan && replanDateInput) {
    container.querySelectorAll<HTMLElement>('.popup-replan-quick-dates .quick-date-btn').forEach(button => {
      button.addEventListener('click', () => {
        const date = button.dataset.date || ''
        replanDateInput.value = date
        syncReplanQuickDateSelection(date)
        setReplanError('')
      })
    })
    replanDateInput.addEventListener('change', () => {
      const date = replanDateInput.value
      const today = formatDate(new Date())
      syncReplanQuickDateSelection(date)
      setReplanError(date && date < today ? '不能安排到过去日期。' : '')
    })
  }
  container.querySelector('#replanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const { replanningTaskId } = getState()
    if (!replanningTaskId || replanSubmitting) return
    const date = new FormData(e.target as HTMLFormElement).get('replanDate') as string
    if (popupReplan && (!date || date < formatDate(new Date()))) {
      setReplanError(!date ? '请选择一个计划日期。' : '不能安排到过去日期。')
      return
    }
    replanSubmitting = true
    if (replanConfirmButton) replanConfirmButton.disabled = true
    replanTask(replanningTaskId, date)
    setState({ replanningTaskId: null })
    await persistState()
    reRender()
    showToast(container, date === formatDate(new Date()) ? '已重新安排到今天并加入聚焦' : '计划日期已更新', 'success')
  })

  const splitError = container.querySelector('#splitTaskError') as HTMLElement
  const closeSplitModal = () => {
    setState({ splittingTaskId: null })
    reRender()
  }
  container.querySelector('#cancelSplitTaskBtn')?.addEventListener('click', closeSplitModal)
  container.querySelector('#closeSplitTaskBtn')?.addEventListener('click', closeSplitModal)
  const splitTaskModal = container.querySelector('#splitTaskModal') as HTMLElement
  splitTaskModal?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      e.preventDefault()
      closeSplitModal()
    }
  })
  if (getState().splittingTaskId) {
    container.querySelector<HTMLInputElement>('#splitTaskModal .split-child-title')?.focus()
  }

  const showSplitError = (message: string) => {
    if (!splitError) return
    splitError.textContent = message
    splitError.classList.remove('hidden')
  }
  const bindSplitRemoveButtons = () => {
    container.querySelectorAll('.remove-split-child').forEach(btn => {
      if ((btn as HTMLElement).dataset.bound === 'true') return
      ;(btn as HTMLElement).dataset.bound = 'true'
      btn.addEventListener('click', () => {
        const rows = container.querySelectorAll('.split-child-row')
        if (rows.length <= 2) {
          showSplitError('至少保留两个子任务。')
          return
        }
        btn.closest('.split-child-row')?.remove()
      })
    })
  }
  bindSplitRemoveButtons()

  // 子任务时长步进器（与主任务弹窗一致：每次 ±0.5h，范围 0.5-24）
  splitTaskModal?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const isDec = target.classList.contains('split-duration-decrease')
    const isInc = target.classList.contains('split-duration-increase')
    if (!isDec && !isInc) return
    const input = target.closest('.split-child-row')?.querySelector('.split-child-duration') as HTMLInputElement | null
    if (!input) return
    const current = Number.parseFloat(input.value) || 1
    const next = isDec ? Math.max(0.5, current - 0.5) : Math.min(24, current + 0.5)
    input.value = next.toFixed(1)
  })

  // 子任务快捷日期：严格限定在拆分弹窗及其各自行内
  if (splitTaskModal) bindSplitQuickDates(splitTaskModal)

  container.querySelector('#addSplitChildBtn')?.addEventListener('click', () => {
    const list = container.querySelector('#splitChildren')
    if (!list) return
    const index = list.querySelectorAll('.split-child-row').length
    const row = document.createElement('div')
    row.className = 'split-child-row grid gap-2 p-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30'
    row.innerHTML = `
      <input type="text" class="split-child-title px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" placeholder="子任务 ${index + 1}" required aria-label="子任务标题">
      <button type="button" class="remove-split-child p-2 text-gray-400 hover:text-red-500 rounded" title="删除此子任务" aria-label="删除此子任务">×</button>
      <div class="split-child-schedule">
        <div class="split-child-field split-child-duration-field">
          <span class="split-child-field-label">预计时间</span>
          <div class="split-child-duration-control">
            <button type="button" class="split-duration-decrease px-2 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm leading-none" aria-label="减少 0.5 小时">−</button>
            <input type="number" class="split-child-duration w-14 text-center px-1 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" value="1" min="0.5" step="0.5" aria-label="预计小时">
            <button type="button" class="split-duration-increase px-2 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm leading-none" aria-label="增加 0.5 小时">+</button>
          </div>
        </div>
        <div class="split-quick-dates">${renderQuickDates(formatDate(new Date()))}</div>
        <div class="split-child-field split-child-date-field">
          <label class="split-child-field-label">自定义日期</label>
          <input type="date" class="split-child-date w-full px-2 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" value="${formatDate(new Date())}" required aria-label="计划日期">
        </div>
      </div>`
    list.appendChild(row)
    bindSplitRemoveButtons()
    row.querySelector<HTMLInputElement>('.split-child-title')?.focus()
  })

  const canSubmitSplit = createSubmissionGuard()
  container.querySelector('#splitTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const { splittingTaskId } = getState()
    if (!splittingTaskId) return
    const rows = [...container.querySelectorAll<HTMLDivElement>('.split-child-row')]
    const children = rows.map(row => {
      const durationHours = Number.parseFloat((row.querySelector('.split-child-duration') as HTMLInputElement).value)
      return {
        id: row.dataset.childId,
        title: (row.querySelector('.split-child-title') as HTMLInputElement).value.trim(),
        durationHours,
        duration: Math.round(durationHours * 60),
        dueDate: (row.querySelector('.split-child-date') as HTMLInputElement).value
      }
    })
    const invalidChildIndex = children.findIndex(child =>
      !child.title ||
      !child.dueDate ||
      !Number.isFinite(child.durationHours) ||
      child.durationHours < 0.5 ||
      child.durationHours > 24 ||
      Math.abs(child.durationHours * 2 - Math.round(child.durationHours * 2)) > Number.EPSILON
    )
    if (children.length < 2) {
      showSplitError('至少保留两个子任务。')
      return
    }
    if (invalidChildIndex !== -1) {
      const invalidChild = children[invalidChildIndex]
      const invalidRow = rows[invalidChildIndex]
      const invalidField = !invalidChild?.title
        ? invalidRow?.querySelector<HTMLInputElement>('.split-child-title')
        : !invalidChild?.dueDate
          ? invalidRow?.querySelector<HTMLInputElement>('.split-child-date')
          : invalidRow?.querySelector<HTMLInputElement>('.split-child-duration')
      const message = !invalidChild?.title
        ? `请填写子任务 ${invalidChildIndex + 1} 的标题。`
        : !invalidChild.dueDate
          ? `请为子任务 ${invalidChildIndex + 1} 选择计划日期，或先在任务列表中安排它。`
          : `子任务 ${invalidChildIndex + 1} 的预计时间需为 0.5 至 24 小时，并以 0.5 小时递增。`
      showSplitError(message)
      invalidField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      invalidField?.focus()
      return
    }
    if (!canSubmitSplit()) return
    if (!splitTask(splittingTaskId, children)) {
      showSplitError('该任务当前无法拆分，请确认它不是循环任务。')
      return
    }
    const submitButton = (e.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submitButton) submitButton.disabled = true
    setState({ splittingTaskId: null })
    await persistState()
    reRender()
    showToast(container, `已保存 ${children.length} 个子任务`, 'success')
  })
  taskForm?.addEventListener('change', () => {
    taskFormDirty = true
  })

  const closeTaskModal = () => {
    if (taskFormDirty && !confirm('当前填写的内容尚未保存，确定关闭吗？')) return
    const modal = container.querySelector('#taskModal') as HTMLElement
    modal?.classList.add('hidden')
    resetEditingTask()
    reRender()
  }

  container.querySelector('#closeModal')?.addEventListener('click', () => {
    closeTaskModal()
  })

  container.querySelector('#cancelBtn')?.addEventListener('click', () => {
    closeTaskModal()
  })

  container.querySelector('#taskModal')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      e.preventDefault()
      closeTaskModal()
    }
  })

  // 删除任务按钮（在表单内）
  container.querySelector('#deleteTaskBtn')?.addEventListener('click', async () => {
    const { editingTask } = getState()
    const message = editingTask?.isParent ? '确定删除此父任务及其全部子任务？' : '确定删除此任务？'
    if (editingTask && confirm(message)) {
      deleteTaskAction(editingTask.id)
      await persistState()
      const modal = container.querySelector('#taskModal') as HTMLElement
      modal?.classList.add('hidden')
      resetEditingTask()
      reRender()
    }
  })

  // 时长调整
  container.querySelector('#durationDecrease')?.addEventListener('click', () => {
    const input = container.querySelector('#durationInput') as HTMLInputElement
    if (input) {
      const val = parseFloat(input.value) - 0.5
      input.value = Math.max(0.5, val).toFixed(1)
    }
  })

  container.querySelector('#durationIncrease')?.addEventListener('click', () => {
    const input = container.querySelector('#durationInput') as HTMLInputElement
    if (input) {
      const val = parseFloat(input.value) + 0.5
      input.value = Math.min(24, val).toFixed(1)
    }
  })

  // 无时间限制切换（只影响截止日期，不影响预计时长）
  container.querySelector('#noTimeLimit')?.addEventListener('change', (e) => {
    const dueDateField = container.querySelector('#dueDateField') as HTMLElement
    if (dueDateField) {
      dueDateField.style.opacity = (e.target as HTMLInputElement).checked ? '0.5' : '1'
      dueDateField.style.pointerEvents = (e.target as HTMLInputElement).checked ? 'none' : 'auto'
    }
  })

  // 快捷日期选择（仅任务新增/编辑弹窗，避免与拆分、重新排期弹窗串扰）
  const taskModal = container.querySelector('#taskModal') as HTMLElement | null
  const refreshQuickDates = taskModal ? bindTaskQuickDates(taskModal) : () => {}
  // 任务弹窗打开时同步一次
  container.querySelector('#addTaskBtn')?.addEventListener('click', () => {
    setTimeout(refreshQuickDates, 0)
  })

  // 重复类型切换
  container.querySelector('#repeatType')?.addEventListener('change', (e) => {
    const weeklyDays = container.querySelector('#weeklyDays') as HTMLElement
    const customInterval = container.querySelector('#customInterval') as HTMLElement
    const value = (e.target as HTMLSelectElement).value
    if (weeklyDays) weeklyDays.classList.toggle('hidden', value !== 'weekly')
    if (customInterval) customInterval.classList.toggle('hidden', value !== 'custom')
  })

  // 分类管理（仅新标签页版本）
  const isNewTab = window.location.pathname.includes('newtab')
  
  if (isNewTab) {
    container.querySelector('#manageCategoryBtn')?.addEventListener('click', () => {
      const modal = container.querySelector('#categoryModal') as HTMLElement
      modal?.classList.remove('hidden')
    })

    container.querySelector('#closeCategoryModal')?.addEventListener('click', () => {
      const modal = container.querySelector('#categoryModal') as HTMLElement
      modal?.classList.add('hidden')
    })

    container.querySelector('#categoryModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        const modal = container.querySelector('#categoryModal') as HTMLElement
        modal?.classList.add('hidden')
      }
    })

    // 添加新分类
    container.querySelector('#createCategoryBtn')?.addEventListener('click', async () => {
      const nameInput = container.querySelector('#newCategoryName') as HTMLInputElement
      const colorInput = container.querySelector('#newCategoryColor') as HTMLInputElement
      if (nameInput.value.trim()) {
        addCategory(nameInput.value.trim(), colorInput.value)
        await persistState()
        nameInput.value = ''
        reRender()
        // 重新打开分类模态框
        const modal = container.querySelector('#categoryModal') as HTMLElement
        modal?.classList.remove('hidden')
      }
    })

    // 保存分类（编辑）
    container.querySelectorAll('.save-category').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const id = (e.currentTarget as HTMLElement).dataset.id
        if (id) {
          const item = container.querySelector(`.category-item[data-id="${id}"]`)
          const nameInput = item?.querySelector('.category-name') as HTMLInputElement
          const colorInput = item?.querySelector('.category-color') as HTMLInputElement
          if (nameInput && colorInput && nameInput.value.trim()) {
            updateCategory(id, nameInput.value.trim(), colorInput.value)
            await persistState()
            reRender()
            // 重新打开分类模态框
            const modal = container.querySelector('#categoryModal') as HTMLElement
            modal?.classList.remove('hidden')
          }
        }
      })
    })

    // 删除分类
    container.querySelectorAll('.delete-category').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const id = (e.currentTarget as HTMLElement).dataset.id
        if (id && getState().categories.length > 1) {
          if (confirm('确定删除此分类？')) {
            deleteCategoryAction(id)
            // 如果删除的是默认分类，清除默认设置
            if (getState().defaultCategory === id) {
              setLocalSettings({ defaultCategory: '' })
            }
            await persistState()
            reRender()
            const modal = container.querySelector('#categoryModal') as HTMLElement
            modal?.classList.remove('hidden')
          }
        } else if (id && getState().categories.length <= 1) {
          alert('至少保留一个分类')
        }
      })
    })

    // 设为默认分类
    container.querySelectorAll('.set-default-category').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const id = (e.currentTarget as HTMLElement).dataset.id
        if (id) {
          setLocalSettings({ defaultCategory: id })
          await persistState()
          reRender()
          const modal = container.querySelector('#categoryModal') as HTMLElement
          modal?.classList.remove('hidden')
        }
      })
    })

    // ==================== 数据导入导出 ====================
    // 导出数据
    container.querySelector('#exportBtn')?.addEventListener('click', async () => {
      try {
        await downloadExportFile()
        showToast(container, '数据已导出成功！', 'success')
      } catch {
        showToast(container, '导出失败，请重试', 'error')
      }
    })

    // 导入数据
    const importInput = container.querySelector('#importFileInput') as HTMLInputElement
    importInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const result = await importDataFromFile(file)
        if (result.success) {
          // 重新加载状态并渲染
          await loadState()
          reRender()
          showToast(container, '数据导入成功！', 'success')
        } else {
          showToast(container, result.error || '导入失败', 'error')
        }
        // 清空 input 以便重复选择同一文件
        importInput.value = ''
      }
    })

    // ==================== 同步面板 ====================
    container.querySelector('#syncDataBtn')?.addEventListener('click', () => {
      const modal = container.querySelector('#syncModal') as HTMLElement
      modal?.classList.remove('hidden')
    })

    container.querySelector('#closeSyncModal')?.addEventListener('click', () => {
      const modal = container.querySelector('#syncModal') as HTMLElement
      modal?.classList.add('hidden')
    })

    container.querySelector('#syncModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        const modal = container.querySelector('#syncModal') as HTMLElement
        modal?.classList.add('hidden')
      }
    })

    container.querySelector('#forceUploadBtn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#forceUploadBtn') as HTMLElement
      const origHTML = btn?.innerHTML
      try {
        if (btn) btn.innerHTML = '<div class="card-title" style="color:#6b7280;">上传中...</div>'
        showSyncFeedback(container, '正在上传数据到云端...', 'info')
        const { syncIncrementally } = await import('./storage')
        const { getState } = await import('./task')
        const state = getState()
        const result = await syncIncrementally({
          tasks: state.tasks,
          categories: state.categories,
          defaultCategory: state.defaultCategory,
          hideCompleted: state.hideCompleted,
          hideOverdue: state.hideOverdue,
          showNoTimeLimitOnly: state.showNoTimeLimitOnly,
          darkMode: state.darkMode,
          weeklyGoalMinutes: state.weeklyGoalMinutes,
          weeklyGoalAnchor: state.weeklyGoalAnchor,
          syncSettingsUpdatedAt: state.syncSettingsUpdatedAt
        })
        if (result.success && result.data) {
          setState(result.data)
          reRender()
          showSyncFeedback(container, `同步完成 — ${result.data.tasks.length} 个任务已收敛`, 'success')
        } else {
          showSyncFeedback(container, '上传失败: ' + (result.error || '未知错误'), 'error')
        }
      } catch (e: any) {
        showSyncFeedback(container, '上传失败: ' + (e?.message || '网络错误'), 'error')
      } finally {
        if (btn) btn.innerHTML = origHTML
      }
    })

    container.querySelector('#forceDownloadBtn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#forceDownloadBtn') as HTMLElement
      const origHTML = btn?.innerHTML
      try {
        if (btn) btn.innerHTML = '<div class="card-title" style="color:#6b7280;">拉取中...</div>'
        showSyncFeedback(container, '正在从云端拉取数据...', 'info')
        const { syncIncrementally } = await import('./storage')
        const state = getState()
        const result = await syncIncrementally({
          tasks: state.tasks,
          categories: state.categories,
          defaultCategory: state.defaultCategory,
          hideCompleted: state.hideCompleted,
          hideOverdue: state.hideOverdue,
          showNoTimeLimitOnly: state.showNoTimeLimitOnly,
          darkMode: state.darkMode,
          weeklyGoalMinutes: state.weeklyGoalMinutes,
          weeklyGoalAnchor: state.weeklyGoalAnchor,
          syncSettingsUpdatedAt: state.syncSettingsUpdatedAt
        })
        if (result.success && result.data) {
          setState(result.data)
          reRender()
          showSyncFeedback(container, `同步完成 — 已收敛 ${result.data.tasks.length} 个任务`, 'success')
        } else {
          showSyncFeedback(container, '云端暂无数据', 'error')
        }
      } catch (e: any) {
        showSyncFeedback(container, '拉取失败: ' + (e?.message || '网络错误'), 'error')
      } finally {
        if (btn) btn.innerHTML = origHTML
      }
    })

    container.querySelector('#exportFileBtn')?.addEventListener('click', async () => {
      try {
        await downloadExportFile()
        showToast(container, '数据已导出', 'success')
      } catch {
        showToast(container, '导出失败', 'error')
      }
    })

    container.querySelector('#importFileBtn')?.addEventListener('click', () => {
      const input = container.querySelector('#syncImportInput') as HTMLInputElement
      input?.click()
    })

    const syncImportInput = container.querySelector('#syncImportInput') as HTMLInputElement
    syncImportInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const result = await importDataFromFile(file)
        if (result.success) {
          await loadState()
          reRender()
          showToast(container, '数据导入成功', 'success')
        } else {
          showToast(container, result.error || '导入失败', 'error')
        }
        syncImportInput.value = ''
      }
    })
    // ==================== 备份功能（在同步面板内）====================

    const refreshBackupUI = async () => {
      const { listBackups, getStorageUsage } = await import('./storage')
      const [backups, usage] = await Promise.all([listBackups(), getStorageUsage()])

      // Update storage bar
      const bar = container.querySelector('#storageUsageBar') as HTMLElement
      const text = container.querySelector('#storageUsageText') as HTMLElement
      if (bar) bar.style.width = usage.percentage + '%'
      if (text) {
        const usedMB = (usage.used / 1024 / 1024).toFixed(2)
        text.textContent = `${usedMB} MB / 5 MB`
      }

      // Update backup list
      const listEl = container.querySelector('#backupList') as HTMLElement
      if (!listEl) return

      if (backups.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:8px 0;color:#d1d5db;">暂无备份</div>'
        return
      }

      listEl.innerHTML = backups.map(b => `
        <div class="flex items-center justify-between" style="padding:6px 0;border-bottom:1px solid #f3f4f6;" data-backup-key="${b.key}">
          <div>
            <span style="color:#374151;" class="dark:text-gray-300">${b.dateStr}</span>
            <span style="color:#9ca3af;margin-left:8px;">${b.taskCount} 个任务</span>
          </div>
          <div class="flex gap-2">
            <button class="backup-restore-btn" data-key="${b.key}" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #d1d5db;background:white;color:#374151;cursor:pointer;" class="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">恢复</button>
            <button class="backup-delete-btn" data-key="${b.key}" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #fecaca;background:white;color:#ef4444;cursor:pointer;">删除</button>
          </div>
        </div>
      `).join('')

      // Bind restore buttons
      listEl.querySelectorAll('.backup-restore-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const key = (btn as HTMLElement).dataset.key!
          if (!confirm('恢复此备份将覆盖当前所有数据，确定？')) return
          const { restoreBackup } = await import('./storage')
          const result = await restoreBackup(key)
          if (result.success) {
            await loadState()
            reRender()
            showToast(container, '已恢复备份', 'success')
          } else {
            showToast(container, result.error || '恢复失败', 'error')
          }
        })
      })

      // Bind delete buttons
      listEl.querySelectorAll('.backup-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const key = (btn as HTMLElement).dataset.key!
          const { deleteBackup } = await import('./storage')
          await deleteBackup(key)
          refreshBackupUI()
          showToast(container, '备份已删除', 'success')
        })
      })
    }

    // When sync modal opens, refresh backup UI
    container.querySelector('#syncDataBtn')?.addEventListener('click', () => {
      const modal = container.querySelector('#syncModal') as HTMLElement
      modal?.classList.remove('hidden')
      refreshBackupUI()
    })

    // Create backup button
    container.querySelector('#createBackupBtn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#createBackupBtn') as HTMLElement
      if (btn) btn.textContent = '备份中...'
      const { createAutoBackup } = await import('./storage')
      const result = await createAutoBackup()
      if (btn) btn.textContent = '立即备份'
      if (result.success) {
        showToast(container, '备份已创建', 'success')
        refreshBackupUI()
      } else {
        showToast(container, result.error || '备份失败', 'error')
      }
    })

    // ==================== 手机同步设置（newtab only）====================
    container.querySelector('#mobileSyncSettingsBtn')?.addEventListener('click', () => {
      const modal = container.querySelector('#mobileSyncModal') as HTMLElement
      modal?.classList.remove('hidden')
      chrome.runtime.sendMessage({ action: 'getSyncSettings' }, (settings) => {
        const urlInput = container.querySelector('#mobileSyncApiUrl') as HTMLInputElement
        const tokenInput = container.querySelector('#mobileSyncApiToken') as HTMLInputElement
        if (urlInput && settings?.apiUrl) urlInput.value = settings.apiUrl
        if (tokenInput && settings?.apiToken) tokenInput.value = settings.apiToken
      })
    })

    container.querySelector('#mobileSyncClose')?.addEventListener('click', () => {
      container.querySelector('#mobileSyncModal')?.classList.add('hidden')
    })

    container.querySelector('#mobileSyncOverlay')?.addEventListener('click', () => {
      container.querySelector('#mobileSyncModal')?.classList.add('hidden')
    })

    container.querySelector('#mobileSyncSaveBtn')?.addEventListener('click', () => {
      const apiUrl = (container.querySelector('#mobileSyncApiUrl') as HTMLInputElement)?.value.replace(/\/+$/, '').trim()
      const apiToken = (container.querySelector('#mobileSyncApiToken') as HTMLInputElement)?.value.trim()
      if (!apiUrl || !apiToken) {
        syncToast('请填写 API 地址和密钥', 'error')
        return
      }
      chrome.runtime.sendMessage({ action: 'saveSyncSettings', settings: { apiUrl, apiToken } }, () => {
        syncToast('设置已保存', 'success')
      })
    })

    container.querySelector('#mobileSyncNowBtn')?.addEventListener('click', () => {
      const statusEl = container.querySelector('#mobileSyncStatus') as HTMLElement
      if (statusEl) statusEl.textContent = '同步中...'
      chrome.runtime.sendMessage({ action: 'syncRemoteTasks' }, (result: { synced?: number; error?: string }) => {
        if ((result?.synced ?? 0) > 0) {
          syncToast(`已同步 ${result.synced} 个任务`, 'success')
          if (statusEl) statusEl.textContent = `上次同步: 成功，${result.synced} 个任务`
        } else if (result?.error) {
          syncToast('同步失败: ' + result.error, 'error')
          if (statusEl) statusEl.textContent = '同步失败: ' + result.error
        } else {
          if (statusEl) statusEl.textContent = '没有新的待同步任务'
        }
      })
    })
  }

  // 每周目标卡片 + 设置
  setupWeeklyGoalEvents(container)

  // 拖拽功能 + 双击编辑
  setupDragAndDrop(container)
}

function setupWeeklyGoalEvents(container: HTMLElement): void {
  const toggleBtn = container.querySelector('#statsToggleBtn')
  const wrapper = container.querySelector('#weeklyGoalWrapper') as HTMLElement
  const card = container.querySelector('#weeklyGoalCard') as HTMLElement
  const chevron = container.querySelector('#statsChevron')
  const modal = container.querySelector('#goalSettingsModal') as HTMLElement
  const errorEl = container.querySelector('#goalSettingsError') as HTMLElement

  const closeGoalSettings = () => {
    modal?.classList.add('hidden')
  }

  const showGoalSettingsError = (message: string) => {
    if (!errorEl) return
    errorEl.textContent = message
    errorEl.classList.remove('hidden')
  }

  const clearGoalSettingsError = () => {
    if (!errorEl) return
    errorEl.textContent = ''
    errorEl.classList.add('hidden')
  }

  // 统计条右侧箭头展开/收起周目标卡片
  toggleBtn?.addEventListener('click', () => {
    if (!wrapper) return
    const isOpen = wrapper.style.display !== 'none'
    wrapper.style.display = isOpen ? 'none' : 'block'
    chevron?.classList.toggle('open')
    if (card && isOpen && card.classList.contains('expanded')) {
      card.classList.remove('expanded')
    }
  })

  // 卡片内点击：打开目标设置（阻止冒泡）、展开详情
  card?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (
      target.id === 'adjustGoalAnchorBtn' || target.closest('#adjustGoalAnchorBtn') ||
      target.id === 'openGoalSettingsBtn' || target.closest('#openGoalSettingsBtn')
    ) {
      modal?.classList.remove('hidden')
      clearGoalSettingsError()
      window.setTimeout(() => container.querySelector<HTMLInputElement>('#goalWeeklyHours')?.focus(), 0)
      return
    }
    card.classList.toggle('expanded')
  })

  // 设置弹窗关闭
  const closeBtn = container.querySelector('#closeGoalSettingsBtn')
  const cancelBtn = container.querySelector('#cancelGoalSettingsBtn')
  closeBtn?.addEventListener('click', closeGoalSettings)
  cancelBtn?.addEventListener('click', closeGoalSettings)

  container.querySelector('#goalWeeklyHours')?.addEventListener('input', clearGoalSettingsError)
  container.querySelector('#goalAnchorDate')?.addEventListener('input', clearGoalSettingsError)

  // 保存设置
  const saveBtn = container.querySelector('#saveGoalSettingsBtn')
  saveBtn?.addEventListener('click', async () => {
    const hoursInput = container.querySelector('#goalWeeklyHours') as HTMLInputElement
    const anchorInput = container.querySelector('#goalAnchorDate') as HTMLInputElement
    const hours = Number.parseFloat(hoursInput?.value)
    const startDate = anchorInput?.value

    if (!Number.isFinite(hours) || hours < 0.5 || hours > 168) {
      showGoalSettingsError('每周目标请输入 0.5 至 168 之间的小时数。')
      hoursInput?.focus()
      return
    }
    if (!startDate) {
      showGoalSettingsError('请选择统计起始日期。')
      anchorInput?.focus()
      return
    }
    if (startDate > formatDate(new Date())) {
      showGoalSettingsError('统计起始日期不能晚于今天。')
      anchorInput?.focus()
      return
    }

    const saveButton = saveBtn as HTMLButtonElement
    saveButton.disabled = true
    saveButton.textContent = '保存中...'
    setLocalSettings({
      weeklyGoalMinutes: Math.round(hours * 60),
      weeklyGoalAnchor: startDate
    })
    await persistState()
    reRender()
    showToast(container, '每周目标已更新', 'success')
  })

  modal?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      e.preventDefault()
      closeGoalSettings()
    }
  })
}

function setupDragAndDrop(container: HTMLElement): void {
  container.querySelectorAll('[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', async (e) => {
      const taskId = (e.target as HTMLElement).dataset.taskId
      if (taskId) {
        draggedTaskId = taskId
        ;(e.target as HTMLElement).classList.add('opacity-50')
        const dt = (e as DragEvent).dataTransfer
        if (dt) {
          dt.effectAllowed = 'move'
          dt.setData('text/plain', taskId)
        }
      }
    })

    el.addEventListener('dragend', () => {
      ;(el as HTMLElement).classList.remove('opacity-50')
      draggedTaskId = null
      container.querySelectorAll('.drop-zone').forEach(zone => {
        ;(zone as HTMLElement).classList.remove('bg-blue-100', 'dark:bg-blue-900/30')
      })
    })
  })

  // 周/月视图双击编辑
  container.querySelectorAll('.week-task-item, .month-task-item').forEach(el => {
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      const taskId = (el as HTMLElement).dataset.taskId
      if (taskId) {
        const task = getState().tasks.find(t => t.id === taskId)
        if (task) {
          setState({ editingTask: task })
          reRender()
          const modal = container.querySelector('#taskModal') as HTMLElement
          modal?.classList.remove('hidden')
        }
      }
    })
  })

  // 列表视图双击编辑（排除周/月视图已有处理的元素）
  container.querySelectorAll('[data-task-id][draggable="true"]').forEach(el => {
    if (!(el as HTMLElement).classList.contains('week-task-item') && !(el as HTMLElement).classList.contains('month-task-item')) {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation()
        const taskId = (el as HTMLElement).dataset.taskId
        if (taskId) {
          const task = getState().tasks.find(t => t.id === taskId)
          if (task) {
            setState({ editingTask: task })
            reRender()
            const modal = container.querySelector('#taskModal') as HTMLElement
            modal?.classList.remove('hidden')
          }
        }
      })
    }
  })

  container.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault()
      const dt = (e as DragEvent).dataTransfer
      if (dt) dt.dropEffect = 'move'
      ;(zone as HTMLElement).classList.add('bg-blue-100', 'dark:bg-blue-900/30')
    })

    zone.addEventListener('dragleave', () => {
      ;(zone as HTMLElement).classList.remove('bg-blue-100', 'dark:bg-blue-900/30')
    })

    zone.addEventListener('drop', async (e) => {
      e.preventDefault()
      ;(zone as HTMLElement).classList.remove('bg-blue-100', 'dark:bg-blue-900/30')
      const date = (zone as HTMLElement).dataset.date
      if (draggedTaskId && date && date !== 'no-date') {
        moveTaskToDate(draggedTaskId, date)
        await persistState()
        reRender()
      }
    })
  })
}

