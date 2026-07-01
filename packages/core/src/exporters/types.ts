import type { Trace, LogEntry } from '../types'

/**
 * A sink for completed traces. Implementations receive each trace as soon as it
 * finishes (right after the Dashboard broadcast) and are responsible for their
 * own buffering/transport. Errors thrown from `export` are swallowed by the core
 * so a failing exporter never affects request handling.
 */
export interface TraceExporter {
  /** Called once per completed trace. Should not block; buffer and flush async. */
  export(trace: Trace): void
  /** Flush any buffered traces and release resources. Invoked on `core.stop()`. */
  shutdown?(): Promise<void>
}

/**
 * A sink for log entries. Implementations receive each captured log (from
 * `ConsoleInterceptor`) as soon as it's stored and are responsible for their
 * own buffering/transport. Errors thrown from `export` are swallowed by the
 * core so a failing exporter never affects request handling.
 */
export interface LogExporter {
  /** Called once per captured log entry. Should not block; buffer and flush async. */
  export(entry: LogEntry): void | Promise<void>
  /** Called with a batch of log entries for bulk export. */
  exportBatch?(entries: LogEntry[]): void | Promise<void>
  /** Flush any buffered entries and release resources. Invoked on `core.stop()`. */
  shutdown?(): void | Promise<void>
}
