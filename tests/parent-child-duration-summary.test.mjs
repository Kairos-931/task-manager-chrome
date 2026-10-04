import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: "export { getParentChildDuration, setState } from './shared/task.ts'; export { renderTaskItem } from './shared/render.ts';",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'parent-child-duration-summary-entry.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { getParentChildDuration, setState, renderTaskItem } = await import(`data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`)

globalThis.document = {
  createElement() {
    let text = ''
    return {
      set textContent(value) { text = String(value) },
      get innerHTML() { return text }
    }
  }
}

const parent = {
  id: 'parent-summary', title: '父任务', description: '', priority: 'medium', category: '',
  dueDate: '', duration: 0, repeatType: 'none', repeatDays: [], repeatInterval: 1,
  completed: false, completedDates: [], createdAt: 1, updatedAt: 1, noTimeLimit: true, isParent: true
}
const completedChild = {
  id: 'child-completed', parentId: parent.id, title: '已完成步骤', description: '', priority: 'medium', category: '',
  dueDate: '2099-01-01', duration: 30, repeatType: 'none', repeatDays: [], repeatInterval: 1,
  completed: true, completedDates: [], createdAt: 1, updatedAt: 1, noTimeLimit: false
}
const pendingChild = { ...completedChild, id: 'child-pending', title: '待办步骤', duration: 90, completed: false }
const invalidChild = { ...completedChild, id: 'child-invalid', title: '异常步骤', duration: Number.NaN, completed: false }
const nestedChild = { ...completedChild, id: 'nested-child', parentId: completedChild.id, title: '更深层步骤', duration: 600, completed: false }

setState({ tasks: [parent, completedChild, pendingChild, invalidChild, nestedChild], categories: [] })
assert.equal(getParentChildDuration(parent), 120, '汇总应包含已完成与未完成直属子任务，并忽略异常时长')
assert.equal(parent.duration, 0, '汇总不能回写父任务 duration')

globalThis.window = { location: { pathname: '/popup/popup.html' } }
assert.match(renderTaskItem(parent), /子任务合计 2h/, 'Popup 父任务卡片应显示汇总')

globalThis.window.location.pathname = '/newtab/newtab.html'
assert.match(renderTaskItem(parent), /子任务合计 2h/, '新标签页父任务卡片应显示汇总')

console.log('Parent-child duration summary tests passed')
