import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const [html, app, sampleData, nginx] = await Promise.all([
  read('../demo/index.html'),
  read('../demo/app.js'),
  read('../demo/sample-data.js'),
  read('../deploy/demo/nginx.conf')
])

const publicSource = `${html}\n${app}\n${sampleData}`

assert.match(html, /connect-src 'none'/)
assert.match(nginx, /connect-src 'none'/)
assert.match(html, /TaskMaster/)
assert.match(html, /演示数据/)
assert.match(app, /demo\.createTasks\(\)/)
assert.match(app, /showModal\(\)/)
assert.match(app, /state\.tasks = demo\.createTasks\(\)/)
assert.doesNotMatch(publicSource, /workers\.dev|API_TOKEN|apiToken|chrome\.|localStorage|indexedDB|fetch\s*\(/i)
assert.doesNotMatch(publicSource, /taskmaster-api\.yx9391/i)

console.log('Public demo page tests passed')
