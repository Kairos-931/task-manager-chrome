import { readFileSync } from 'fs'
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto'
import { join, resolve, relative, isAbsolute } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(fileURLToPath(new URL('..', import.meta.url)))
const readJson = (relativePath) => JSON.parse(readFileSync(join(rootDir, relativePath), 'utf8'))
const configuredReleaseDir = process.env.TASKMASTER_RELEASE_DIR
const releaseDir = resolve(rootDir, configuredReleaseDir || 'chrome-extension-sync')
const releaseRelativePath = relative(rootDir, releaseDir)
if (!releaseRelativePath || releaseRelativePath.startsWith('..') || isAbsolute(releaseRelativePath)) {
  throw new Error('Release output directory must be a child of the project directory')
}

const packageJson = readJson('package.json')
const sourceManifest = readJson('manifest.json')
const releaseManifest = JSON.parse(readFileSync(join(releaseDir, 'manifest.json'), 'utf8'))
const packageSource = readFileSync(join(rootDir, 'package.json'), 'utf8')
const tailwindSource = readFileSync(join(rootDir, 'styles/tailwind.css'), 'utf8')
const builtCss = readFileSync(join(rootDir, 'styles/main.css'), 'utf8')
const releaseCss = readFileSync(join(releaseDir, 'styles/main.css'), 'utf8')
const storageSource = readFileSync(join(rootDir, 'shared/storage.ts'), 'utf8')
const backendAuthSource = readFileSync(join(rootDir, 'backend/google-auth.js'), 'utf8')

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
    const publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' })
    return createHash('sha256')
      .update(publicKey.export({ type: 'spki', format: 'der' }))
      .digest()
      .subarray(0, 16)
      .toString('hex')
      .split('')
      .map(nibble => String.fromCharCode(97 + Number.parseInt(nibble, 16)))
      .join('')
  } catch {
    throw new Error(`${manifestPath} must contain a base64-encoded DER SPKI public key`)
  }
}

const sourceExtensionId = assertPublicExtensionKey(sourceManifest.key, 'manifest.json')
const releaseExtensionId = assertPublicExtensionKey(releaseManifest.key, `${releaseRelativePath}/manifest.json`)
if (sourceExtensionId !== releaseExtensionId) {
  throw new Error('Built extension public key does not match manifest.json')
}

if (packageJson.version !== sourceManifest.version || sourceManifest.version !== releaseManifest.version) {
  throw new Error(
    `Version mismatch: package=${packageJson.version}, source=${sourceManifest.version}, release=${releaseManifest.version}`
  )
}

if (sourceManifest.oauth2 || releaseManifest.oauth2) {
  throw new Error('This extension uses launchWebAuthFlow and must not configure manifest oauth2/getAuthToken')
}
if (!sourceManifest.permissions?.includes('identity') || !releaseManifest.permissions?.includes('identity')) {
  throw new Error('Google account sign-in requires the identity permission in both manifests')
}

const callbackIdFrom = (source, filePath) => {
  const match = source.match(/GOOGLE_EXTENSION_CALLBACK_URI\s*=.*https:\/\/([a-p]{32})\.chromiumapp\.org\/google-auth/)
  if (!match) throw new Error(`${filePath} must define the Chrome extension OAuth callback URI`)
  return match[1]
}
const storageCallbackId = callbackIdFrom(storageSource, 'shared/storage.ts')
const backendCallbackId = callbackIdFrom(backendAuthSource, 'backend/google-auth.js')
if (sourceExtensionId !== storageCallbackId || sourceExtensionId !== backendCallbackId) {
  throw new Error('Extension public key ID does not match the sign-in callback configured in source and backend')
}

const popupBundle = readFileSync(join(releaseDir, 'popup/popup.js'), 'utf8')
const newtabBundle = readFileSync(join(releaseDir, 'newtab/newtab.js'), 'utf8')
for (const [name, bundle] of [['popup', popupBundle], ['newtab', newtabBundle]]) {
  if (!bundle.includes('launchWebAuthFlow') || bundle.includes('getAuthToken')) {
    throw new Error(`${name} bundle must use launchWebAuthFlow and must not use getAuthToken`)
  }
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

console.log(`Release artifacts verified: v${sourceManifest.version} at ${releaseRelativePath}`)
