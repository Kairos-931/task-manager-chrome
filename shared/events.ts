import type { Priority, Task } from './types'
import { getState, setState, resetEditingTask, formatDate, parseDate, persistState, moveTaskToDate, loadState } from './task'
import { toggleTask as toggleTaskAction, deleteTask as deleteTaskAction, addTask, updateTask, addCategory, updateCategory, deleteCategory as deleteCategoryAction } from './task'
import { renderApp } from './render'
import { downloadExportFile, importDataFromFile } from './storage'
import { showToast } from './sync'

let draggedTaskId: string | null = null
let currentContainer: HTMLElement | null = null

// 封装渲染和事件绑定
function reRender() {
  if (!currentContainer) return
  renderApp(currentContainer)
  attachEventListeners(currentContainer)
}

export const attachEventListeners = (container: HTMLElement): void => {
  currentContainer = container
  
  // 添加任务按钮
  container.querySelector('#addTaskBtn')?.addEventListener('click', () => {
    resetEditingTask()
    reRender()
    const modal = container.querySelector('#taskModal') as HTMLElement
    modal?.classList.remove('hidden')
  })

  // 新标签页打开
  container.querySelector('#openFullPage')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openNewTab' })
  })

  // 深色模式切换
  container.querySelector('#darkModeBtn')?.addEventListener('click', async () => {
    const { darkMode } = getState()
    setState({ darkMode: !darkMode })
    await persistState()
    reRender()
  })

  // 视图切换
  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = (e.currentTarget as HTMLElement).dataset.view as 'list' | 'day' | 'week' | 'month'
      setState({ currentView: view })
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
    setState({ hideCompleted: (e.target as HTMLInputElement).checked })
    await persistState()
    reRender()
  })

  container.querySelector('#hideOverdue')?.addEventListener('change', async (e) => {
    setState({ hideOverdue: (e.target as HTMLInputElement).checked })
    await persistState()
    reRender()
  })

  container.querySelector('#showNoTimeLimitOnly')?.addEventListener('change', async (e) => {
    setState({ showNoTimeLimitOnly: (e.target as HTMLInputElement).checked })
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
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() - 1)
    setState({ currentDate: formatDate(d) })
    reRender()
  })

  container.querySelector('#nextMonth')?.addEventListener('click', () => {
    const { currentDate } = getState()
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + 1)
    setState({ currentDate: formatDate(d) })
    reRender()
  })

  // 任务操作
  container.querySelectorAll('.task-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = (e.currentTarget as HTMLElement).dataset.taskId
      if (id) {
        toggleTaskAction(id)
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
      if (id && confirm('确定删除此任务？')) {
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
    const noTimeLimit = (form.querySelector('#noTimeLimit') as HTMLInputElement)?.checked || false
    const repeatDays: number[] = []
    form.querySelectorAll('[name="repeatDays"]:checked').forEach(cb => {
      repeatDays.push(parseInt((cb as HTMLInputElement).value))
    })
    const durationInput = form.querySelector('#durationInput') as HTMLInputElement
    const duration = Math.round(parseFloat(durationInput?.value || '1') * 60) || 60
    
    const taskData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: formData.get('priority') as Priority,
      category: formData.get('category') as string,
      dueDate: noTimeLimit ? '' : (formData.get('dueDate') as string),
      duration,
      completed: editingTask?.completed || false,
      repeatType: formData.get('repeatType') as Task['repeatType'],
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
  container.querySelector('#closeModal')?.addEventListener('click', () => {
    const modal = container.querySelector('#taskModal') as HTMLElement
    modal?.classList.add('hidden')
    resetEditingTask()
    reRender()
  })

  container.querySelector('#cancelBtn')?.addEventListener('click', () => {
    const modal = container.querySelector('#taskModal') as HTMLElement
    modal?.classList.add('hidden')
    resetEditingTask()
    reRender()
  })

  container.querySelector('#taskModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      const modal = container.querySelector('#taskModal') as HTMLElement
      modal?.classList.add('hidden')
      resetEditingTask()
      reRender()
    }
  })

  // 删除任务按钮（在表单内）
  container.querySelector('#deleteTaskBtn')?.addEventListener('click', async () => {
    const { editingTask } = getState()
    if (editingTask && confirm('确定删除此任务？')) {
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
            await persistState()
            reRender()
            // 重新打开分类模态框
            const modal = container.querySelector('#categoryModal') as HTMLElement
            modal?.classList.remove('hidden')
          }
        } else if (id && getState().categories.length <= 1) {
          alert('至少保留一个分类')
        }
      })
    })

    // ==================== 数据导入导出 ====================
    // 导出数据
    container.querySelector('#exportBtn')?.addEventListener('click', async () => {
      try {
        await downloadExportFile()
        showToast(container, '数据已导出成功！', 'success')
      } catch (err) {
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
      try {
        await persistState()
        showToast(container, '已上传到云端', 'success')
      } catch {
        showToast(container, '上传失败', 'error')
      }
    })

    container.querySelector('#forceDownloadBtn')?.addEventListener('click', async () => {
      try {
        await loadState()
        reRender()
        showToast(container, '已从云端拉取', 'success')
      } catch {
        showToast(container, '拉取失败', 'error')
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
  }

  // 拖拽功能
  setupDragAndDrop(container)
}

const setupDragAndDrop = (container: HTMLElement): void => {
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

  container.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault()
      const dt = (e as DragEvent).dataTransfer
      if (dt) dt.dropEffect = 'move'
      ;(zone as HTMLElement).classList.add('bg-blue-100', 'dark:bg-blue-900/30')
    })

    zone.addEventListener('dragleave', (e) => {
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

