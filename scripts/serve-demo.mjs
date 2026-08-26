import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const demoDir = join(rootDir, 'demo')
const iconPath = join(rootDir, 'icons', 'icon128.svg')
const port = Number(process.env.DEMO_PORT || 4173)
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
}

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
}

createServer((request, response) => {
  const requestPath = new URL(request.url || '/', 'http://localhost').pathname
  if (requestPath === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders })
    response.end('ok')
    return
  }

  let filePath
  if (requestPath === '/icons/icon128.svg') {
    filePath = iconPath
  } else {
    const relativePath = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath).replace(/^\/+/, '')
    const normalizedPath = normalize(relativePath)
    if (normalizedPath.startsWith('..')) {
      response.writeHead(403, securityHeaders)
      response.end('Forbidden')
      return
    }
    filePath = join(demoDir, normalizedPath)
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, securityHeaders)
    response.end('Not Found')
    return
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
    ...securityHeaders
  })
  createReadStream(filePath).pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(`TaskMaster demo: http://127.0.0.1:${port}`)
})
