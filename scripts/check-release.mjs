import { readFileSync } from 'fs'
import { createPrivateKey, createPublicKey } from 'node:crypto'
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

const assertPublicExtensionKey = (encodedKey, manifestPath) => {
  if (typeof encodedKey !== 'string' || !encodedKey.trim()) {
    throw new Error(`${manifestPath} must contain a Chrome extension public key`)
  }

  const der = Buffer.from(encodedKey, 'base64')
  const privateKeyTypes = ['pkcs8', 'pkcs1', 'sec1']
  const containsPrivateKey = privateKeyTypes.some((type) => {
    try {
      createPrivateKey({ key: der, format: 'der', type })
      return true
    } catch {
      return false
    }
  })

  if (containsPrivateKey) {
    throw new Error(`${manifestPath} contains private key material; release manifests may contain only a public key`)
  }

  try {
    createPublicKey({ key: der, format: 'der', type: 'spki' })
  } catch {
    throw new Error(`${manifestPath} must contain a base64-encoded DER SPKI public key`)
  }
}

assertPublicExtensionKey(sourceManifest.key, 'manifest.json')
assertPublicExtensionKey(releaseManifest.key, 'chrome-extension-sync/manifest.json')

if (packageJson.version !== sourceManifest.version || sourceManifest.version !== releaseManifest.version) {
  throw new Error(
    `Version mismatch: package=${packageJson.version}, source=${sourceManifest.version}, release=${releaseManifest.version}`
  )
}

const extensionOAuthClientId = sourceManifest.oauth2?.client_id
if (typeof extensionOAuthClientId !== 'string' ||
    !/^[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(extensionOAuthClientId) ||
    extensionOAuthClientId.startsWith('YOUR_')) {
  throw new Error('Set a real Chrome Extension OAuth client ID in manifest.json before building a release')
}
if (releaseManifest.oauth2?.client_id !== extensionOAuthClientId) {
  throw new Error('Built extension OAuth client ID does not match manifest.json')
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
