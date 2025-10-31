import { nanoid } from 'nanoid'
import type { Span, SpanEvent } from '../types/index'

/**
 * Tracer for creating and managing spans
 */
export class Tracer {
  private activeSpans = new Map<string, Span>()

  /**
   * Start a new span
   */
  startSpan(name: string, traceId: string, parentId?: string): Span {
    const span: Span = {
      id: nanoid(),
      traceId,
      parentId,
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
    }

    this.activeSpans.set(span.id, span)
    return span
  }

  /**
   * End a span
   */
  endSpan(spanId: string): Span | undefined {
    const span = this.activeSpans.get(spanId)
    if (span) {
      span.endTime = Date.now()
      span.duration = span.endTime - span.startTime
      this.activeSpans.delete(spanId)
    }
    return span
  }

  /**
   * Add an attribute to a span
   */
  setAttribute(spanId: string, key: string, value: unknown): void {
    const span = this.activeSpans.get(spanId)
    if (span && span.attributes) {
      span.attributes[key] = value
    }
  }

  /**
   * Add an event to a span
   */
  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId)
    if (span) {
      const event: SpanEvent = {
        name,
        timestamp: Date.now(),
        attributes,
      }
      span.events?.push(event)
    }
  }

  /**
   * Get an active span
   */
  getSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId)
  }
}
