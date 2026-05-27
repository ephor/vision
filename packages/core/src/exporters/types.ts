import type { Trace } from '../types'

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
