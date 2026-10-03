import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const output = await build({
  entryPoints: [fileURLToPath(new URL('../shared/task-draft.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'fake-account', setup(builder) {
    builder.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: 'account', namespace: 'test' }))
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const getGoogleAccount = async () => globalThis.testAccount', loader: 'js' }))
  } }]
})
const { TaskDraftStore, draftContext, draftSessionId, readLatestTaskDraft } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`)
const data = new Map()
let delayNextSet = false
let releaseSet = null
globalThis.testAccount = null
globalThis.window = { location: { pathname: '/popup/popup.html' } }
globalThis.chrome = {
  runtime: { lastError: null },
  tabs: { getCurrent: callback => callback({ id: 22 }) },
  storage: { local: {
    get: (keys, callback) => callback(Object.fromEntries(keys.filter(key => data.has(key)).map(key => [key, data.get(key)]))),
    set: (values, callback) => {
      if (delayNextSet) {
        delayNextSet = false
        releaseSet = () => { for (const [key, value] of Object.entries(values)) data.set(key, value); callback() }
        return
      }
      for (const [key, value] of Object.entries(values)) data.set(key, value)
      callback()
    },
    remove: (key, callback) => { data.delete(key); callback() }
  } }
}

const draft = context => ({ version: 1, context, updated: 1, mode: 'normal', fields: { title: '虚构任务' }, children: [] })
assert.equal(await draftContext(), 'popup:guest')
assert.equal(await draftSessionId(), 'active')
globalThis.testAccount = { sub: 'account-a', connected: true }
assert.equal(await draftContext(), 'popup:account-a')
const a = new TaskDraftStore('popup:account-a', 'active')
await a.save(draft('popup:account-a'))
assert.deepEqual((await readLatestTaskDraft('popup:account-a', 'active')).draft?.fields, { title: '虚构任务' })
assert.equal((await readLatestTaskDraft('popup:account-b', 'active')).draft, undefined)
assert.equal((await readLatestTaskDraft('newtab:account-a', 'tab-22')).draft, undefined)
await a.clear()
assert.equal(await a.read(), undefined)

delayNextSet = true
const inFlight = a.save(draft('popup:account-a'))
await Promise.resolve()
const clearing = a.clear()
assert.ok(releaseSet, 'the write started before clear')
releaseSet()
await Promise.all([inFlight, clearing])
assert.equal(await a.read(), undefined, 'clear waits for and removes an in-flight write')

const generation = a.snapshot()
await a.clear()
await a.save(draft('popup:account-a'), generation)
assert.equal(await a.read(), undefined, 'a delayed pre-clear write cannot revive a cleared draft')

globalThis.window.location.pathname = '/newtab/newtab.html'
assert.equal(await draftSessionId(), 'tab-22')
const tab22 = new TaskDraftStore('newtab:account-a', 'tab-22')
const tab23 = new TaskDraftStore('newtab:account-a', 'tab-23')
await tab22.save(draft('newtab:account-a'))
assert.equal(await tab23.read(), undefined, 'another tab has its own storage slot')

const source = await readFile(new URL('../shared/events.ts', import.meta.url), 'utf8')
assert.match(source, /currentDraftConflict\(\)/)
assert.match(source, /await draftContext\(\) !== activeDraftStore\.context/)
assert.match(source, /if \(!saved\) \{[\s\S]*?saveDraft\(\)/)
assert.match(source, /clearDraft\(\)[\s\S]*?resetEditingTask\(\)/)
const taskOutput = await build({ entryPoints: [fileURLToPath(new URL('../shared/task.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { getState, setState, createParentWithChildrenPersisted } = await import(`data:text/javascript,${encodeURIComponent(taskOutput.outputFiles[0].text)}`)
setState({ tasks: [] })
const parentData = { title: '虚构父任务', description: '', priority: 'medium', category: 'default-work', completed: false, noTimeLimit: true, repeatType: 'none', repeatDays: [], repeatInterval: 1 }
const children = [{ title: '步骤一', duration: 60, dueDate: '2026-10-03' }, { title: '步骤二', duration: 60, dueDate: '2026-10-04' }]
assert.equal(await createParentWithChildrenPersisted(parentData, children, async () => false, 'stable-parent-id'), false)
assert.equal(getState().tasks.length, 0)
assert.equal(await createParentWithChildrenPersisted(parentData, children, async () => true, 'stable-parent-id'), true)
assert.equal(getState().tasks.filter(task => task.id === 'stable-parent-id').length, 1)
assert.equal(getState().tasks.filter(task => task.parentId === 'stable-parent-id').length, 2)
console.log('Task draft storage, context isolation, clear ordering, and form guard tests passed')
