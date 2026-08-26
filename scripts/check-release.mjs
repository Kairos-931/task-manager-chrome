import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(fileURLToPath(new URL('..', import.meta.url)))
const readJson = (relativePath) => JSON.parse(readFileSync(join(rootDir, relativePath), 'utf8'))

const packageJson = readJson('package.json')
const sourceManifest = readJson('manifest.json')
const releaseManifest = readJson('chrome-extension-sync/manifest.json')
const packageSource = readFileSync(join(rootDir, 'package.json'), 'utf8')
const tailwindSource = readFileSync(join(rootDir, 'styles/tailwind.css'), 'utf8')
const builtCss = readFileSync(join(rootDir, 'styles/main.css'), 'utf8')
const releaseCss = readFileSync(join(rootDir, 'chrome-extension-sync/styles/main.css'), 'utf8')

if (packageJson.version !== sourceManifest.version || sourceManifest.version !== releaseManifest.version) {
  throw new Error(
    `Version mismatch: package=${packageJson.version}, source=${sourceManifest.version}, release=${releaseManifest.version}`
  )
}

if (!packageSource.includes('-i ./styles/tailwind.css -o ./styles/main.css')) {
  throw new Error('Tailwind build must use separate source and output files')
}

if (!tailwindSource.includes('@tailwind utilities;') || builtCss.includes('@tailwind utilities;')) {
  throw new Error('Tailwind source directives or compiled CSS output are invalid')
}

if (!builtCss.includes('.w-14{width:3.5rem}') || builtCss !== releaseCss) {
  throw new Error('Compiled CSS is missing expected utilities or differs from release assets')
}

console.log(`Release artifacts verified: v${sourceManifest.version}`)
