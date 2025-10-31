import { nanoid } from 'nanoid'
import type { Trace, Span } from '../types/index'

/**
 * In-memory trace store
 * Stores traces with automatic cleanup when max limit is reached
 */
export class TraceStore {
  private traces = new Map<string, Trace>()
  private maxTraces: number

  constructor(maxTraces = 1000) {
    this.maxTraces = maxTraces
  }

  /**
   * Create a new trace
   */
  createTrace(method: string, path: string): Trace {
    const trace: Trace = {
      id: nanoid(),
      timestamp: Date.now(),
      method,
      path,
      spans: [],
    }

    this.addTrace(trace)
    return trace
  }

  /**
   * Add a trace to the store
   */
  addTrace(trace: Trace): void {
    // Remove oldest trace if we've hit the limit
    if (this.traces.size >= this.maxTraces) {
      const oldestKey = this.traces.keys().next().value
      if (oldestKey) {
        this.traces.delete(oldestKey)
      }
    }

    this.traces.set(trace.id, trace)
  }

  /**
   * Add a span to a trace
   */
  addSpan(traceId: string, span: Span): void {
    const trace = this.traces.get(traceId)
    if (trace) {
      trace.spans.push(span)
    }
  }

  /**
   * Complete a trace with final data
   */
  completeTrace(traceId: string, statusCode: number, duration: number): void {
    const trace = this.traces.get(traceId)
    if (trace) {
      trace.statusCode = statusCode
      trace.duration = duration
    }
  }

  /**
   * Get a trace by ID
   */
  getTrace(id: string): Trace | undefined {
    return this.traces.get(id)
  }

  /**
   * Get all traces (newest first)
   */
  getAllTraces(): Trace[] {
    return Array.from(this.traces.values()).reverse()
  }

  /**
   * Get traces with filters
   */
  getTraces(filter?: {
    method?: string
    statusCode?: number
    minDuration?: number
    limit?: number
  }): Trace[] {
    let traces = this.getAllTraces()

    if (filter?.method) {
      traces = traces.filter((t) => t.method === filter.method)
    }

    if (filter?.statusCode) {
      traces = traces.filter((t) => t.statusCode === filter.statusCode)
    }

    if (filter?.minDuration) {
      traces = traces.filter((t) => (t.duration ?? 0) >= filter.minDuration!)
    }

    if (filter?.limit) {
      traces = traces.slice(0, filter.limit)
    }

    return traces
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear()
  }

  /**
   * Get trace count
   */
  count(): number {
    return this.traces.size
  }
}
