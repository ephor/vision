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
      // Add handler to existing event
      existing.handlers.push(handler)
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
}

// Global singleton
export const eventRegistry = new EventRegistry()
