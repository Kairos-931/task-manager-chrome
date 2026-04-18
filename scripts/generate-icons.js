// Generate Chrome extension icons
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const iconsDir = join(rootDir, 'icons')

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true })
}

// Create a simple SVG icon
function createSvgIcon(size, color = '#3b82f6') {
  const rx = Math.round(size * 0.15)
  const p1x = Math.round(size * 0.25)
  const p1y = Math.round(size * 0.5)
  const p2x = Math.round(size * 0.45)
  const p2y = Math.round(size * 0.7)
  const p3x = Math.round(size * 0.75)
  const p3y = Math.round(size * 0.3)
  const rx2 = Math.round(size * 0.6)
  const ry = Math.round(size * 0.15)
  const rw = Math.round(size * 0.2)
  const rh = Math.round(size * 0.25)
  const rx3 = Math.round(size * 0.03)
  const strokeWidth = Math.round(size * 0.06)
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${color}"/>
  <path d="M${p1x} ${p1y} L${p2x} ${p2y} L${p3x} ${p3y}" 
        stroke="white" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="${rx2}" y="${ry}" width="${rw}" height="${rh}" rx="${rx3}" fill="white" opacity="0.9"/>
</svg>`
}

// Valid base64-encoded PNG (blue square)
const validPng16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAW0lEQVQ4y2NgGAWjYBSMAmIA' +
  'EjL8Z8DwnwHDfwYM/xkw/GfA8J8Bw38GDP8ZMPxnwPCfAcN/Bgz/GTD8ZwCLMTAyMmL4zwDWMjIy' +
  'YvjPgOE/A4b/DBj+MzAYCABWqhMRYvLTjgAAAABJRU5ErkJggg==',
  'base64'
)

const validPng48 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAWklEQVRoge3PQQ0AIAwEwZ9' +
  '/UaQBC7ALsAtI4l9mJ7u7+/P7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+5+Z' +
  'wYxRMAqIAVEwCkbBKBgFNAAAg1QPF1Q8q9UAAAAASUVORK5CYII=',
  'base64'
)

const validPng128 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAWklEQVR42u3PAQ0AAADCoPdPbQ' +
  '43oAAB+5AJAAEAABAAAAAACAAAAAgPoQAAAAIAAAQAAAAACAAAAAgPoQAAAAIAAAQAAAAACAA' +
  'AACCgQAAAQAAABAAAAACAAAAAgPoQAAAAIAAAQAAAAACAAAAAgPoQAAAABf8AGp7hC9z0zYoAAAAA' +
  'SUVORK5CYII=',
  'base64'
)

// Write placeholder icons
writeFileSync(join(iconsDir, 'icon16.png'), validPng16)
writeFileSync(join(iconsDir, 'icon48.png'), validPng48)
writeFileSync(join(iconsDir, 'icon128.png'), validPng128)

// Create SVG versions
const sizes = [16, 48, 128]
sizes.forEach(function(size) {
  const svg = createSvgIcon(size)
  writeFileSync(join(iconsDir, 'icon' + size + '.svg'), svg)
})

console.log('Icons generated successfully!')
