// IIFE Bundle Script - Bundles all shared code into single IIFE file
import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Bundle shared code as IIFE
async function buildSharedIIFE() {
  // Bundle for popup
  await esbuild.build({
    entryPoints: [join(rootDir, 'shared/entry.ts')],
    bundle: true,
    minify: false,
    outfile: join(rootDir, 'popup/popup.js'),
    format: 'iife',
    globalName: 'TaskManager',
    platform: 'browser',
    target: ['chrome110'],
    sourcemap: false,
    logLevel: 'info',
  })

  // Bundle for newtab
  await esbuild.build({
    entryPoints: [join(rootDir, 'shared/entry.ts')],
    bundle: true,
    minify: false,
    outfile: join(rootDir, 'newtab/newtab.js'),
    format: 'iife',
    globalName: 'TaskManager',
    platform: 'browser',
    target: ['chrome110'],
    sourcemap: false,
    logLevel: 'info',
  })

  // Bundle for background
  await esbuild.build({
    entryPoints: [join(rootDir, 'shared/background.ts')],
    bundle: true,
    minify: false,
    outfile: join(rootDir, 'background.js'),
    format: 'iife',
    globalName: 'Background',
    platform: 'browser',
    target: ['chrome110'],
    sourcemap: false,
    logLevel: 'info',
  })

  console.log('IIFE bundle completed!')
}

// Run
buildSharedIIFE().catch(console.error)
