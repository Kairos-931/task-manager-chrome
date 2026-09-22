import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const RealDate = globalThis.Date
const fixedNow = new RealDate('2026-09-22T12:00:00').getTime()
class FixedDate extends RealDate {
  constructor(...args) {
    super(args.length === 0 ? fixedNow : args[0])
  }

  static now() {
    return fixedNow
  }
}
globalThis.Date = FixedDate

const bundle = await build({
  stdin: {
    contents: "export { getRemainingTime } from './shared/task.ts'",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    sourcefile: 'overdue-one-day-label-entry.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
})
const { getRemainingTime } = await import(`data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`)

assert.equal(getRemainingTime('2026-09-21', false), '已过期 1 天', 'yesterday must include one overdue day')
assert.equal(getRemainingTime('2026-09-19', false), '已过期 3 天', 'multi-day overdue wording must remain unchanged')
assert.equal(getRemainingTime('2026-09-22', false), '今天到期', 'today wording must remain unchanged')
assert.equal(getRemainingTime('2026-09-23', false), '明天到期', 'tomorrow wording must remain unchanged')
assert.equal(getRemainingTime('2026-09-21', true), '已完成', 'completed tasks must keep completion wording')

const renderSource = await readFile(new URL('../shared/render.ts', import.meta.url), 'utf8')
assert.ok(
  renderSource.includes('${getRemainingTime(task.dueDate, false)} · 原计划 ${task.dueDate}'),
  'overdue panel must retain the original planned date metadata'
)

globalThis.Date = RealDate
console.log('Overdue one-day label tests passed')
