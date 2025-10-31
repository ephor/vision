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
  private options: Required<VisionServerOptions>

  constructor(options: VisionServerOptions = {}) {
    this.options = {
      port: options.port ?? 9500,
      host: options.host ?? 'localhost',
      maxTraces: options.maxTraces ?? 1000,
      maxLogs: options.maxLogs ?? 10_000,
      captureConsole: options.captureConsole ?? true,
      enableCors: options.enableCors ?? true,
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

    // Try to serve static files from built UI
    const uiPath = getUIPath()
    const served = await serveStatic(req, res, uiPath)
    
    if (!served) {
      // Fallback to embedded UI
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(this.getEmbeddedUI())
    }
  }

  /**
   * Get embedded UI HTML
   * For now, returns a simple page that connects to WebSocket
   * In production, this would serve the built React app
   */
  private getEmbeddedUI(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vision Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      max-width: 600px;
      padding: 2rem;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .status { 
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #1a1a1a;
      border-radius: 8px;
      margin: 1rem 0;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .info {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin-top: 2rem;
      text-align: left;
    }
    .info h2 { font-size: 1.2rem; margin-bottom: 1rem; }
    .info p { color: #888; line-height: 1.6; margin-bottom: 0.5rem; }
    code { 
      background: #0a0a0a;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #22c55e;
      font-family: 'Monaco', monospace;
    }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔮 Vision Dashboard</h1>
    <div class="status">
      <span class="dot"></span>
      <span id="status">Connected to WebSocket</span>
    </div>
    
    <div class="info">
      <h2>Dashboard UI Coming Soon!</h2>
      <p>The Vision Dashboard backend is running and ready.</p>
      <p>The React UI is currently in development. For now, you can:</p>
      <ul style="margin-top: 1rem; padding-left: 1.5rem; color: #888;">
        <li>Connect via WebSocket at <code>ws://${this.options.host}:${this.options.port}</code></li>
        <li>Use JSON-RPC methods: <code>status</code>, <code>traces/list</code>, <code>routes/list</code></li>
        <li>Watch traces in real-time as requests come in</li>
      </ul>
      <p style="margin-top: 1rem;">
        See <a href="https://github.com/yourusername/vision" target="_blank">documentation</a> for more info.
      </p>
    </div>
  </div>
  
  <script>
    const ws = new WebSocket('ws://${this.options.host}:${this.options.port}');
    const status = document.getElementById('status');
    
    ws.onopen = () => {
      status.textContent = 'Connected to WebSocket ✓';
      console.log('🔮 Connected to Vision Dashboard');
    };
    
    ws.onclose = () => {
      status.textContent = 'Disconnected';
      status.style.color = '#ef4444';
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 Message:', data);
    };
  </script>
</body>
</html>`
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
