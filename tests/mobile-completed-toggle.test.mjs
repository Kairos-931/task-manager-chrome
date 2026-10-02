import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [mobileSource, accountTaskSource] = await Promise.all([
  readFile(new URL('../backend/account-mobile.js', import.meta.url), 'utf8'),
  readFile(new URL('../backend/account-sync.js', import.meta.url), 'utf8'),
])

assert.match(mobileSource, /id="completed"/)
assert.match(mobileSource, /添加时标记为已完成/)
assert.match(mobileSource, /completed: document\.getElementById\('completed'\)\.checked/)
assert.match(accountTaskSource, /completed: body\.completed === true/)
assert.match(accountTaskSource, /\.\.\.\(body\.completed === true \? \{ completedAt: now \} : \{\}\)/)

console.log('Google mobile completed task tests passed')
