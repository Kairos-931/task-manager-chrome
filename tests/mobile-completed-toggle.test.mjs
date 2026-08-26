import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workerSource = await readFile(new URL('../backend/index.js', import.meta.url), 'utf8')

assert.match(workerSource, /id="completedToggle"/)
assert.match(workerSource, /id="completedState"/)
assert.match(workerSource, /function updateCompletedToggle\(\)/)
assert.match(workerSource, /toggle\.classList\.toggle\('is-completed', isCompleted\)/)
assert.match(workerSource, /isCompleted \? '已完成' : '未完成'/)
assert.match(workerSource, /isCompleted \? '提交后会作为已完成任务同步到电脑端' : '未选中，将作为待办任务同步'/)
assert.match(workerSource, /document\.getElementById\('completed'\)\.addEventListener\('change', updateCompletedToggle\)/)
assert.match(workerSource, /document\.getElementById\('completed'\)\.checked = false;\s*\n\s*updateCompletedToggle\(\)/)

console.log('Mobile completed toggle tests passed')
