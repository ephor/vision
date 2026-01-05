import type { LogStore } from './store'
import type { LogLevel } from '../types/logs'
import type { TraceStore } from '../tracing/store'
import { getActiveTraceId } from '../tracing/context'

/**
 * Console interceptor to capture logs
 * Preserves original console behavior while storing logs
 */
export class ConsoleInterceptor {
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  }

  private logStore: LogStore
  private traceStore?: TraceStore
  private onLog?: (level: LogLevel, message: string, args?: any[], stack?: string) => void

  constructor(
    logStore: LogStore,
    traceStore?: TraceStore,
    onLog?: (level: LogLevel, message: string, args?: any[], stack?: string) => void
  ) {
    this.logStore = logStore
    this.traceStore = traceStore
    this.onLog = onLog
  }

  /**
   * Start intercepting console methods
   */
  start(): void {
    const intercept = (level: LogLevel, original: (...args: any[]) => void) => {
      return (...args: any[]) => {
        // Call original console method first
        original.apply(console, args)

        // Format message
        const message = args
          .map((arg) => {
            if (typeof arg === 'string') return arg
            if (arg instanceof Error) return arg.message
            try {
              return JSON.stringify(arg)
            } catch {
              return String(arg)
            }
          })
          .join(' ')

        // Capture stack trace for errors
        let stack: string | undefined
        if (level === 'error') {
          const err = args.find((arg) => arg instanceof Error)
          if (err) {
            stack = err.stack
          }
        }

        // Get active trace context if available
        const activeTraceId = getActiveTraceId()
        let context: Record<string, any> | undefined

        if (activeTraceId && this.traceStore) {
          const trace = this.traceStore.getTrace(activeTraceId)
          if (trace?.metadata) {
            context = trace.metadata
          }
        }

        // Store log in global store with context
        const logEntry = this.logStore.addLog(level, message, args, stack, context)

        // Attach to active trace if exists
        if (activeTraceId && this.traceStore) {
          this.traceStore.addLog(activeTraceId, logEntry)
        }

        // Notify listener
        this.onLog?.(level, message, args, stack)
      }
    }

    console.log = intercept('log', this.originalConsole.log)
    console.info = intercept('info', this.originalConsole.info)
    console.warn = intercept('warn', this.originalConsole.warn)
    console.error = intercept('error', this.originalConsole.error)
    console.debug = intercept('debug', this.originalConsole.debug)
  }

  /**
   * Stop intercepting and restore original console
   */
  stop(): void {
    console.log = this.originalConsole.log
    console.info = this.originalConsole.info
    console.warn = this.originalConsole.warn
    console.error = this.originalConsole.error
    console.debug = this.originalConsole.debug
  }
}
