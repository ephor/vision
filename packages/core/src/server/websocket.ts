import { WebSocketServer, WebSocket } from 'ws'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { JsonRpcHandler } from './jsonrpc'
import { serveStatic, getUIPath } from './static'
import type { VisionServerOptions, DashboardEvent } from '../types/index'

/**
 * Vision WebSocket Server
 * Handles real-time communication with the dashboard UI
 * Also serves static UI files on the same port
 */
export class VisionWebSocketServer {
  private httpServer: ReturnType<typeof createServer>
  private wss: WebSocketServer
  private clients = new Set<WebSocket>()
  private rpc: JsonRpcHandler
  private options: Required<Omit<VisionServerOptions, 'apiUrl'>> & { apiUrl?: string }

  constructor(options: VisionServerOptions = {}) {
    this.options = {
      port: options.port ?? 9500,
      host: options.host ?? 'localhost',
      maxTraces: options.maxTraces ?? 1000,
      maxLogs: options.maxLogs ?? 10_000,
      captureConsole: options.captureConsole ?? true,
      enableCors: options.enableCors ?? true,
      apiUrl: options.apiUrl,
    }

    this.rpc = new JsonRpcHandler()
    
    // Create HTTP server first
    this.httpServer = createServer((req, res) => {
      this.handleHttp(req, res).catch(err => {
        console.error('HTTP handler error:', err)
        res.writeHead(500)
        res.end('Internal Server Error')
      })
    })
    
    // Attach WebSocket server to HTTP server on /ws path
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: '/ws',
    })

    this.setupServer()
  }

  /**
   * Handle HTTP requests (for serving UI)
   */
  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Enable CORS
    if (this.options.enableCors) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', clients: this.clients.size }))
      return
    }

    // HTTP API for routes metadata (for React Query client)
    if (req.url === '/api/routes-metadata' && req.method === 'GET') {
      try {
        // Call internal routes/export-metadata method
        const result = await this.rpc.handle(JSON.stringify({
          jsonrpc: '2.0',
          method: 'routes/export-metadata',
          id: 1
        }))

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(result)
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Failed to fetch routes metadata' }))
      }
      return
    }

    // Try to serve static files from built UI
    const uiPath = getUIPath()
    const served = await serveStatic(req, res, uiPath, this.options.apiUrl)

    if (!served) {
      // No static UI available — return 404 (no legacy HTML fallback)
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Vision Dashboard UI not found. Build the UI or ensure adapters are running.')
    }
  }

  private setupServer(): void {
    // Start HTTP server
    this.httpServer.listen(this.options.port, this.options.host, () => {
      console.log(`🚀 Vision Dashboard running at http://${this.options.host}:${this.options.port}`)
      console.log(`   WebSocket: ws://${this.options.host}:${this.options.port}/ws`)
    })

    // Handle WebSocket connections
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Dashboard client connected')
      this.clients.add(ws)

      ws.on('message', async (data: Buffer) => {
        const message = data.toString()
        const response = await this.rpc.handle(message)
        
        if (response) {
          ws.send(response)
        }
      })

      ws.on('close', () => {
        console.log('🔌 Dashboard client disconnected')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.clients.delete(ws)
      })

      // Send initial connection success
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'connection.established',
          params: { timestamp: Date.now() },
        })
      )
    })

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error)
    })

    this.httpServer.on('error', (error) => {
      console.error('HTTP server error:', error)
    })
  }

  /**
   * Register a JSON-RPC method handler
   */
  registerMethod(method: string, handler: (params: unknown) => Promise<unknown>): void {
    this.rpc.register(method, handler)
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: DashboardEvent): void {
    const notification = this.rpc.createNotification(event.type, event.data)
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(notification)
      }
    })
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Close the server
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.clients.forEach((client) => client.close())
      this.clients.clear()

      this.wss.close((wsError) => {
        this.httpServer.close((httpError) => {
          if (wsError || httpError) {
            reject(wsError || httpError)
          } else {
            console.log('✅ Vision Dashboard server closed')
            resolve()
          }
        })
      })
    })
  }
}
