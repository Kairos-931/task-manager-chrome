import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(fileURLToPath(new URL('..', import.meta.url)))
const readJson = (relativePath) => JSON.parse(readFileSync(join(rootDir, relativePath), 'utf8'))

const packageJson = readJson('package.json')
const sourceManifest = readJson('manifest.json')
const releaseManifest = readJson('chrome-extension-sync/manifest.json')

if (packageJson.version !== sourceManifest.version || sourceManifest.version !== releaseManifest.version) {
  throw new Error(
    `Version mismatch: package=${packageJson.version}, source=${sourceManifest.version}, release=${releaseManifest.version}`
  )
}

console.log(`Release artifacts verified: v${sourceManifest.version}`)
