import { WebSocketServer, WebSocket } from 'ws'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { createConnection } from 'net'
import { JsonRpcHandler } from './jsonrpc'
import { serveStatic, getUIPath } from './static'
import type { VisionServerOptions, DashboardEvent } from '../types/index'

/**
 * TCP probe — returns `true` if something is already LISTENING on the target
 * port. Used by `start()` to short-circuit before `httpServer.listen()` races
 * with another process on EADDRINUSE.
 *
 * We connect (not bind) because bind-probing has to immediately close and
 * racing another `listen()` between close + real listen is observable in
 * practice (multi-process Next.js). A successful TCP connect is proof the
 * port is owned by a live listener.
 */
export async function probePort(
  port: number,
  host = 'localhost',
  timeoutMs = 300,
): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const socket = createConnection({ port, host })
    const finish = (result: boolean) => {
      if (done) return
      done = true
      try {
        socket.destroy()
      } catch {
        /* ignore */
      }
      resolve(result)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    setTimeout(() => finish(false), timeoutMs)
  })
}

/**
 * Vision WebSocket Server
 * Handles real-time communication with the dashboard UI
 * Also serves static UI files on the same port
 *
 * Lifecycle: constructor is side-effect-free (builds `http.Server` +
 * `WebSocketServer` objects but does **not** bind). Call `start()` to bind
 * the port, `stop()` to tear down. `start()` probes the port first — if
 * another instance already listens, it silently marks the server as
 * "attached" so subsequent calls are no-ops. This covers the multi-process
 * Next.js / HMR case where several module evaluations try to bind 9500.
 */
export class VisionWebSocketServer {
  private httpServer: ReturnType<typeof createServer>
  private wss: WebSocketServer
  private clients = new Set<WebSocket>()
  private rpc: JsonRpcHandler
  private options: Required<Omit<VisionServerOptions, 'apiUrl' | 'autoStart'>> & {
    apiUrl?: string
  }
  /**
   * `true` once `start()` successfully binds the port, or once the port probe
   * finds a pre-existing listener (so we deliberately skip binding). Guards
   * `start()` from double-binding and `stop()` from closing an unbound server.
   */
  private started = false
  /** `true` if `start()` skipped binding because another process owns the port. */
  private attached = false

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

    this.setupListeners()
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
    const served = await serveStatic(req, res, uiPath, this.options.apiUrl)

    if (!served) {
      // No static UI available — return 404 (no legacy HTML fallback)
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Vision Dashboard UI not found. Build the UI or ensure adapters are running.')
    }
  }

  /**
   * Wire event listeners on the WS + HTTP server. Pure — no network I/O.
   * Called from the constructor. The actual `listen()` happens in `start()`.
   */
  private setupListeners(): void {
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
      // `ws` forwards the underlying HTTP server error — the friendly
      // EADDRINUSE message below covers this, so avoid double-logging the
      // stack trace.
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EADDRINUSE') return
      console.error('WebSocket server error:', error)
    })

    this.httpServer.on('error', (error) => {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'EADDRINUSE') {
        // Belt-and-suspenders: `start()` already probes and should skip
        // binding when the port is owned. This branch only fires if the port
        // got taken between probe + listen (rare — e.g. two processes racing
        // boot). Degrade silently in debug-only mode — the existing
        // Dashboard keeps serving so the user-visible experience is fine.
        this.attached = true
        if (process.env.DEBUG?.includes('vision')) {
          console.warn(
            `[vision] Dashboard port ${this.options.port} raced another listener on listen() — attaching instead.`
          )
        }
        return
      }
      console.error('HTTP server error:', error)
    })
  }

  /**
   * Bind the HTTP/WS server. Idempotent.
   *
   * If another process is already LISTENING on `options.port`, silently skip
   * binding and mark `attached = true` so `stop()` and subsequent `start()`s
   * are no-ops. This is the multi-process Next.js happy path — only one of
   * the Turbopack + next-server workers actually owns the Dashboard.
   */
  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    const inUse = await probePort(this.options.port, this.options.host)
    if (inUse) {
      this.attached = true
      if (process.env.DEBUG?.includes('vision')) {
        console.log(
          `[vision] Dashboard port ${this.options.port} already in use — attaching to existing instance.`
        )
      }
      return
    }

    await new Promise<void>((resolve) => {
      this.httpServer.listen(this.options.port, this.options.host, () => {
        console.log(
          `🚀 Vision Dashboard running at http://${this.options.host}:${this.options.port}`
        )
        console.log(
          `   WebSocket: ws://${this.options.host}:${this.options.port}/ws`
        )
        resolve()
      })
      // Resolve on EADDRINUSE too — our `error` handler above sets `attached`.
      this.httpServer.once('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') resolve()
      })
    })
  }

  /** Whether `start()` bound the port in this process (vs attached). */
  isOwning(): boolean {
    return this.started && !this.attached
  }

  /**
   * Stop the server. If we merely attached (didn't bind), this is a no-op.
   * Safe to call multiple times.
   */
  async stop(): Promise<void> {
    if (!this.started || this.attached) {
      this.started = false
      return
    }
    this.started = false
    await this.close()
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
