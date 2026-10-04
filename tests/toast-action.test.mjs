import assert from 'node:assert/strict'

class FakeElement {
  attributes = new Map()
  children = []
  listeners = new Map()
  removed = false
  textContent = ''

  setAttribute(name, value) { this.attributes.set(name, value) }
  appendChild(child) { this.children.push(child); return child }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || []
    callbacks.push(callback)
    this.listeners.set(type, callbacks)
  }
  contains(element) { return this === element || this.children.some(child => child.contains?.(element)) }
  remove() { this.removed = true }
}

const originalGlobals = {
  document: globalThis.document,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout
}

const body = new FakeElement()
let createdToast
body.appendChild = child => {
  body.children.push(child)
  if (child.className.includes('toast-message')) createdToast = child
  return child
}
let nextTimerId = 0
const timers = new Map()
globalThis.document = {
  activeElement: null,
  body,
  createElement() {
    const element = new FakeElement()
    element.ownerDocument = globalThis.document
    return element
  },
  querySelector(selector) {
    return selector === '.toast-message' && !createdToast?.removed ? createdToast : null
  }
}
globalThis.setTimeout = (callback, delay) => {
  const id = ++nextTimerId
  timers.set(id, { callback, delay })
  return id
}
globalThis.clearTimeout = id => timers.delete(id)

const { showToast } = await import('../shared/sync.ts')
const container = { ownerDocument: globalThis.document }
let actionCount = 0
showToast(container, '已添加到 2026-10-02', 'success', {
  label: '查看',
  onClick: () => { actionCount += 1 }
})

assert.equal(createdToast.attributes.get('role'), 'status')
assert.equal(createdToast.attributes.get('aria-live'), 'polite')
assert.equal(createdToast.children[0].textContent, '已添加到 2026-10-02')
assert.equal(createdToast.children[1].textContent, '查看')
assert.equal(timers.values().next().value.delay, 12000, 'action toast remains available longer than a plain message')
createdToast.children[1].listeners.get('click')[0]()
assert.equal(actionCount, 1, 'the accessible button invokes its action')
assert.equal(createdToast.removed, true, 'clicking the action dismisses its toast')
assert.equal(timers.size, 0, 'clicking the action cancels its dismissal timer')

for (const [key, value] of Object.entries(originalGlobals)) {
  if (value === undefined) delete globalThis[key]
  else globalThis[key] = value
}

console.log('Accessible task feedback action tests passed')
