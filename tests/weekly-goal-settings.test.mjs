import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [renderSource, eventsSource] = await Promise.all([
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8')
])

const settingsModal = renderSource.match(
  /export const renderGoalSettingsModal[\s\S]*?export const renderStats/
)?.[0] || ''
const settingsEvents = eventsSource.match(
  /function setupWeeklyGoalEvents[\s\S]*?function setupDragAndDrop/
)?.[0] || ''

assert.match(renderSource, /统计起点/)
assert.match(settingsModal, /统计起始日期/)
assert.match(settingsModal, /不会修改或删除任务/)
assert.match(settingsModal, /weeklyGoalAnchor \|\| currentStats\?\.anchorDate \|\| today/)
assert.doesNotMatch(renderSource, />[^<]*锚点/)

assert.match(settingsEvents, /hours < 0\.5 \|\| hours > 168/)
assert.match(settingsEvents, /统计起始日期不能晚于今天/)
assert.match(settingsEvents, /cancelGoalSettingsBtn/)
assert.doesNotMatch(settingsEvents, /e\.target === overlay/)

console.log('Weekly goal settings tests passed')
