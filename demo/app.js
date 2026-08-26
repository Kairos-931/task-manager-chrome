(function initTaskMasterDemo() {
  const demo = window.TaskMasterDemoData
  const state = {
    tasks: demo.createTasks(),
    activeCategory: 'all',
    priority: 'all',
    query: '',
    hideCompleted: false,
    view: 'list'
  }

  const elements = {
    categoryNav: document.getElementById('categoryNav'),
    mobileCategory: document.getElementById('mobileCategoryFilter'),
    taskContent: document.getElementById('taskContent'),
    search: document.getElementById('searchInput'),
    priority: document.getElementById('priorityFilter'),
    hideCompleted: document.getElementById('hideCompleted'),
    dialog: document.getElementById('taskDialog'),
    taskForm: document.getElementById('taskForm'),
    taskCategory: document.getElementById('taskCategory'),
    taskDueDate: document.getElementById('taskDueDate'),
    taskNoDeadline: document.getElementById('taskNoDeadline'),
    toast: document.getElementById('toast')
  }

  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const parseDate = (value) => {
    const parts = value.split('-').map(Number)
    return new Date(parts[0], parts[1] - 1, parts[2], 12)
  }

  const today = () => formatDate(new Date())
  const categoryById = (id) => demo.categories.find((category) => category.id === id)
  const hours = (minutes) => `${Number((minutes / 60).toFixed(1))}h`
  const priorityLabel = { high: '高', medium: '中', low: '低' }

  const escapeHtml = (value) => {
    const element = document.createElement('div')
    element.textContent = String(value || '')
    return element.innerHTML
  }

  const getWeekDates = () => {
    const current = new Date()
    current.setHours(12, 0, 0, 0)
    const day = current.getDay() || 7
    const monday = new Date(current)
    monday.setDate(current.getDate() - day + 1)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return formatDate(date)
    })
  }

  const dateLabel = (value) => {
    if (!value) return '无期限'
    const current = today()
    if (value === current) return '今天'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (value === formatDate(tomorrow)) return '明天'
    return `${parseDate(value).getMonth() + 1}月${parseDate(value).getDate()}日`
  }

  const filteredTasks = () => state.tasks.filter((task) => {
    if (state.activeCategory !== 'all' && task.category !== state.activeCategory) return false
    if (state.priority !== 'all' && task.priority !== state.priority) return false
    if (state.hideCompleted && task.completed) return false
    if (state.query && !`${task.title} ${task.description}`.toLowerCase().includes(state.query)) return false
    if (state.view === 'today' && task.dueDate !== today()) return false
    if (state.view === 'week' && !getWeekDates().includes(task.dueDate)) return false
    return true
  })

  const showToast = (message) => {
    elements.toast.textContent = message
    elements.toast.classList.add('show')
    window.clearTimeout(showToast.timer)
    showToast.timer = window.setTimeout(() => elements.toast.classList.remove('show'), 2200)
  }

  const renderCategories = () => {
    const counts = state.tasks.reduce((result, task) => {
      if (!task.completed) result[task.category] = (result[task.category] || 0) + 1
      return result
    }, {})
    const entries = [{ id: 'all', name: '全部任务', color: '#475569' }, ...demo.categories]
    elements.categoryNav.innerHTML = entries.map((category) => `
      <button type="button" class="category-button ${state.activeCategory === category.id ? 'active' : ''}" data-category="${category.id}">
        <span><i class="category-dot category-${category.id}"></i>${category.name}</span>
        <b>${category.id === 'all' ? state.tasks.filter((task) => !task.completed).length : (counts[category.id] || 0)}</b>
      </button>
    `).join('')

    elements.mobileCategory.innerHTML = entries.map((category) =>
      `<option value="${category.id}" ${state.activeCategory === category.id ? 'selected' : ''}>${category.name}</option>`
    ).join('')

    elements.taskCategory.innerHTML = demo.categories.map((category) =>
      `<option value="${category.id}">${category.name}</option>`
    ).join('')
  }

  const taskRow = (task) => {
    const category = categoryById(task.category) || demo.categories[0]
    const overdue = !task.completed && task.dueDate && task.dueDate < today()
    return `
      <article class="task-row ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
        <button type="button" class="task-check" data-action="toggle" aria-label="${task.completed ? '恢复任务' : '完成任务'}" title="${task.completed ? '恢复任务' : '完成任务'}">
          <span aria-hidden="true">${task.completed ? '✓' : ''}</span>
        </button>
        <div class="task-copy">
          <div class="task-title-line"><h3>${escapeHtml(task.title)}</h3><span class="priority priority-${task.priority}">${priorityLabel[task.priority]}</span></div>
          ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta">
            <span><i class="category-dot category-${category.id}"></i>${category.name}</span>
            <span class="${overdue ? 'overdue' : ''}">${overdue ? '已逾期 · ' : ''}${dateLabel(task.dueDate)}</span>
            <span>${hours(task.duration)}</span>
          </div>
        </div>
      </article>
    `
  }

  const renderList = (tasks) => {
    const groups = [
      { title: '已逾期', match: (task) => !task.completed && task.dueDate && task.dueDate < today() },
      { title: '今天', match: (task) => task.dueDate === today() },
      { title: '接下来', match: (task) => task.dueDate && task.dueDate > today() },
      { title: '任务池', match: (task) => !task.dueDate }
    ]
    const used = new Set()
    return groups.map((group) => {
      const matches = tasks.filter((task) => group.match(task) && !used.has(task.id))
      matches.forEach((task) => used.add(task.id))
      if (!matches.length) return ''
      return `<section class="task-group"><div class="group-heading"><h2>${group.title}</h2><span>${matches.length}</span></div>${matches.map(taskRow).join('')}</section>`
    }).join('')
  }

  const renderWeek = (tasks) => {
    const weekday = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    return `<div class="week-grid">${getWeekDates().map((date, index) => {
      const dayTasks = tasks.filter((task) => task.dueDate === date)
      return `<section class="week-day ${date === today() ? 'is-today' : ''}">
        <div class="week-heading"><span>${weekday[index]}</span><strong>${parseDate(date).getDate()}</strong></div>
        <div class="week-tasks">${dayTasks.length ? dayTasks.map(taskRow).join('') : '<p class="empty-day">暂无任务</p>'}</div>
      </section>`
    }).join('')}</div>`
  }

  const renderStats = () => {
    const currentWeek = getWeekDates()
    const pending = state.tasks.filter((task) => !task.completed)
    const todayTasks = state.tasks.filter((task) => task.dueDate === today() && !task.completed)
    const completedThisWeek = state.tasks.filter((task) => task.completed && currentWeek.includes(task.dueDate))
    const doneMinutes = completedThisWeek.reduce((sum, task) => sum + task.duration, 0)
    const gap = Math.max(0, demo.weeklyGoalMinutes - doneMinutes)
    const percent = Math.min(100, Math.round(doneMinutes / demo.weeklyGoalMinutes * 100))

    document.getElementById('pendingCount').textContent = pending.length
    document.getElementById('todayHours').textContent = hours(todayTasks.reduce((sum, task) => sum + task.duration, 0))
    document.getElementById('weekDoneHours').textContent = hours(doneMinutes)
    document.getElementById('overdueCount').textContent = pending.filter((task) => task.dueDate && task.dueDate < today()).length
    document.getElementById('goalPercent').textContent = `${percent}%`
    document.getElementById('goalProgress').value = percent
    document.getElementById('goalDone').textContent = hours(doneMinutes)
    document.getElementById('goalTarget').textContent = hours(demo.weeklyGoalMinutes)
    document.getElementById('goalGap').textContent = hours(gap)
    document.getElementById('mobileGoalPercent').textContent = `${percent}%`
    document.getElementById('mobileGoalProgress').value = percent
    document.getElementById('mobileGoalText').textContent = `已完成 ${hours(doneMinutes)}，目标 ${hours(demo.weeklyGoalMinutes)}，差距 ${hours(gap)}`
  }

  const render = () => {
    renderCategories()
    renderStats()
    const tasks = filteredTasks()
    document.querySelectorAll('[data-view]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.view === state.view))
    })
    document.getElementById('pageTitle').textContent = state.view === 'today' ? '今日任务' : state.view === 'week' ? '本周计划' : '任务总览'
    elements.taskContent.classList.toggle('week-mode', state.view === 'week')
    elements.taskContent.innerHTML = tasks.length
      ? (state.view === 'week' ? renderWeek(tasks) : renderList(tasks))
      : '<div class="empty-state"><strong>没有符合条件的任务</strong><span>调整筛选条件或添加一条演示任务</span></div>'
  }

  const openDialog = () => {
    elements.taskForm.reset()
    elements.taskDueDate.value = today()
    elements.taskDueDate.disabled = false
    elements.dialog.showModal()
    document.getElementById('taskTitle').focus()
  }

  document.getElementById('currentDateLabel').textContent = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long'
  }).format(new Date())

  elements.categoryNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]')
    if (!button) return
    state.activeCategory = button.dataset.category
    render()
  })

  elements.mobileCategory.addEventListener('change', (event) => {
    state.activeCategory = event.target.value
    render()
  })

  elements.search.addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase()
    render()
  })

  elements.priority.addEventListener('change', (event) => {
    state.priority = event.target.value
    render()
  })

  elements.hideCompleted.addEventListener('change', (event) => {
    state.hideCompleted = event.target.checked
    render()
  })

  document.querySelector('.view-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]')
    if (!button) return
    state.view = button.dataset.view
    render()
  })

  elements.taskContent.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="toggle"]')
    if (!button) return
    const row = button.closest('[data-task-id]')
    const task = state.tasks.find((item) => item.id === row.dataset.taskId)
    if (!task) return
    task.completed = !task.completed
    showToast(task.completed ? '已完成演示任务' : '任务已恢复')
    render()
  })

  document.getElementById('addTaskBtn').addEventListener('click', openDialog)
  document.getElementById('closeTaskDialog').addEventListener('click', () => elements.dialog.close())
  document.getElementById('cancelTaskBtn').addEventListener('click', () => elements.dialog.close())
  elements.dialog.addEventListener('cancel', (event) => event.preventDefault())

  elements.taskNoDeadline.addEventListener('change', (event) => {
    elements.taskDueDate.disabled = event.target.checked
  })

  elements.taskForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const title = document.getElementById('taskTitle').value.trim()
    if (!title) return
    state.tasks.unshift({
      id: `local-demo-${Date.now()}`,
      title,
      description: '',
      priority: document.getElementById('taskPriority').value,
      category: elements.taskCategory.value,
      dueDate: elements.taskNoDeadline.checked ? '' : elements.taskDueDate.value,
      duration: Math.round(Number(document.getElementById('taskDuration').value || 1) * 60),
      completed: false,
      noTimeLimit: elements.taskNoDeadline.checked
    })
    elements.dialog.close()
    state.view = 'list'
    showToast('已添加到本次演示，不会同步')
    render()
  })

  const resetDemo = () => {
    state.tasks = demo.createTasks()
    state.activeCategory = 'all'
    state.priority = 'all'
    state.query = ''
    state.hideCompleted = false
    state.view = 'list'
    elements.search.value = ''
    elements.priority.value = 'all'
    elements.hideCompleted.checked = false
    showToast('演示数据已恢复')
    render()
  }

  document.getElementById('resetDemoBtn').addEventListener('click', resetDemo)
  document.getElementById('resetDemoMobileBtn').addEventListener('click', resetDemo)

  render()
})()
