// Copy assets script
import { existsSync, mkdirSync, cpSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function copyDir(src, dest) {
  ensureDir(dest)
  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      cpSync(srcPath, destPath)
    }
  }
}

// Copy manifest
cpSync(join(rootDir, 'manifest.json'), join(rootDir, 'dist/manifest.json'))
cpSync(join(rootDir, 'manifest.json'), join(rootDir, 'chrome-extension-loadable/manifest.json'))

// Copy HTML files
cpSync(join(rootDir, 'popup/popup.html'), join(rootDir, 'dist/popup/popup.html'))
cpSync(join(rootDir, 'popup/popup.html'), join(rootDir, 'chrome-extension-loadable/popup/popup.html'))

cpSync(join(rootDir, 'newtab/newtab.html'), join(rootDir, 'dist/newtab/newtab.html'))
cpSync(join(rootDir, 'newtab/newtab.html'), join(rootDir, 'chrome-extension-loadable/newtab/newtab.html'))

// Copy JS files (IIFE bundles)
cpSync(join(rootDir, 'popup/popup.js'), join(rootDir, 'dist/popup/popup.js'))
cpSync(join(rootDir, 'popup/popup.js'), join(rootDir, 'chrome-extension-loadable/popup/popup.js'))

cpSync(join(rootDir, 'newtab/newtab.js'), join(rootDir, 'dist/newtab/newtab.js'))
cpSync(join(rootDir, 'newtab/newtab.js'), join(rootDir, 'chrome-extension-loadable/newtab/newtab.js'))

cpSync(join(rootDir, 'background.js'), join(rootDir, 'dist/background.js'))
cpSync(join(rootDir, 'background.js'), join(rootDir, 'chrome-extension-loadable/background.js'))

// Copy CSS
cpSync(join(rootDir, 'styles/main.css'), join(rootDir, 'dist/styles/main.css'))
cpSync(join(rootDir, 'styles/main.css'), join(rootDir, 'chrome-extension-loadable/styles/main.css'))

// Copy icons
copyDir(join(rootDir, 'icons'), join(rootDir, 'dist/icons'))
copyDir(join(rootDir, 'icons'), join(rootDir, 'chrome-extension-loadable/icons'))

console.log('Assets copied successfully!')
