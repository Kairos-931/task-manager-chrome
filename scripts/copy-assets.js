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

const syncDir = join(rootDir, 'chrome-extension-sync')

// Copy HTML files
cpSync(join(rootDir, 'popup/popup.html'), join(syncDir, 'popup/popup.html'))
cpSync(join(rootDir, 'newtab/newtab.html'), join(syncDir, 'newtab/newtab.html'))

// Copy JS files (IIFE bundles)
cpSync(join(rootDir, 'popup/popup.js'), join(syncDir, 'popup/popup.js'))
cpSync(join(rootDir, 'newtab/newtab.js'), join(syncDir, 'newtab/newtab.js'))
cpSync(join(rootDir, 'background.js'), join(syncDir, 'background.js'))

// Copy CSS
cpSync(join(rootDir, 'styles/main.css'), join(syncDir, 'styles/main.css'))

// Copy icons
copyDir(join(rootDir, 'icons'), join(syncDir, 'icons'))

console.log('Assets copied successfully!')