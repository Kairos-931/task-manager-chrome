import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await readFile(new URL('../shared/list-navigation.ts', import.meta.url), 'utf8')
const compiled = await transform(source, { loader: 'ts', format: 'esm', platform: 'node' })
const navigation = await import(`data:text/javascript,${encodeURIComponent(compiled.code)}`)

assert.deepEqual(navigation.insertTodayDate(['2099-01-01'], '2099-01-05'), ['2099-01-01', '2099-01-05'])
assert.deepEqual(navigation.insertTodayDate(['2099-01-09'], '2099-01-05'), ['2099-01-05', '2099-01-09'])
assert.deepEqual(navigation.insertTodayDate(['2099-01-01', '2099-01-09', 'no-date'], '2099-01-05'), ['2099-01-01', '2099-01-05', '2099-01-09', 'no-date'])
assert.deepEqual(navigation.insertTodayDate(['no-date'], '2099-01-05'), ['2099-01-05', 'no-date'])
assert.equal(navigation.isAnchorVisible({ top: 10, bottom: 40 }, 100), true)
assert.equal(navigation.isAnchorVisible({ top: -1, bottom: 40 }, 100), false)
assert.equal(navigation.isAnchorVisible({ top: 10, bottom: 101 }, 100), false)
assert.equal(navigation.getTodayScrollBehavior(false), 'smooth')
assert.equal(navigation.getTodayScrollBehavior(true), 'auto')
assert.equal(navigation.shouldShowBackToTop(0, 1200, 400), false)
assert.equal(navigation.shouldShowBackToTop(48, 1200, 400), false)
assert.equal(navigation.shouldShowBackToTop(49, 1200, 400), true)
assert.equal(navigation.shouldShowBackToTop(80, 400, 400), false)

class FakeElement {
  constructor(rect = { top: 0, bottom: 40 }) {
    this.rect = rect
    this.handlers = new Map()
    this.classes = new Set()
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
      contains: name => this.classes.has(name),
    }
  }
  addEventListener(name, callback) { this.handlers.set(name, callback) }
  removeEventListener(name) { this.handlers.delete(name) }
  click() { this.handlers.get('click')?.() }
  getBoundingClientRect() { return this.rect }
}

class FakeWindow {
  constructor(onScrollTo = () => {}) {
    this.innerHeight = 400
    this.scrollY = 0
    this.reducedMotion = false
    this.handlers = new Map()
    this.scrollCalls = []
    this.onScrollTo = onScrollTo
  }
  addEventListener(name, callback) { this.handlers.set(name, callback) }
  removeEventListener(name) { this.handlers.delete(name) }
  matchMedia() { return { matches: this.reducedMotion } }
  scrollTo(options) {
    this.scrollCalls.push(options)
    this.scrollY = options.top
    this.onScrollTo(options)
    this.handlers.get('scroll')?.()
  }
  dispatchScroll() { this.handlers.get('scroll')?.() }
}

const documentScroll = { scrollTop: 0, scrollHeight: 400 }
const viewport = new FakeWindow(options => { documentScroll.scrollTop = options.top })
const backButton = new FakeElement()
const todayButton = new FakeElement()
const todayAnchor = new FakeElement()
const unbindNavigation = navigation.bindListNavigation({
  backToTopButton: backButton,
  jumpToTodayButton: todayButton,
  todayAnchor,
  scrollWindow: viewport,
  getScrollTop: () => documentScroll.scrollTop,
  getScrollHeight: () => documentScroll.scrollHeight,
})
assert.equal(backButton.classList.contains('hidden'), true, 'short lists keep back-to-top hidden')
assert.equal(todayButton.classList.contains('hidden'), true, 'a visible today anchor keeps the today button hidden')
documentScroll.scrollHeight = 1200
documentScroll.scrollTop = 48
viewport.dispatchScroll()
assert.equal(backButton.classList.contains('hidden'), true, 'the back-to-top threshold is respected')
documentScroll.scrollTop = 80
viewport.dispatchScroll()
assert.equal(backButton.classList.contains('hidden'), false, 'scrolling a long list shows back-to-top')
assert.equal(todayButton.classList.contains('hidden'), true, 'today visibility remains independent of back-to-top')
todayAnchor.rect = { top: 450, bottom: 490 }
viewport.dispatchScroll()
assert.equal(todayButton.classList.contains('hidden'), false, 'today appears when its anchor leaves the viewport')
assert.equal(backButton.classList.contains('hidden'), false, 'today visibility does not hide back-to-top')
backButton.click()
assert.deepEqual(viewport.scrollCalls.at(-1), { top: 0, behavior: 'smooth' })
assert.equal(documentScroll.scrollTop, 0)
assert.equal(backButton.classList.contains('hidden'), true, 'back-to-top hides when the scroll position reaches the top')
viewport.reducedMotion = true
documentScroll.scrollTop = 80
viewport.dispatchScroll()
backButton.click()
assert.deepEqual(viewport.scrollCalls.at(-1), { top: 0, behavior: 'auto' }, 'reduced motion disables smooth scrolling')
unbindNavigation()
assert.equal(viewport.handlers.has('scroll'), false, 'view changes remove the scroll listener')
assert.equal(backButton.handlers.has('click'), false, 'view changes remove the detached button listener')

const noTodayViewport = new FakeWindow()
const noTodayDocument = { scrollTop: 90, scrollHeight: 1200 }
const noTodayBackButton = new FakeElement()
const noTodayNavigation = navigation.bindListNavigation({
  backToTopButton: noTodayBackButton,
  jumpToTodayButton: null,
  todayAnchor: null,
  scrollWindow: noTodayViewport,
  getScrollTop: () => noTodayDocument.scrollTop,
  getScrollHeight: () => noTodayDocument.scrollHeight,
})
assert.equal(noTodayBackButton.classList.contains('hidden'), false, 'back-to-top works when there is no today anchor')
noTodayBackButton.click()
assert.deepEqual(noTodayViewport.scrollCalls.at(-1), { top: 0, behavior: 'smooth' }, 'back-to-top remains clickable when there is no today anchor')
noTodayNavigation()

console.log('List navigation tests passed')
