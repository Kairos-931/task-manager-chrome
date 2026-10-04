import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { shouldRefreshAppForSyncStatus } from '../shared/sync.ts'

const [entrySource, renderSource, syncSource, taskSource, bundleSource] = await Promise.all([
  readFile(new URL('../shared/entry.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/sync.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/task.ts', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/bundle.mjs', import.meta.url), 'utf8')
])

assert.equal(shouldRefreshAppForSyncStatus('remote-updated', false), true)
assert.equal(shouldRefreshAppForSyncStatus('remote-updated', true), false)
assert.equal(shouldRefreshAppForSyncStatus('saving', false), false)
assert.equal(shouldRefreshAppForSyncStatus('local-saved', false), false)
assert.equal(shouldRefreshAppForSyncStatus('synced', false), false)
assert.equal(shouldRefreshAppForSyncStatus('idle', false), false)
assert.equal(shouldRefreshAppForSyncStatus('error', false), false)

assert.match(renderSource, /id="syncIndicatorSlot" aria-live="polite"/)
assert.match(entrySource, /indicatorSlot\.innerHTML = renderSyncIndicator\(\)/)
assert.match(entrySource, /shouldRefreshAppForSyncStatus\(status, isTaskModalOpen\)/)
assert.match(entrySource, /isInteractiveTaskModalOpen[\s\S]*#splitTaskModal/)
assert.doesNotMatch(entrySource, /initSyncMonitor/)
assert.doesNotMatch(syncSource, /reRenderFn/)
assert.match(taskSource, /editingTask: activeEditingTask/)
assert.match(taskSource, /activeSplittingTaskId = state\.splittingTaskId[\s\S]*splittingTaskId: activeSplittingTaskId/)

const sharedEntryUses = bundleSource.match(/entryPoints: \[join\(rootDir, 'shared\/entry\.ts'\)\]/g) || []
assert.equal(sharedEntryUses.length, 2, 'popup and newtab should both use the protected shared entry')

// 远端变化到达时，拆分弹窗也属于编辑态，不能被重渲染替换掉刚新增的行。
const previousDocument = globalThis.document
const previousWindow = globalThis.window
globalThis.document = { readyState: 'loading', addEventListener() {} }
globalThis.window = { location: { pathname: '/newtab/newtab.html' } }
const entryBundle = await build({
  stdin: {
    contents: "export { isInteractiveTaskModalOpen } from './shared/entry.ts';",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'task-modal-sync-stability-entry.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { isInteractiveTaskModalOpen } = await import(`data:text/javascript,${encodeURIComponent(entryBundle.outputFiles[0].text)}`)
const modal = hidden => ({ classList: { contains: className => hidden && className === 'hidden' } })
const modalContainer = (taskModal, splitModal) => ({
  querySelector(selector) { return selector === '#taskModal' ? taskModal : selector === '#splitTaskModal' ? splitModal : null }
})
assert.equal(isInteractiveTaskModalOpen(modalContainer(modal(true), modal(false))), true)
assert.equal(isInteractiveTaskModalOpen(modalContainer(modal(true), modal(true))), false)
globalThis.document = previousDocument
globalThis.window = previousWindow

console.log('Task modal sync stability tests passed')
