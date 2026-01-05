import { AsyncLocalStorage } from 'node:async_hooks'

export const traceContext = new AsyncLocalStorage<string>()

/**
 * Get the current active trace ID
 */
export function getActiveTraceId(): string | undefined {
  return traceContext.getStore()
}

/**
 * Run a function within a trace context
 */
export function runInTraceContext<T>(traceId: string, fn: () => T): T {
  return traceContext.run(traceId, fn)
}
