import { nanoid } from 'nanoid'
import type { LogEntry, LogLevel } from '../types/logs'

/**
 * Circular buffer for storing logs
 * Automatically removes oldest entries when limit is reached
 */
export class LogStore {
  private logs: LogEntry[] = []
  private maxLogs: number

  constructor(maxLogs = 10_000) {
    this.maxLogs = maxLogs
  }

  /**
   * Add a log entry
   */
  addLog(level: LogLevel, message: string, args?: any[], stack?: string, context?: Record<string, any>): LogEntry {
    const entry: LogEntry = {
      id: nanoid(),
      timestamp: Date.now(),
      level,
      message,
      args,
      stack,
      context,
    }

    this.logs.push(entry)

    // Remove oldest if we've hit the limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    return entry
  }

  /**
   * Get all logs (newest first)
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs].reverse()
  }

  /**
   * Get logs with filters
   */
  getLogs(filter?: {
    level?: LogLevel
    search?: string
    limit?: number
    since?: number
  }): LogEntry[] {
    let filtered = this.logs

    if (filter?.level) {
      filtered = filtered.filter((log) => log.level === filter.level)
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase()
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          log.args?.some((arg) =>
            String(arg).toLowerCase().includes(searchLower)
          ) ||
          (log.context && Object.values(log.context).some((val) => 
            String(val).toLowerCase().includes(searchLower)
          ))
      )
    }

    if (filter?.since) {
      filtered = filtered.filter((log) => log.timestamp >= (filter.since ?? 0))
    }

    // Newest first
    const reversed = [...filtered].reverse()

    if (filter?.limit) {
      return reversed.slice(0, filter.limit)
    }

    return reversed
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = []
  }

  /**
   * Get log count
   */
  count(): number {
    return this.logs.length
  }
}
