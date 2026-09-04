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
console.log('List navigation tests passed')
