import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const renderSource = await readFile(new URL('../shared/render.ts', import.meta.url), 'utf8')
const topSummary = renderSource.match(
  /export const renderStats[\s\S]*?<div class="stats-row-items">([\s\S]*?)<\/div>/
)?.[1]

assert.ok(topSummary, 'top summary markup should exist')
assert.match(topSummary, /待完成/)
assert.match(topSummary, /今日/)
assert.match(topSummary, /overdueCount/)
assert.doesNotMatch(topSummary, /已完成/)
assert.doesNotMatch(topSummary, /stats\.done/)

console.log('Top summary tests passed')
