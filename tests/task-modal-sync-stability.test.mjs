import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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
assert.doesNotMatch(entrySource, /initSyncMonitor/)
assert.doesNotMatch(syncSource, /reRenderFn/)
assert.match(taskSource, /editingTask: activeEditingTask/)

const sharedEntryUses = bundleSource.match(/entryPoints: \[join\(rootDir, 'shared\/entry\.ts'\)\]/g) || []
assert.equal(sharedEntryUses.length, 2, 'popup and newtab should both use the protected shared entry')

console.log('Task modal sync stability tests passed')
