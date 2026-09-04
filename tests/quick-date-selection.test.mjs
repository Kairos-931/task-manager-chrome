import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [renderSource, eventsSource] = await Promise.all([
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
])

assert.match(renderSource, /aria-pressed="\$\{isSelected\}"/)
assert.match(eventsSource, /button\.classList\.toggle\('selected', selected\)/)
assert.match(eventsSource, /button\.setAttribute\('aria-pressed', String\(selected\)\)/)

assert.match(renderSource, /\.quick-date-btn\.today:not\(\.selected\) \.quick-date-badge/)
assert.doesNotMatch(
  renderSource,
  /\.quick-date-btn\.today\s*\{[^}]*?(?:border-color|background):/s,
  'today must not look selected when another or out-of-range date is selected'
)

console.log('Quick date selection tests passed')
