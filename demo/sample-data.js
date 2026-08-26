(function exposeDemoData() {
  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const dateOffset = (days) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() + days)
    return formatDate(date)
  }

  window.TaskMasterDemoData = {
    weeklyGoalMinutes: 720,
    categories: [
      { id: 'work', name: '工作', color: '#2563eb' },
      { id: 'life', name: '生活', color: '#059669' },
      { id: 'learning', name: '学习', color: '#7c3aed' },
      { id: 'ideas', name: '想法', color: '#d97706' }
    ],
    createTasks: function createTasks() {
      return [
        { id: 'demo-1', title: '整理季度产品路线图', description: '收敛目标、依赖与里程碑', priority: 'high', category: 'work', dueDate: dateOffset(0), duration: 120, completed: false, noTimeLimit: false },
        { id: 'demo-2', title: '评审移动端交互稿', description: '重点检查快速添加和默认分类', priority: 'high', category: 'work', dueDate: dateOffset(0), duration: 60, completed: true, noTimeLimit: false },
        { id: 'demo-3', title: '准备用户访谈提纲', description: '围绕任务捕获和每周复盘', priority: 'medium', category: 'work', dueDate: dateOffset(1), duration: 90, completed: false, noTimeLimit: false },
        { id: 'demo-4', title: '阅读《设计心理学》第三章', description: '', priority: 'low', category: 'learning', dueDate: dateOffset(2), duration: 45, completed: false, noTimeLimit: false },
        { id: 'demo-5', title: '完成增量同步回归测试', description: '覆盖删除、冲突与空数据保护', priority: 'high', category: 'work', dueDate: dateOffset(-1), duration: 120, completed: false, noTimeLimit: false },
        { id: 'demo-6', title: '预约周末体检', description: '', priority: 'medium', category: 'life', dueDate: dateOffset(3), duration: 30, completed: false, noTimeLimit: false },
        { id: 'demo-7', title: '复盘本周完成情况', description: '记录节奏、差距和下周调整', priority: 'medium', category: 'learning', dueDate: dateOffset(4), duration: 60, completed: false, noTimeLimit: false },
        { id: 'demo-8', title: '整理灵感收集箱', description: '', priority: 'low', category: 'ideas', dueDate: '', duration: 30, completed: false, noTimeLimit: true },
        { id: 'demo-9', title: '更新项目发布记录', description: '', priority: 'medium', category: 'work', dueDate: dateOffset(-2), duration: 45, completed: true, noTimeLimit: false },
        { id: 'demo-10', title: '晚间散步 30 分钟', description: '', priority: 'low', category: 'life', dueDate: dateOffset(0), duration: 30, completed: true, noTimeLimit: false }
      ]
    }
  }
})()
