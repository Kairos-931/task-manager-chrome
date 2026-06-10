import type { Priority, Task } from './types'
import { getState, setState, resetEditingTask, formatDate, parseDate, persistState, moveTaskToDate, loadState } from './task'
import { toggleTask as toggleTaskAction, deleteTask as deleteTaskAction, addTask, updateTask, addCategory, updateCategory, deleteCategory as deleteCategoryAction } from './task'
import { renderApp } from './render'
import { downloadExportFile, importDataFromFile } from './storage'
import { showToast } from './sync'

let draggedTaskId: string | null = null
let currentContainer: HTMLElement | null = null

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
            // 如果删除的是默认分类，清除默认设置
            if (getState().defaultCategory === id) {
              setState({ defaultCategory: '' })
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
          setState({ defaultCategory: id })
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
      const btn = container.querySelector('#forceUploadBtn') as HTMLElement
      const origHTML = btn?.innerHTML
      try {
        if (btn) btn.innerHTML = '<div class="card-title" style="color:#6b7280;">上传中...</div>'
        showSyncFeedback(container, '正在上传数据到云端...', 'info')
        const { syncToCloud } = await import('./storage')
        const { getState } = await import('./task')
        const state = getState()
        const result = await syncToCloud({
          tasks: state.tasks,
          categories: state.categories,
          defaultCategory: state.defaultCategory,
          hideCompleted: state.hideCompleted,
          hideOverdue: state.hideOverdue,
          showNoTimeLimitOnly: state.showNoTimeLimitOnly,
          darkMode: state.darkMode
        })
        if (result.success) {
          await persistState()
          showSyncFeedback(container, `上传成功 — ${state.tasks.length} 个任务已同步到云端`, 'success')
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
        const { syncFromCloud } = await import('./storage')
        const result = await syncFromCloud()
        if (result.data && result.data.tasks) {
          const { saveData } = await import('./storage')
          await saveData(result.data)
          await loadState()
          reRender()
          showSyncFeedback(container, `拉取成功 — 已恢复 ${result.data.tasks.length} 个任务`, 'success')
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
        if (result?.synced > 0) {
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

  // 拖拽功能 + 双击编辑
  setupDragAndDrop(container)
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

