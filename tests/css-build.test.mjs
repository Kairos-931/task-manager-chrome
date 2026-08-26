import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [packageJson, sourceCss, builtCss, releaseCss] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../styles/tailwind.css', import.meta.url), 'utf8'),
  readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
  readFile(new URL('../chrome-extension-sync/styles/main.css', import.meta.url), 'utf8'),
])

const cssCommand = packageJson.scripts['build:css']
assert.match(cssCommand, /-i \.\/styles\/tailwind\.css/)
assert.match(cssCommand, /-o \.\/styles\/main\.css/)
assert.doesNotMatch(cssCommand, /-i ([^ ]+)[\s\S]*-o \1(?:\s|$)/)
assert.match(sourceCss, /@tailwind base;/)
assert.match(sourceCss, /@tailwind utilities;/)
assert.doesNotMatch(builtCss, /@tailwind (?:base|components|utilities)/)
assert.match(builtCss, /\.w-14\{width:3\.5rem\}/)
assert.equal(releaseCss, builtCss)

console.log('Repeatable Tailwind CSS build tests passed')
