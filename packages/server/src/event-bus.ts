import { Queue, Worker, QueueEvents } from 'bullmq'
import type { QueueEventsOptions, QueueOptions, WorkerOptions } from 'bullmq'
import { eventRegistry } from './event-registry'

/**
 * EventBus configuration
 */
export interface EventBusConfig {
  redis?: {
    host?: string
    port?: number
    password?: string
    /**
     * Enable keepalive to prevent connection timeouts (default: true in production)
     */
    keepAlive?: number
    /**
     * Max retry attempts for failed commands (default: 20)
     */
    maxRetriesPerRequest?: number
    /**
     * Enable ready check before executing commands (default: true)
     */
    enableReadyCheck?: boolean
    /**
     * Connection timeout in ms (default: 10000)
     */
    connectTimeout?: number
    /**
     * Enable offline queue (default: true)
     */
    enableOfflineQueue?: boolean
  }
  queue?: Omit<QueueOptions, 'connection'>
  worker?: Omit<WorkerOptions, 'connection'>
  queueEvents?: Omit<QueueEventsOptions, 'connection'>
  /**
   * Default BullMQ worker concurrency (per event). Per-handler options override this.
   */
  workerConcurrency?: number
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

    // Determine if Redis is configured by env or explicit config
    const hasRedisFromEnv = Boolean(envUrl)
    const hasRedisFromConfig = Boolean(
      config.redis && (config.redis.host || config.redis.port || config.redis.password)
    )
    const hasRedis = hasRedisFromEnv || hasRedisFromConfig

    // devMode precedence:
    // 1) Respect explicit config.devMode when provided (true/false)
    // 2) Otherwise, if Redis is configured (env or config), use production mode (devMode=false)
    // 3) Otherwise, default to devMode=true (in-memory)
    const resolvedDevMode =
      typeof config.devMode === 'boolean' ? config.devMode : !hasRedis

    this.config = {
      devMode: resolvedDevMode,
      redis: mergedRedis,
      workerConcurrency: config.workerConcurrency,
      queue: config.queue,
      worker: config.worker,
      queueEvents: config.queueEvents,
    }
  }

  /**
   * Get Redis connection configuration
   * Includes keepalive, retry strategy, and connection pooling
   */
  private getRedisConnection() {
    const baseConfig = this.config.redis || {
      host: 'localhost',
      port: 6379,
    }

    return {
      host: baseConfig.host,
      port: baseConfig.port,
      password: baseConfig.password,
      keepAlive: baseConfig.keepAlive ?? 30000, // 30 seconds keepalive
      maxRetriesPerRequest: baseConfig.maxRetriesPerRequest ?? 20,
      enableReadyCheck: baseConfig.enableReadyCheck ?? true,
      connectTimeout: baseConfig.connectTimeout ?? 10000,
      enableOfflineQueue: baseConfig.enableOfflineQueue ?? true,
      // Retry strategy for automatic reconnection
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.error('❌ Redis connection failed after 10 retries')
          return null // Stop retrying
        }
        const delay = Math.min(times * 200, 3000)
        console.log(`🔄 Redis reconnecting... attempt ${times}, delay ${delay}ms`)
        return delay
      },
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
      queue = new Queue(eventName, {
        ...(this.config.queue || {}),
        connection: this.getRedisConnection(),
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
    handler: (data: T) => Promise<void>,
    options?: {
      /**
       * Max number of concurrent jobs this handler will process.
       * Defaults to config.workerConcurrency (or 1).
       */
      concurrency?: number
    }
  ): void {
    if (this.config.devMode) {
      // Dev mode - store handlers in memory
      const handlers = this.devModeHandlers.get(eventName) || []
      handlers.push(handler)
      this.devModeHandlers.set(eventName, handlers)
    } else {
      // Production mode - create BullMQ worker
      const workerKey = `${eventName}-handler`
      
      // Close existing worker if it exists
      const existingWorker = this.workers.get(workerKey)
      if (existingWorker) {
        void existingWorker.close().catch(() => {})
        this.workers.delete(workerKey)
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
          ...(this.config.worker || {}),
          connection: this.getRedisConnection(),
          concurrency:
            options?.concurrency ??
            this.config.workerConcurrency ??
            this.config.worker?.concurrency ??
            1,
        }
      )

      this.workers.set(workerKey, worker)

      // Listen to queue events
      if (!this.queueEvents.has(eventName)) {
        const queueEvents = new QueueEvents(eventName, {
          ...(this.config.queueEvents || {}),
          connection: this.getRedisConnection(),
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
      const cronWorkerKey = `${cronName}-handler`
      
      // Close existing cron worker if it exists
      const existingCronWorker = this.workers.get(cronWorkerKey)
      if (existingCronWorker) {
        void existingCronWorker.close().catch(() => {})
        this.workers.delete(cronWorkerKey)
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
          ...(this.config.worker || {}),
          connection: this.getRedisConnection(),
          concurrency: this.config.worker?.concurrency ?? 1,
        }
      )

      this.workers.set(cronWorkerKey, worker)

      // Listen to cron job events
      if (!this.queueEvents.has(cronName)) {
        const queueEvents = new QueueEvents(cronName, {
          ...(this.config.queueEvents || {}),
          connection: this.getRedisConnection(),
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
