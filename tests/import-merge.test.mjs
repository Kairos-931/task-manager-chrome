import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const output = await build({
  entryPoints: [fileURLToPath(new URL('../shared/import-merge.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const { planImportMerge, validateImportObject } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`)

const category = (id, name = id) => ({ id, name, color: '#123456', updatedAt: 1 })
const task = (id, title, options = {}) => ({
  id,
  title,
  description: '',
  priority: 'medium',
  category: options.category || 'cat-a',
  dueDate: '',
  duration: 30,
  repeatType: 'none',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: [],
  createdAt: options.createdAt ?? 10,
  updatedAt: options.updatedAt ?? 10,
  noTimeLimit: true,
  ...(options.isParent ? { isParent: true } : {}),
  ...(options.parentId ? { parentId: options.parentId } : {}),
  ...(options.description ? { description: options.description } : {}),
})
const data = (tasks = [], categories = [category('cat-a')], overrides = {}) => ({
  tasks, categories, defaultCategory: 'cat-a', hideCompleted: true, hideOverdue: false,
  showNoTimeLimitOnly: false, darkMode: true, weeklyGoalMinutes: 400, ...overrides,
})
const noDeletes = { reliable: true, tasks: new Set(), categories: new Set(), source: 'google' }
const backup = (value, extra = {}) => ({
  formatVersion: 2,
  data: value,
  ...extra,
})

const parsedDuplicates = validateImportObject(backup(data([
  task('same', '一致任务', { updatedAt: 20 }),
  task('same', '一致任务', { updatedAt: 30 }),
])))
assert.equal(parsedDuplicates.valid, true)
assert.equal(parsedDuplicates.data.tasks.length, 1)
assert.equal(parsedDuplicates.duplicateTasks, 1)

const currentOnly = task('local-only', '仅本机任务')
const fileOnly = task('file-only', '仅备份任务')
const current = data([currentOnly], [category('cat-a')], { hideCompleted: false, weeklyGoalMinutes: 650 })
const file = data([fileOnly], [category('cat-a')], { hideCompleted: true, weeklyGoalMinutes: 100 })
const firstMerge = planImportMerge(current, file, noDeletes, {}, new Set(), new Set(), 0, 0, 100)
assert.equal(firstMerge.valid, true)
assert.deepEqual(firstMerge.data.tasks.map(item => item.id).sort(), ['file-only', 'local-only'])
assert.equal(firstMerge.tasks.added, 1)
assert.equal(firstMerge.tasks.retained, 1)
assert.equal(firstMerge.data.hideCompleted, false, 'personal settings stay local')
assert.equal(firstMerge.data.weeklyGoalMinutes, 650, 'weekly goal stays local')
const secondMerge = planImportMerge(firstMerge.data, file, noDeletes, {}, new Set(), new Set(), 0, 0, 101)
assert.equal(secondMerge.tasks.added, 0, 're-import does not create another task')
assert.equal(secondMerge.tasks.skipped, 1, 'the matching stable ID is skipped')
assert.equal(secondMerge.data.tasks.length, 2)

const currentConflict = task('conflict', '当前版本', { createdAt: 77, updatedAt: 90 })
const fileConflict = task('conflict', '备份版本', { createdAt: 1, updatedAt: 1 })
const conflictCurrentDefault = planImportMerge(data([currentConflict]), data([fileConflict]), noDeletes, {}, new Set(), new Set(), 0, 0, 200)
assert.equal(conflictCurrentDefault.tasks.updated, 0)
assert.equal(conflictCurrentDefault.tasks.conflicts[0].choice, 'current')
assert.equal(conflictCurrentDefault.data.tasks[0].title, '当前版本')
const conflictTakeFile = planImportMerge(
  data([currentConflict]), data([fileConflict]), noDeletes,
  { 'task:conflict': 'file' }, new Set(), new Set(), 0, 0, 200,
)
assert.equal(conflictTakeFile.tasks.updated, 1)
assert.equal(conflictTakeFile.data.tasks[0].title, '备份版本')
assert.equal(conflictTakeFile.data.tasks[0].id, 'conflict')
assert.equal(conflictTakeFile.data.tasks[0].createdAt, 77, 'choosing the file keeps current system creation metadata')
assert.equal(conflictTakeFile.data.tasks[0].updatedAt, 200)

const sameTitleMerge = planImportMerge(
  data([task('id-a', '相同标题')]),
  data([task('id-b', '相同标题')]),
  noDeletes,
)
assert.equal(sameTitleMerge.tasks.added, 1)
assert.equal(sameTitleMerge.data.tasks.length, 2, 'same titles with different IDs remain separate')

const parent = task('parent', '父任务', { isParent: true })
const child = task('child', '子任务', { parentId: 'parent' })
const sameNameCategories = [category('cat-a', '工作'), category('cat-b', '工作')]
const linkedMerge = planImportMerge(
  data([], [category('cat-a', '工作')]),
  data([parent, child], sameNameCategories),
  noDeletes,
)
assert.equal(linkedMerge.valid, true)
assert.equal(linkedMerge.data.categories.length, 2, 'same-name category IDs remain separate')
assert.equal(linkedMerge.data.tasks.find(item => item.id === 'child').parentId, 'parent')

const tombstoneHistory = { ...noDeletes, tasks: new Set(['deleted']) }
const deletedBackup = data([task('deleted', '已删除旧任务')])
const deletedSkipped = planImportMerge(data(), deletedBackup, tombstoneHistory)
assert.equal(deletedSkipped.tasks.added, 0)
assert.equal(deletedSkipped.tasks.skipped, 1)
assert.equal(deletedSkipped.tasks.deleted[0].restored, false)
const deletedRestored = planImportMerge(data(), deletedBackup, tombstoneHistory, {}, new Set(['deleted']))
assert.equal(deletedRestored.tasks.added, 1)
assert.equal(deletedRestored.tasks.deleted[0].restored, true)

const tombstonedParentHistory = { ...noDeletes, tasks: new Set(['parent']) }
const parentAndChild = data([parent, child])
const cascadeSkip = planImportMerge(data(), parentAndChild, tombstonedParentHistory)
assert.equal(cascadeSkip.data.tasks.length, 0, 'a child is not imported without its deleted parent')
assert.deepEqual(cascadeSkip.tasks.blocked.map(item => item.id), ['child'])
const cascadeRestore = planImportMerge(data(), parentAndChild, tombstonedParentHistory, {}, new Set(['parent']))
assert.equal(cascadeRestore.data.tasks.length, 2)

const deletedCategoryHistory = { ...noDeletes, categories: new Set(['cat-a']) }
const categoryTombstoneSkip = planImportMerge(data([], []), data([task('uses-deleted', '依赖已删分类')]), deletedCategoryHistory)
assert.equal(categoryTombstoneSkip.data.tasks.length, 0)
assert.equal(categoryTombstoneSkip.tasks.blocked.length, 1)
const categoryRestored = planImportMerge(
  data([], []), data([task('uses-deleted', '依赖已删分类')]), deletedCategoryHistory,
  {}, new Set(), new Set(['cat-a']),
)
assert.equal(categoryRestored.data.categories.length, 1)
assert.equal(categoryRestored.data.tasks.length, 1)

const missingId = validateImportObject(backup(data([{ ...task('broken', '坏记录'), id: '' }])))
assert.equal(missingId.valid, false, 'missing IDs are rejected before merge')
const conflictInsideFile = validateImportObject(backup(data([
  task('dup', '版本一'), task('dup', '版本二'),
])))
assert.equal(conflictInsideFile.valid, false, 'same ID with different backup content is invalid')
const orphanChild = planImportMerge(data(), data([task('orphan', '孤儿子任务', { parentId: 'missing-parent' })]), noDeletes)
assert.equal(orphanChild.valid, false, 'missing parent references block the entire import')

console.log('✓ backup import merge tests passed')
