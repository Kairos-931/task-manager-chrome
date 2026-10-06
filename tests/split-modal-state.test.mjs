import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const taskBundle = await build({
  entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [{
    name: 'split-modal-storage-stub',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: 'storage-stub', namespace: 'split-modal-test' }))
      buildContext.onLoad({ filter: /.*/, namespace: 'split-modal-test' }, () => ({
        loader: 'ts',
        contents: `
          let loadDataImpl = async () => ({ tasks: [], categories: [] })
          let syncImpl = async () => ({ success: false })
          globalThis.__splitModalStorageStub = {
            setLoadData(fn) { loadDataImpl = fn },
            setSync(fn) { syncImpl = fn }
          }
          export const loadData = (...args) => loadDataImpl(...args)
          export const syncIncrementally = (...args) => syncImpl(...args)
          export const getSyncDeviceIdAsync = async () => 'test-device'
          export const defaultCategories = [{ id: 'default-life', name: '生活', color: '#123456' }]
          export const generateId = () => 'generated-id'
          export const getNextLocalSettingsUpdatedAt = value => (value || 0) + 1
          export const saveData = async () => {}
        `,
      }))
    },
  }],
})
const { getState, setState, loadState } = await import(`data:text/javascript,${encodeURIComponent(taskBundle.outputFiles[0].text)}`)

const parent = {
  id: 'remote-split-target', title: 'Parent task', description: '', priority: 'medium', category: 'default-life',
  dueDate: '2026-10-06', hardDeadline: '', duration: 60, repeatType: 'none', repeatDays: [], repeatInterval: 1,
  completed: false, completedDates: [], createdAt: 1, updatedAt: 1, noTimeLimit: false, isParent: false,
}
const localData = {
  tasks: [parent], categories: [{ id: 'default-life', name: '生活', color: '#123456' }],
  defaultCategory: 'default-life', hideCompleted: false, hideOverdue: false, darkMode: false,
}

// A slow successful foreign sync refresh updates task data but keeps the live split target.
let finishRemoteSuccess
globalThis.__splitModalStorageStub.setLoadData(async () => localData)
globalThis.__splitModalStorageStub.setSync(() => new Promise(resolve => { finishRemoteSuccess = resolve }))
setState({ tasks: [parent], splittingTaskId: parent.id })
await loadState()
assert.equal(getState().splittingTaskId, parent.id, 'the initial local load preserves an open split target')
assert.equal(typeof finishRemoteSuccess, 'function')
finishRemoteSuccess({
  success: true,
  hasForeignChanges: true,
  data: { ...localData, tasks: [{ ...parent, title: 'Updated remotely', updatedAt: 2 }] },
})
await new Promise(resolve => setImmediate(resolve))
assert.equal(getState().tasks[0].title, 'Updated remotely')
assert.equal(getState().splittingTaskId, parent.id, 'a delayed successful remote refresh preserves the split target')

// A failed sync refresh does not clear the target or reset the still-open editor.
globalThis.__splitModalStorageStub.setLoadData(async () => localData)
globalThis.__splitModalStorageStub.setSync(async () => ({ success: false, error: '503' }))
setState({ splittingTaskId: parent.id })
await loadState()
await new Promise(resolve => setImmediate(resolve))
assert.equal(getState().splittingTaskId, parent.id, 'a failed remote refresh preserves the split target')

delete globalThis.__splitModalStorageStub
console.log('Split target survives delayed, successful, and failed remote refreshes')
