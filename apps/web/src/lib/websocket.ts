import type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from '@getvision/core'

export class VisionWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private messageId = 0
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>()
  private eventHandlers = new Map<string, Set<(data: any) => void>>()

  constructor(url?: string) {
    // Auto-detect WebSocket URL from current page
    if (!url) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host || 'localhost:9500'
      this.url = `${protocol}//${host}/ws`
    } else {
      this.url = url
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('🔌 Connected to Vision Dashboard')
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('🔌 Disconnected from Vision Dashboard')
          this.handleReconnect()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      // Handle JSON-RPC response
      if ('result' in message || 'error' in message) {
        const response = message as JsonRpcResponse
        const pending = this.pendingRequests.get(response.id as number)
        
        if (pending) {
          if (response.error) {
            pending.reject(new Error(response.error.message))
          } else {
            pending.resolve(response.result)
          }
          this.pendingRequests.delete(response.id as number)
        }
      }
      // Handle JSON-RPC notification (server -> client event)
      else if ('method' in message && !('id' in message)) {
        const notification = message as JsonRpcNotification
        this.emitEvent(notification.method, notification.params)
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * this.reconnectAttempts
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      
      setTimeout(() => {
        this.connect().catch(console.error)
      }, delay)
    }
  }

  /**
   * Call a JSON-RPC method
   */
  async call<T = any>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    const id = ++this.messageId
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      this.ws!.send(JSON.stringify(request))

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }

  /**
   * Subscribe to server events
   */
  on(event: string, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.delete(handler)
      }
    }
  }

  private emitEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.pendingRequests.clear()
    this.eventHandlers.clear()
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance
let client: VisionWebSocketClient | null = null

export function getVisionClient(): VisionWebSocketClient {
  if (!client) {
    client = new VisionWebSocketClient()
  }
  return client
}
