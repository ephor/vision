import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { lookup } from 'mime-types'
import type { IncomingMessage, ServerResponse } from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Serve static files from the built UI directory
 */
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  uiPath: string,
  apiUrl?: string
): Promise<boolean> {
  let filePath = req.url || '/'
  
  // Remove query string
  const queryIndex = filePath.indexOf('?')
  if (queryIndex !== -1) {
    filePath = filePath.substring(0, queryIndex)
  }

  // Default to index.html for root and SPA routes
  if (filePath === '/' || !filePath.includes('.')) {
    filePath = '/index.html'
  }

  const fullPath = join(uiPath, filePath)

  // Security: prevent directory traversal
  if (!fullPath.startsWith(uiPath)) {
    return false
  }

  if (!existsSync(fullPath)) {
    return false
  }

  try {
    let content = await readFile(fullPath)
    const mimeType = lookup(fullPath) || 'application/octet-stream'
    
    // Inject config into index.html
    if (filePath === '/index.html' && apiUrl) {
      const configScript = `<script>window.VISION_CONFIG = ${JSON.stringify({ apiUrl })};</script>`
      const html = content.toString()
      const injected = html.replace('</head>', `${configScript}</head>`)
      content = Buffer.from(injected)
    }
    
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    })
    res.end(content)
    return true
  } catch (error) {
    console.error('Error serving static file:', error)
    return false
  }
}

/**
 * Get the path to the UI dist directory
 */
export function getUIPath(): string {
  // Get the core package root directory
  // __dirname in dev: /Users/.../packages/core/src/server
  // __dirname in prod: /Users/.../packages/core/dist/server
  const coreRoot = join(__dirname, '../..')
  const uiPath = join(coreRoot, 'dist/ui')
  
  return uiPath
}
