/**
 * Log entry types
 */
export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
  args?: any[]
  source?: string
  stack?: string
}
