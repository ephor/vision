import { Queue, Worker, QueueEvents } from 'bullmq'
import type { z, ZodError } from 'zod'
import { eventRegistry } from './event-registry'

/**
 * EventBus configuration
 */
export interface EventBusConfig {
  redis?: {
    host?: string
    port?: number
    password?: string
  }
  // Dev mode - use in-memory (no Redis required)
  devMode?: boolean
}

/**
 * EventBus - Abstraction over BullMQ
 */
export class EventBus {
  private queues = new Map<string, Queue>()
  private workers = new Map<string, Worker>()
  private queueEvents = new Map<string, QueueEvents>()
  private config: EventBusConfig
  private devModeHandlers = new Map<string, Array<(data: any) => Promise<void>>>()

  constructor(config: EventBusConfig = {}) {
    // Build Redis config from environment variables
    const envUrl = process.env.REDIS_URL
    let envRedis: { host?: string; port?: number; password?: string } | undefined
    if (envUrl) {
      try {
        const u = new URL(envUrl)
        envRedis = {
          host: u.hostname || undefined,
          port: u.port ? parseInt(u.port) : 6379,
          // URL password takes precedence over REDIS_PASSWORD
          password: u.password || process.env.REDIS_PASSWORD || undefined,
        }
      } catch {
        // Fallback to individual env vars if URL is invalid
        envRedis = undefined
      }
    }

    if (!envRedis) {
      envRedis = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      }
    }

    // Merge: explicit config.redis overrides env-derived values
    const mergedRedis = { ...(envRedis || {}), ...(config.redis || {}) }

    this.config = {
      devMode: config.devMode ?? process.env.NODE_ENV === 'development',
      redis: mergedRedis,
    }
  }

  /**
   * Get or create a queue for an event
   */
  private getQueue(eventName: string): Queue {
    if (this.config.devMode) {
      // In dev mode, we don't use actual queues
      return null as any
    }

    let queue = this.queues.get(eventName)
    if (!queue) {
      const connection = this.config.redis || {
        host: 'localhost',
        port: 6379,
      }
      queue = new Queue(eventName, {
        connection,
      })
      this.queues.set(eventName, queue)
    }
    return queue
  }

  /**
   * Get or create a queue for a cron job
   */
  async getQueueForCron(cronName: string): Promise<Queue> {
    if (this.config.devMode) {
      // In dev mode, return a mock queue
      return {
        upsertJobScheduler: async () => {},
      } as any
    }

    return this.getQueue(cronName)
  }

  /**
   * Emit an event
   */
  async emit<T extends Record<string, any>>(
    eventName: string,
    data: T
  ): Promise<void> {
    // Get event metadata from registry
    const eventMeta = eventRegistry.getEvent(eventName)
    if (!eventMeta) {
      throw new Error(`Event "${eventName}" not registered. Did you forget to add .on('${eventName}', {...})?`)
    }

    // Validate data with Zod schema (enforce no unknown keys when possible)
    try {
      // If the event schema is a ZodObject, use strict() to disallow unknown keys
      const maybeStrictSchema: any = (eventMeta.schema as any)
      const strictSchema = typeof maybeStrictSchema?.strict === 'function'
        ? maybeStrictSchema.strict()
        : eventMeta.schema

      const validatedData = (strictSchema as typeof eventMeta.schema).parse(data)

      if (this.config.devMode) {
        // Dev mode - execute handlers immediately (in-memory)
        const handlers = this.devModeHandlers.get(eventName) || []
        
        for (const handler of handlers) {
          try {
            await handler(validatedData)
            eventRegistry.incrementEventCount(eventName, false)
          } catch (error) {
            console.error(`Error in handler for event "${eventName}":`, error)
            eventRegistry.incrementEventCount(eventName, true)
            throw error
          }
        }
      } else {
        // Production mode - use BullMQ
        const queue = this.getQueue(eventName)
        await queue.add(eventName, validatedData, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        })
        eventRegistry.incrementEventCount(eventName, false)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as any
        const errorMessages = zodError.errors?.map((e: any) => `  - ${e.path.join('.')}: ${e.message}`).join('\n') || error.message
        throw new Error(
          `Invalid data for event "${eventName}":\n${errorMessages}`
        )
      }
      throw error
    }
  }

  /**
   * Register event handler
   */
  registerHandler<T>(
    eventName: string,
    handler: (data: T) => Promise<void>
  ): void {
    if (this.config.devMode) {
      // Dev mode - store handlers in memory
      const handlers = this.devModeHandlers.get(eventName) || []
      handlers.push(handler)
      this.devModeHandlers.set(eventName, handlers)
    } else {
      // Production mode - create BullMQ worker
      const connection = this.config.redis || {
        host: 'localhost',
        port: 6379,
      }
      const worker = new Worker(
        eventName,
        async (job) => {
          try {
            await handler(job.data)
          } catch (error) {
            eventRegistry.incrementEventCount(eventName, true)
            throw error
          }
        },
        {
          connection,
        }
      )

      this.workers.set(`${eventName}-${Date.now()}`, worker)

      // Listen to queue events
      if (!this.queueEvents.has(eventName)) {
        const connection = this.config.redis || {
          host: 'localhost',
          port: 6379,
        }
        const queueEvents = new QueueEvents(eventName, {
          connection,
        })

        queueEvents.on('completed', ({ jobId }) => {
          console.log(`✅ Event "${eventName}" completed (job: ${jobId})`)
        })

        queueEvents.on('failed', ({ jobId, failedReason }) => {
          console.error(`❌ Event "${eventName}" failed (job: ${jobId}):`, failedReason)
        })

        this.queueEvents.set(eventName, queueEvents)
      }
    }
  }

  /**
   * Register cron job handler
   */
  registerCronHandler(
    cronName: string,
    handler: (context: any) => Promise<void>
  ): void {
    if (this.config.devMode) {
      // Dev mode - cron jobs run immediately for testing
      // We'll implement a simple interval-based scheduler
      console.log(`🧹 Cron job "${cronName}" registered (dev mode - manual trigger only)`)
      
      // Store handler for manual trigger
      const handlers = this.devModeHandlers.get(cronName) || []
      handlers.push(handler)
      this.devModeHandlers.set(cronName, handlers)
    } else {
      // Production mode - create BullMQ worker for cron jobs
      const connection = this.config.redis || {
        host: 'localhost',
        port: 6379,
      }
      const worker = new Worker(
        cronName,
        async (job) => {
          try {
            // Create a simple context for cron handler
            const context = {
              jobId: job.id,
              timestamp: Date.now(),
            }
            await handler(context)
            eventRegistry.incrementCronCount(cronName, false)
          } catch (error) {
            eventRegistry.incrementCronCount(cronName, true)
            throw error
          }
        },
        {
          connection,
        }
      )

      this.workers.set(`${cronName}-${Date.now()}`, worker)

      // Listen to cron job events
      if (!this.queueEvents.has(cronName)) {
        const queueEvents = new QueueEvents(cronName, {
          connection,
        })

        queueEvents.on('completed', ({ jobId }) => {
          console.log(`✅ Cron job "${cronName}" completed (job: ${jobId})`)
        })

        queueEvents.on('failed', ({ jobId, failedReason }) => {
          console.error(`❌ Cron job "${cronName}" failed (job: ${jobId}):`, failedReason)
        })

        this.queueEvents.set(cronName, queueEvents)
      }
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.config.devMode) {
      this.devModeHandlers.clear()
      return
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close()
    }

    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close()
    }

    // Close all queue events
    for (const queueEvent of this.queueEvents.values()) {
      await queueEvent.close()
    }

    this.queues.clear()
    this.workers.clear()
    this.queueEvents.clear()
  }
}
