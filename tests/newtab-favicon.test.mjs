import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const releaseDir = process.env.TASKMASTER_RELEASE_DIR || 'chrome-extension-sync'
const [sourceHtml, builtHtml, sourceIcon, builtIcon, sourceToolbarIcon, builtToolbarIcon] = await Promise.all([
  read('../newtab/newtab.html'),
  read(`../${releaseDir}/newtab/newtab.html`),
  read('../icons/newtab-favicon.svg'),
  read(`../${releaseDir}/icons/newtab-favicon.svg`),
  read('../icons/icon16.svg'),
  read(`../${releaseDir}/icons/icon16.svg`)
])

const faviconLink = '<link rel="icon" type="image/svg+xml" href="../icons/newtab-favicon.svg">'
assert.ok(sourceHtml.includes(faviconLink), 'newtab source must reference the dedicated local favicon')
assert.ok(!sourceHtml.includes('icons/icon16.svg'), 'newtab must not reuse the toolbar icon')
assert.equal(builtHtml, sourceHtml, 'generated newtab HTML must match the source')
assert.equal(builtIcon, sourceIcon, 'generated package must contain the dedicated favicon')
assert.equal(builtToolbarIcon, sourceToolbarIcon, 'existing toolbar icon must remain unchanged in the package')
assert.match(sourceIcon, /fill="#3b82f6"/, 'favicon must use the TaskMaster blue background')
assert.match(sourceIcon, /stroke="#ffffff"/, 'favicon must use white List Todo strokes')
assert.match(sourceIcon, /<rect x="3" y="5" width="6" height="6"/, 'favicon must retain the List Todo checkbox outline')
assert.match(sourceIcon, /M13 6h8M13 12h8M13 18h8/, 'favicon must retain the List Todo text lines')

console.log('Newtab favicon tests passed')
