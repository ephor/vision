import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
} from '../types/index'

/**
 * JSON-RPC 2.0 Handler
 */
export class JsonRpcHandler {
  private methods = new Map<string, (params: unknown) => Promise<unknown>>()

  /**
   * Register a JSON-RPC method
   */
  register(method: string, handler: (params: unknown) => Promise<unknown>): void {
    this.methods.set(method, handler)
  }

  /**
   * Handle incoming JSON-RPC request
   */
  async handle(message: string): Promise<string | null> {
    let request: JsonRpcRequest
    
    try {
      request = JSON.parse(message)
    } catch (error) {
      return this.createErrorResponse(null, -32700, 'Parse error')
    }

    // Validate JSON-RPC request
    if (request.jsonrpc !== '2.0') {
      return this.createErrorResponse(request.id ?? null, -32600, 'Invalid Request')
    }

    // Handle notification (no response needed)
    if (request.id === undefined) {
      return null
    }

    // Find and execute method
    const handler = this.methods.get(request.method)
    if (!handler) {
      return this.createErrorResponse(request.id, -32601, `Method not found: ${request.method}`)
    }

    try {
      const result = await handler(request.params)
      return this.createSuccessResponse(request.id, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error'
      return this.createErrorResponse(request.id, -32603, message)
    }
  }

  /**
   * Create a notification (server -> client)
   */
  createNotification(method: string, params?: unknown): string {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    }
    return JSON.stringify(notification)
  }

  private createSuccessResponse(id: string | number, result: unknown): string {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      result,
      id,
    }
    return JSON.stringify(response)
  }

  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): string {
    const error: JsonRpcError = { code, message, data }
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error,
      id,
    }
    return JSON.stringify(response)
  }
}
