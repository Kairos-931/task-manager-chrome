import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { renderAccountMobilePage } from '../backend/account-mobile.js'

const ACCOUNT_SUB = 'mobile-save-feedback-test-user'
const SESSION_KEY = 'tm_google_mobile_session_v1'
const PENDING_KEY = `tm_mobile_pending_task_v1:${ACCOUNT_SUB}`
let uuid = 0

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

const makeHarness = ({ storage, handleTask, fastTimeout = false }) => {
  const sessionStorage = storage || makeStorage()
  if (!sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      user: { sub: ACCOUNT_SUB, email: 'mobile@example.test', name: 'Mobile' },
      sessionToken: 'mobile-session-token',
      expiresAt: Date.now() + 60_000,
    }))
  }
  const localStorage = makeStorage([['tm_mobile_device_id', 'mobile-device-id']])
  const elements = new Map()
  const getElement = id => {
    if (!elements.has(id)) {
      const tagName = id === 'category' ? 'select' : 'div'
      elements.set(id, new FakeElement(tagName))
      if (id === 'saveFeedback' || id === 'saveFeedbackRetry' || id === 'saveFeedbackDismiss') {
        elements.get(id).hidden = true
      }
    }
    return elements.get(id)
  }
  const document = {
    getElementById: getElement,
    createElement: tagName => new FakeElement(tagName),
  }
  const window = {
    google: { accounts: { id: {
      initialize() {},
      renderButton() {},
      disableAutoSelect() {},
    } } },
    location: { reload() {} },
  }
  const requests = []
  const fetch = async (url, options = {}) => {
    if (url === '/api/account/categories') {
      return jsonResponse(200, { categories: [{ id: 'default-life', name: '生活' }] })
    }
    if (url === '/api/google/mobile-auth/start') {
      return jsonResponse(200, { state: 'test-state', nonce: 'test-nonce' })
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
  return { elements, requests, sessionStorage, ready, flushFeedbackTimer }
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

console.log('Mobile task save feedback and safe retry tests passed')
