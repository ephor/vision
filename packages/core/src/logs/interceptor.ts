import type { LogStore } from './store'
import type { LogLevel } from '../types/logs'

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
  private onLog?: (level: LogLevel, message: string, args?: any[], stack?: string) => void

  constructor(logStore: LogStore, onLog?: (level: LogLevel, message: string, args?: any[], stack?: string) => void) {
    this.logStore = logStore
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

        // Store log
        this.logStore.addLog(level, message, args, stack)

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
