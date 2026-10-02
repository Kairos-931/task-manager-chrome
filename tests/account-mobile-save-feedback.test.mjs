import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { renderAccountMobilePage } from '../backend/account-mobile.js'

const ACCOUNT_SUB = 'mobile-save-feedback-test-user'
const SESSION_KEY = 'tm_google_mobile_session_v1'
const PENDING_KEY = `tm_mobile_pending_task_v1:${ACCOUNT_SUB}`
let uuid = 0
const mobileSession = (sub = ACCOUNT_SUB, expiresAt = Date.now() + 60_000, token = 'mobile-session-token') => JSON.stringify({
  user: { sub, email: `${sub}@example.test`, name: 'Mobile' },
  sessionToken: token,
  expiresAt,
})

class FakeClassList {
  values = new Set()
  add(...values) { for (const value of values) this.values.add(value) }
  remove(...values) { for (const value of values) this.values.delete(value) }
  contains(value) { return this.values.has(value) }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName
    this.value = ''
    this.checked = false
    this.disabled = false
    this.hidden = false
    this.required = false
    this.textContent = ''
    this.children = []
    this.listeners = new Map()
    this.classList = new FakeClassList()
  }
  addEventListener(name, callback) { this.listeners.set(name, callback) }
  replaceChildren(...children) {
    this.children = children
    if (this.tagName === 'select' && children.length && !children.some(child => child.value === this.value)) {
      this.value = children[0].value
    }
  }
  focus() {}
}

const makeStorage = (entries = []) => {
  const values = new Map(entries)
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
  }
}

const jsonResponse = (status, value) => ({
  status,
  ok: status >= 200 && status < 300,
  async json() { return value },
})

const makeHarness = ({
  storage, persistentStorage, seedSession = true, handleTask, handleCategories, handleIdentity,
  handleLogout, googleAvailable = true, fastTimeout = false,
} = {}) => {
  const sessionStorage = storage || makeStorage()
  if (seedSession && !sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      user: { sub: ACCOUNT_SUB, email: 'mobile@example.test', name: 'Mobile' },
      sessionToken: 'mobile-session-token',
      expiresAt: Date.now() + 60_000,
    }))
  }
  const localStorage = persistentStorage || makeStorage([['tm_mobile_device_id', 'mobile-device-id']])
  const elements = new Map()
  const getElement = id => {
    if (!elements.has(id)) {
      const tagName = id === 'category' ? 'select' : 'div'
      elements.set(id, new FakeElement(tagName))
      if (['saveFeedback', 'saveFeedbackRetry', 'saveFeedbackDismiss', 'taskCard', 'signOutBtn', 'restartLoginBtn', 'setupNotice'].includes(id)) {
        elements.get(id).hidden = true
      }
    }
    return elements.get(id)
  }
  const document = {
    getElementById: getElement,
    createElement: tagName => new FakeElement(tagName),
  }
  const login = { callback: null, authStarts: 0, logouts: 0, reloads: 0 }
  const window = {
    google: googleAvailable ? { accounts: { id: {
      initialize(config) { login.callback = config.callback },
      renderButton() {},
      disableAutoSelect() {},
    } } } : undefined,
    location: { reload() { login.reloads += 1 } },
  }
  const requests = []
  const fetch = async (url, options = {}) => {
    if (url === '/api/account/categories') {
      return handleCategories
        ? handleCategories(options)
        : jsonResponse(200, { userSub: ACCOUNT_SUB, categories: [{ id: 'default-life', name: '生活' }] })
    }
    if (url === '/api/google/mobile-auth/start') {
      login.authStarts += 1
      return jsonResponse(200, { state: 'test-state', nonce: 'test-nonce' })
    }
    if (url === '/api/google/identity' && handleIdentity) return handleIdentity(options)
    if (url === '/api/google/session/logout') {
      login.logouts += 1
      return handleLogout ? handleLogout(options) : jsonResponse(200, { ok: true })
    }
    if (url === '/api/account/tasks') {
      const request = JSON.parse(options.body)
      requests.push(request)
      return handleTask(request, options, requests.length)
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  let feedbackTimerId = 0
  const feedbackTimers = new Map()
  const pageSetTimeout = (callback, delay, ...args) => {
    if (delay === 1800) {
      const id = ++feedbackTimerId
      feedbackTimers.set(id, () => callback(...args))
      return id
    }
    if (fastTimeout && delay === 15_000) return setTimeout(callback, 0, ...args)
    return setTimeout(callback, delay, ...args)
  }
  const pageClearTimeout = id => {
    if (feedbackTimers.delete(id)) return
    clearTimeout(id)
  }
  const html = renderAccountMobilePage({ GOOGLE_WEB_CLIENT_ID: 'test-client-id' })
  assert.match(html, /id="saveFeedback" role="status" aria-live="polite"/)
  const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1]
  assert.ok(script, 'the mobile page should render its inline application script')
  runInNewContext(script, {
    AbortController,
    clearTimeout: pageClearTimeout,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
    document,
    fetch,
    localStorage,
    sessionStorage,
    setTimeout: pageSetTimeout,
    window,
  })
  const ready = async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  const flushFeedbackTimer = () => {
    for (const [id, callback] of feedbackTimers) {
      feedbackTimers.delete(id)
      callback()
    }
  }
  return { elements, requests, localStorage, sessionStorage, login, ready, flushFeedbackTimer }
}

const uncertainStorage = makeStorage()
const timedOutPage = makeHarness({
  storage: uncertainStorage,
  fastTimeout: true,
  handleTask: (_request, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('request timed out')), { once: true })
  }),
})
await timedOutPage.ready()
assert.ok(timedOutPage.localStorage.getItem(SESSION_KEY), 'the previous tab session should migrate to persistent storage')
assert.equal(uncertainStorage.getItem(SESSION_KEY), null)
timedOutPage.elements.get('title').value = 'Timeout-safe task'
timedOutPage.elements.get('description').value = 'Keep this note after a timeout'
timedOutPage.elements.get('completed').checked = true
const firstSaveAttempt = timedOutPage.elements.get('submitBtn').listeners.get('click')()
const duplicateClickAttempt = timedOutPage.elements.get('submitBtn').listeners.get('click')()
assert.equal(timedOutPage.elements.get('saveFeedback').hidden, false)
assert.equal(timedOutPage.elements.get('saveFeedback').classList.contains('saving'), true)
assert.equal(timedOutPage.elements.get('saveFeedbackRetry').hidden, true)
await Promise.all([firstSaveAttempt, duplicateClickAttempt])
assert.equal(timedOutPage.requests.length, 1)
assert.match(timedOutPage.elements.get('status').textContent, /任务可能已保存/)
assert.equal(timedOutPage.elements.get('status').classList.contains('uncertain'), true)
assert.equal(timedOutPage.elements.get('title').value, 'Timeout-safe task')
assert.equal(timedOutPage.elements.get('title').disabled, true)
assert.equal(timedOutPage.elements.get('submitBtn').textContent, '安全重试保存')
assert.equal(timedOutPage.elements.get('saveFeedback').classList.contains('uncertain'), true)
assert.equal(timedOutPage.elements.get('saveFeedbackRetry').textContent, '安全重试保存')
assert.equal(timedOutPage.elements.get('saveFeedbackRetry').hidden, false)
assert.ok(uncertainStorage.getItem(PENDING_KEY))

const reloadPage = makeHarness({
  storage: uncertainStorage,
  handleTask: request => jsonResponse(200, {
    ok: true,
    alreadyProcessed: true,
    task: { id: request.clientTaskId },
  }),
})
await reloadPage.ready()
assert.equal(reloadPage.elements.get('title').value, 'Timeout-safe task')
assert.equal(reloadPage.elements.get('description').value, 'Keep this note after a timeout')
assert.equal(reloadPage.elements.get('completed').checked, true)
assert.equal(reloadPage.elements.get('title').disabled, true)
assert.equal(reloadPage.elements.get('submitBtn').textContent, '安全重试保存')
await reloadPage.elements.get('saveFeedbackRetry').listeners.get('click')()
assert.equal(reloadPage.requests.length, 1)
assert.equal(reloadPage.requests[0].clientTaskId, timedOutPage.requests[0].clientTaskId)
assert.equal(reloadPage.requests[0].title, timedOutPage.requests[0].title)
assert.equal(reloadPage.requests[0].completed, true)
assert.equal(reloadPage.elements.get('status').textContent, '已确认此前已保存到账号，电脑联网后会自动同步。')
assert.equal(reloadPage.elements.get('title').value, '')
assert.equal(reloadPage.elements.get('title').disabled, false)
assert.equal(reloadPage.elements.get('completed').checked, false)
assert.equal(uncertainStorage.getItem(PENDING_KEY), null)
assert.equal(reloadPage.elements.get('saveFeedback').hidden, false)
assert.equal(reloadPage.elements.get('saveFeedback').classList.contains('success'), true)
assert.equal(reloadPage.elements.get('saveFeedbackDismiss').textContent, '继续添加')
reloadPage.elements.get('title').value = 'Next task without waiting for the popup'
await reloadPage.elements.get('submitBtn').listeners.get('click')()
assert.equal(reloadPage.requests.length, 2, 'a visible success popup must not block the next task')
assert.notEqual(reloadPage.requests[1].clientTaskId, reloadPage.requests[0].clientTaskId)
reloadPage.flushFeedbackTimer()
assert.equal(reloadPage.elements.get('saveFeedback').hidden, true, 'success feedback closes automatically')

const expiredRetryStorage = makeStorage()
const beforeExpiredRetry = makeHarness({
  storage: expiredRetryStorage,
  fastTimeout: true,
  handleTask: (_request, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('request timed out')), { once: true })
  }),
})
await beforeExpiredRetry.ready()
beforeExpiredRetry.elements.get('title').value = 'Retry after reauthentication'
await beforeExpiredRetry.elements.get('submitBtn').listeners.get('click')()
const expiredRetryId = beforeExpiredRetry.requests[0].clientTaskId

const expiredRetryPage = makeHarness({
  storage: expiredRetryStorage,
  handleTask: () => jsonResponse(401, { error: 'Session expired' }),
})
await expiredRetryPage.ready()
await expiredRetryPage.elements.get('submitBtn').listeners.get('click')()
assert.ok(expiredRetryStorage.getItem(PENDING_KEY), 'an expired session must not discard an uncertain request ID')
assert.match(expiredRetryPage.elements.get('loginHelp').textContent, /上次保存结果仍未确认/)
assert.equal(expiredRetryPage.elements.get('saveFeedback').hidden, false)
assert.equal(expiredRetryPage.elements.get('saveFeedbackRetry').hidden, true, 'expired login cannot retry without a session')

expiredRetryStorage.setItem(SESSION_KEY, JSON.stringify({
  user: { sub: ACCOUNT_SUB, email: 'mobile@example.test', name: 'Mobile' },
  sessionToken: 'refreshed-mobile-session-token',
  expiresAt: Date.now() + 60_000,
}))
const reauthenticatedPage = makeHarness({
  storage: expiredRetryStorage,
  handleTask: request => jsonResponse(200, {
    ok: true,
    alreadyProcessed: true,
    task: { id: request.clientTaskId },
  }),
})
await reauthenticatedPage.ready()
assert.equal(reauthenticatedPage.elements.get('submitBtn').textContent, '安全重试保存')
await reauthenticatedPage.elements.get('submitBtn').listeners.get('click')()
assert.equal(reauthenticatedPage.requests[0].clientTaskId, expiredRetryId)
assert.equal(reauthenticatedPage.elements.get('title').value, '')

let deletedRequestAttempts = 0
const deletedTaskPage = makeHarness({
  handleTask: request => {
    deletedRequestAttempts += 1
    if (deletedRequestAttempts === 1) return jsonResponse(200, {
      ok: true,
      previouslyDeleted: true,
      taskId: request.clientTaskId,
    })
    return jsonResponse(201, { ok: true, task: { id: request.clientTaskId } })
  },
})
await deletedTaskPage.ready()
deletedTaskPage.elements.get('title').value = 'Re-add after checking deletion'
await deletedTaskPage.elements.get('submitBtn').listeners.get('click')()
const deletedRequestId = deletedTaskPage.requests[0].clientTaskId
assert.equal(deletedTaskPage.elements.get('title').value, 'Re-add after checking deletion')
assert.equal(deletedTaskPage.elements.get('submitBtn').textContent, '重新添加')
assert.match(deletedTaskPage.elements.get('status').textContent, /电脑端删除/)
await deletedTaskPage.elements.get('submitBtn').listeners.get('click')()
assert.notEqual(deletedTaskPage.requests[1].clientTaskId, deletedRequestId)
assert.equal(deletedTaskPage.elements.get('status').textContent, '已保存到账号，电脑联网后会自动同步。')

let definiteFailureAttempts = 0
const definiteFailurePage = makeHarness({
  handleTask: request => {
    definiteFailureAttempts += 1
    if (definiteFailureAttempts === 1) return jsonResponse(400, { error: 'Invalid task date' })
    return jsonResponse(201, { ok: true, task: { id: request.clientTaskId } })
  },
})
await definiteFailurePage.ready()
definiteFailurePage.elements.get('title').value = 'Retry after rejection'
definiteFailurePage.elements.get('description').value = 'This content must remain'
await definiteFailurePage.elements.get('submitBtn').listeners.get('click')()
assert.equal(definiteFailurePage.elements.get('status').textContent, 'Invalid task date 内容仍保留，请修正后重试。')
assert.equal(definiteFailurePage.elements.get('title').value, 'Retry after rejection')
assert.equal(definiteFailurePage.elements.get('title').disabled, false)
assert.equal(definiteFailurePage.elements.get('submitBtn').textContent, '重试添加')
assert.equal(definiteFailurePage.elements.get('saveFeedback').classList.contains('error'), true)
assert.equal(definiteFailurePage.elements.get('saveFeedbackRetry').hidden, false)
definiteFailurePage.elements.get('saveFeedbackDismiss').listeners.get('click')()
assert.equal(definiteFailurePage.elements.get('saveFeedback').hidden, true)
assert.match(definiteFailurePage.elements.get('status').textContent, /内容仍保留/)
await definiteFailurePage.elements.get('saveFeedbackRetry').listeners.get('click')()
assert.notEqual(definiteFailurePage.requests[0].clientTaskId, definiteFailurePage.requests[1].clientTaskId)
assert.equal(definiteFailurePage.elements.get('status').textContent, '已保存到账号，电脑联网后会自动同步。')
assert.equal(definiteFailurePage.elements.get('title').value, '')

const restoredStorage = makeStorage([[SESSION_KEY, mobileSession()]])
const restoredExpiresAt = JSON.parse(restoredStorage.getItem(SESSION_KEY)).expiresAt
let finishValidation
const pendingRestorePage = makeHarness({
  seedSession: false,
  persistentStorage: restoredStorage,
  handleCategories: () => new Promise(resolve => { finishValidation = resolve }),
})
assert.equal(pendingRestorePage.elements.get('accountTitle').textContent, '正在恢复登录…')
assert.equal(pendingRestorePage.elements.get('accountEmail').textContent, '正在确认已保存的账号')
assert.equal(pendingRestorePage.elements.get('taskCard').hidden, true, 'cached account data stays hidden until the server confirms it')
finishValidation(jsonResponse(200, { userSub: ACCOUNT_SUB, categories: [{ id: 'default-life', name: '生活' }] }))
await pendingRestorePage.ready()
assert.equal(pendingRestorePage.elements.get('accountTitle').textContent, '已连接 Google 账号')
assert.equal(pendingRestorePage.elements.get('taskCard').hidden, false)
assert.equal(pendingRestorePage.login.authStarts, 0, 'a valid session should not start a new Google flow')
assert.equal(JSON.parse(restoredStorage.getItem(SESSION_KEY)).expiresAt, restoredExpiresAt, 'recovery cannot extend the session lifetime')

const noGoogleScriptPage = makeHarness({ seedSession: false, persistentStorage: restoredStorage, googleAvailable: false })
await noGoogleScriptPage.ready()
assert.equal(noGoogleScriptPage.elements.get('taskCard').hidden, false, 'session recovery should not wait for the Google script')
assert.equal(noGoogleScriptPage.login.authStarts, 0)

const newlySignedInStorage = makeStorage()
const newlySignedInPage = makeHarness({
  seedSession: false,
  persistentStorage: newlySignedInStorage,
  handleIdentity: () => jsonResponse(200, {
    user: { sub: ACCOUNT_SUB, email: 'mobile@example.test', name: 'Mobile' },
    sessionToken: 'new-mobile-session-token',
    expiresAt: Date.now() + 60_000,
  }),
})
await newlySignedInPage.ready()
assert.equal(newlySignedInPage.login.authStarts, 1)
assert.equal(typeof newlySignedInPage.login.callback, 'function')
await newlySignedInPage.login.callback({ credential: 'test-google-credential' })
assert.equal(JSON.parse(newlySignedInStorage.getItem(SESSION_KEY)).sessionToken, 'new-mobile-session-token')
assert.equal(newlySignedInPage.sessionStorage.getItem(SESSION_KEY), null)
const reopenedPage = makeHarness({ seedSession: false, persistentStorage: newlySignedInStorage })
await reopenedPage.ready()
assert.equal(reopenedPage.elements.get('taskCard').hidden, false, 'a new tab in the same browser restores the saved session')
assert.equal(reopenedPage.login.authStarts, 0)
reopenedPage.elements.get('title').value = 'Private draft from the old account'
await reopenedPage.elements.get('signOutBtn').listeners.get('click')()
assert.equal(reopenedPage.login.logouts, 1)
assert.equal(newlySignedInStorage.getItem(SESSION_KEY), null)
assert.equal(reopenedPage.elements.get('title').value, '', 'sign-out clears the previous account form')
assert.equal(reopenedPage.elements.get('taskCard').hidden, true)
const afterSignOutPage = makeHarness({ seedSession: false, persistentStorage: newlySignedInStorage })
await afterSignOutPage.ready()
assert.equal(afterSignOutPage.login.authStarts, 1, 'sign-out must not restore the revoked local session')

const locallyExpiredStorage = makeStorage([[SESSION_KEY, mobileSession(ACCOUNT_SUB, Date.now() - 1)]])
const locallyExpiredPage = makeHarness({ seedSession: false, persistentStorage: locallyExpiredStorage })
await locallyExpiredPage.ready()
assert.equal(locallyExpiredStorage.getItem(SESSION_KEY), null)
assert.equal(locallyExpiredPage.login.authStarts, 1)
assert.equal(locallyExpiredPage.elements.get('taskCard').hidden, true)

const revokedStorage = makeStorage([[SESSION_KEY, mobileSession()]])
const revokedPage = makeHarness({
  seedSession: false,
  persistentStorage: revokedStorage,
  handleCategories: () => jsonResponse(401, { error: 'TaskMaster session has expired' }),
})
await revokedPage.ready()
assert.equal(revokedStorage.getItem(SESSION_KEY), null)
assert.equal(revokedPage.login.authStarts, 1)
assert.equal(revokedPage.elements.get('accountTitle').textContent, '需要重新登录')

const networkStorage = makeStorage([[SESSION_KEY, mobileSession()]])
const networkPage = makeHarness({
  seedSession: false,
  persistentStorage: networkStorage,
  handleCategories: () => { throw new Error('temporary network failure') },
})
await networkPage.ready()
assert.ok(networkStorage.getItem(SESSION_KEY), 'a network failure must retain a possibly valid session')
assert.equal(networkPage.login.authStarts, 0)
assert.equal(networkPage.elements.get('taskCard').hidden, true)
assert.equal(networkPage.elements.get('restartLoginBtn').textContent, '重试连接')
assert.match(networkPage.elements.get('loginHelp').textContent, /登录记录已保留/)

const serviceStorage = makeStorage([[SESSION_KEY, mobileSession()]])
const servicePage = makeHarness({
  seedSession: false,
  persistentStorage: serviceStorage,
  handleCategories: () => jsonResponse(503, { error: 'temporarily unavailable' }),
})
await servicePage.ready()
assert.ok(serviceStorage.getItem(SESSION_KEY), 'a temporary server error must retain a possibly valid session')
assert.equal(servicePage.login.authStarts, 0)
assert.equal(servicePage.elements.get('restartLoginBtn').textContent, '重试连接')

const unknown401Storage = makeStorage([[SESSION_KEY, mobileSession()]])
const unknown401Page = makeHarness({
  seedSession: false,
  persistentStorage: unknown401Storage,
  handleCategories: () => jsonResponse(401, { error: 'TaskMaster session is invalid' }),
})
await unknown401Page.ready()
assert.ok(unknown401Storage.getItem(SESSION_KEY), 'a non-expiry 401 should not delete the session')
assert.equal(unknown401Page.login.authStarts, 0)

const mismatchedAccountStorage = makeStorage([[SESSION_KEY, mobileSession('another-account')]])
const mismatchedAccountPage = makeHarness({ seedSession: false, persistentStorage: mismatchedAccountStorage })
await mismatchedAccountPage.ready()
assert.equal(mismatchedAccountStorage.getItem(SESSION_KEY), null, 'a cached account mismatch cannot be silently reused')
assert.equal(mismatchedAccountPage.login.authStarts, 1)
assert.equal(mismatchedAccountPage.elements.get('taskCard').hidden, true)

const blockedStorage = {
  getItem() { throw new Error('storage blocked') },
  setItem() { throw new Error('storage blocked') },
  removeItem() { throw new Error('storage blocked') },
}
const blockedStoragePage = makeHarness({
  seedSession: false,
  persistentStorage: blockedStorage,
  handleIdentity: () => jsonResponse(200, {
    user: { sub: ACCOUNT_SUB, email: 'mobile@example.test', name: 'Mobile' },
    sessionToken: 'tab-only-mobile-session-token',
    expiresAt: Date.now() + 60_000,
  }),
})
await blockedStoragePage.ready()
await blockedStoragePage.login.callback({ credential: 'test-google-credential' })
assert.match(blockedStoragePage.elements.get('loginHelp').textContent, /未能持久保存登录/)
assert.ok(blockedStoragePage.sessionStorage.getItem(SESSION_KEY), 'same-tab fallback remains usable')

console.log('Mobile save feedback, safe retry, and session restore tests passed')
