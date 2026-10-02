import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const bundle = async (contents, sourcefile) => {
  const result = await build({
    stdin: { contents, resolveDir: repoRoot, sourcefile },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  })
  return import(`data:text/javascript,${encodeURIComponent(result.outputFiles[0].text)}`)
}

globalThis.document = {
  createElement() {
    let text = ''
    return {
      set textContent(value) { text = String(value) },
      get innerHTML() { return text },
    }
  },
}
globalThis.window = { location: { pathname: '/popup/popup.html' } }

const { renderHeader, renderSyncModal } = await bundle(
  "export { renderHeader, renderSyncModal } from './shared/render.ts';",
  'google-account-ui-render-entry.ts',
)
const popupHeader = renderHeader()
assert.match(popupHeader, /id="syncDataBtn"[^>]*aria-label="账号与云同步"[^>]*>账号同步/)
assert.match(renderSyncModal(), /class="google-account-panel[\s\S]*?使用 Google 登录/)

globalThis.window.location.pathname = '/newtab/newtab.html'
const newtabHeader = renderHeader()
assert.match(newtabHeader, /id="syncDataBtn"/)
assert.doesNotMatch(newtabHeader, /账号与云同步/)

const originalChrome = globalThis.chrome
const originalFetch = globalThis.fetch
const localValues = new Map()
const messages = []
const guestData = {
  tasks: [{ id: 'guest-task', title: '离线任务' }],
  categories: [], defaultCategory: '', hideCompleted: false, hideOverdue: false,
  showNoTimeLimitOnly: false, darkMode: false,
}
localValues.set('tm_local_backup', JSON.stringify(guestData))

globalThis.chrome = {
  storage: {
    local: {
      get(keys, callback) {
        const requested = keys === null ? [...localValues.keys()] : Array.isArray(keys) ? keys : [keys]
        callback(Object.fromEntries(requested.filter(key => localValues.has(key)).map(key => [key, localValues.get(key)])))
      },
      set(values, callback) {
        for (const [key, value] of Object.entries(values)) localValues.set(key, value)
        callback()
      },
      remove(keys, callback) {
        for (const key of (Array.isArray(keys) ? keys : [keys])) localValues.delete(key)
        callback()
      },
    },
  },
  runtime: {
    lastError: null,
    sendMessage(message) {
      messages.push(message)
      return Promise.resolve()
    },
  },
}
globalThis.fetch = async input => {
  const url = String(input)
  if (url.endsWith('/api/google/extension-auth/exchange')) {
    return new Response(JSON.stringify({
      user: { sub: 'google-sub-1', email: 'user@example.com' },
      sessionToken: 'session-token-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  if (url.endsWith('/api/google/session/logout')) return new Response('{}', { status: 200 })
  return new Response('{}', { status: 404 })
}

try {
  const { activateGoogleAccount, disconnectGoogleAccount, getGoogleAccount } = await bundle(
    "export { activateGoogleAccount, disconnectGoogleAccount, getGoogleAccount } from './shared/storage.ts';",
    'google-account-ui-storage-entry.ts',
  )
  await activateGoogleAccount({
    user: { sub: 'google-sub-1', email: 'user@example.com' },
    grant: { code: 'code', state: 'state', codeVerifier: 'verifier' },
  })
  assert.equal((await getGoogleAccount()).connected, true)
  assert.equal(JSON.parse(localValues.get('tm_local_backup')).tasks[0].id, 'guest-task')
  assert.deepEqual(messages.map(message => message.action), ['googleAccountSyncUpdated'])

  await disconnectGoogleAccount()
  assert.equal((await getGoogleAccount()).connected, false)
  assert.equal(JSON.parse(localValues.get('tm_local_backup')).tasks[0].id, 'guest-task')
  assert.deepEqual(messages.map(message => message.action), [
    'googleAccountSyncUpdated', 'googleAccountSyncUpdated',
  ])
} finally {
  globalThis.fetch = originalFetch
  if (originalChrome === undefined) delete globalThis.chrome
  else globalThis.chrome = originalChrome
}

console.log('Google account popup entry and cross-surface update tests passed')
