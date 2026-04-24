import type { z } from 'zod'

/**
 * Event metadata for UI and runtime
 */
export interface EventMetadata<T = any> {
  name: string
  description?: string
  icon?: string
  tags?: string[]
  schema: z.ZodSchema<T>
  handlers: Array<(data: T) => Promise<void>>
  lastTriggered?: Date
  totalCount: number
  failedCount: number
}

/**
 * Cron job metadata
 */
export interface CronMetadata {
  name: string
  schedule: string
  description?: string
  icon?: string
  tags?: string[]
  handler: (context: any) => Promise<void>
  lastRun?: Date
  nextRun?: Date
  totalRuns: number
  failedRuns: number
}

/**
 * Global event registry
 */
export class EventRegistry {
  private events = new Map<string, EventMetadata>()
  private crons = new Map<string, CronMetadata>()

  /**
   * Register an event with schema and handler
   */
  registerEvent<T>(
    name: string,
    schema: z.ZodSchema<T>,
    handler: (data: T) => Promise<void>,
    metadata?: {
      description?: string
      icon?: string
      tags?: string[]
    }
  ): void {
    const existing = this.events.get(name)

    if (existing) {
      // Add handler to existing event and refresh metadata — on HMR the
      // user may have tweaked `description`/`icon`/`tags` or tightened the
      // schema; we want those visible in the Dashboard without a restart.
      existing.handlers.push(handler)
      existing.schema = schema
      if (metadata?.description !== undefined) existing.description = metadata.description
      if (metadata?.icon !== undefined) existing.icon = metadata.icon
      if (metadata?.tags !== undefined) existing.tags = metadata.tags
    } else {
      // Create new event
      this.events.set(name, {
        name,
        schema,
        handlers: [handler],
        description: metadata?.description,
        icon: metadata?.icon,
        tags: metadata?.tags,
        totalCount: 0,
        failedCount: 0,
      })
    }
  }

  /**
   * Register a cron job
   */
  registerCron(
    name: string,
    schedule: string,
    handler: (context: any) => Promise<void>,
    metadata?: {
      description?: string
      icon?: string
      tags?: string[]
    }
  ): void {
    this.crons.set(name, {
      name,
      schedule,
      handler,
      description: metadata?.description,
      icon: metadata?.icon,
      tags: metadata?.tags,
      totalRuns: 0,
      failedRuns: 0,
    })
  }

  /**
   * Get event metadata
   */
  getEvent(name: string): EventMetadata | undefined {
    return this.events.get(name)
  }

  /**
   * Get all events
   */
  getAllEvents(): EventMetadata[] {
    return Array.from(this.events.values())
  }

  /**
   * Get all cron jobs
   */
  getAllCrons(): CronMetadata[] {
    return Array.from(this.crons.values())
  }

  /**
   * Increment event count
   */
  incrementEventCount(name: string, failed = false): void {
    const event = this.events.get(name)
    if (event) {
      event.totalCount++
      if (failed) {
        event.failedCount++
      }
      event.lastTriggered = new Date()
    }
  }

  /**
   * Increment cron run count
   */
  incrementCronCount(name: string, failed = false): void {
    const cron = this.crons.get(name)
    if (cron) {
      cron.totalRuns++
      if (failed) {
        cron.failedRuns++
      }
      cron.lastRun = new Date()
    }
  }

  /**
   * Clear all registrations (for testing)
   */
  clear(): void {
    this.events.clear()
    this.crons.clear()
  }

  /**
   * Drop every registered handler for an event name but keep the metadata
   * entry (totals, lastTriggered, description…) intact. Used by the
   * HMR-safe re-registration path — we want the UI-visible stats to
   * survive a module reload even as the underlying handler closure is
   * swapped for the freshly compiled one.
   */
  clearEventHandlers(name: string): void {
    const ev = this.events.get(name)
    if (ev) ev.handlers = []
  }

  /**
   * Remove a cron registration entirely — the handler closure is going
   * away and so is the BullMQ worker that referenced it.
   */
  removeCron(name: string): void {
    this.crons.delete(name)
  }
}

// Global singleton — stashed on `globalThis` so Turbopack/HMR module
// re-evaluation reuses the same instance instead of creating a fresh one
// per reload (which would reset event counts and discard the cron map the
// Dashboard already snapshot-ed).
const REGISTRY_KEY = '__vision_event_registry'
const globalForRegistry = globalThis as unknown as {
  [REGISTRY_KEY]?: EventRegistry
}
export const eventRegistry: EventRegistry =
  globalForRegistry[REGISTRY_KEY] ??
  (globalForRegistry[REGISTRY_KEY] = new EventRegistry())
