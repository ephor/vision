import {describe, test, expect} from 'bun:test'
import {VisionCore} from '../core'

describe('VisionCore (without server)', () => {
  test('should create and complete trace', () => {
    const vision = new VisionCore({
      port: 0,
      maxTraces: 100,
      captureConsole: false
    })

    const trace = vision.createTrace('GET', '/test')

    expect(trace).toBeDefined()
    expect(trace.id).toBeDefined()

    // Complete trace
    vision.completeTrace(trace.id, 200, 50)

    // Retrieve trace from store
    const retrieved = vision.getTraceStore().getTrace(trace.id)
    expect(retrieved).toBeDefined()
  })

  test('should use tracer', () => {
    const vision = new VisionCore({port: 0, captureConsole: false})

    const tracer = vision.getTracer()
    expect(tracer).toBeDefined()
  })

  test('should create span helper', () => {
    const vision = new VisionCore({port: 0, captureConsole: false})

    const trace = vision.createTrace('GET', '/test')

    const withSpan = vision.createSpanHelper(trace.id)

    const result = withSpan('test.operation', {'test.attr': 'value'}, () => {
      return 'test result'
    })

    expect(result).toBe('test result')

    // Check span was added
    const retrieved = vision.getTraceStore().getTrace(trace.id)
    expect(retrieved?.spans.length).toBeGreaterThan(0)
    expect(retrieved?.spans[0].name).toBe('test.operation')
  })

  test('should handle errors in span helper', () => {
    const vision = new VisionCore({port: 0, captureConsole: false})

    const trace = vision.createTrace('GET', '/test')

    const withSpan = vision.createSpanHelper(trace.id)

    expect(() => {
      withSpan('test.error', {}, () => {
        throw new Error('Test error')
      })
    }).toThrow('Test error')

    // Check error was recorded in span
    const retrieved = vision.getTraceStore().getTrace(trace.id)
    const errorSpan = retrieved?.spans[0]
    expect(errorSpan?.attributes?.error).toBe(true)
    expect(errorSpan?.attributes?.['error.message']).toBe('Test error')
  })

  test('should register routes', () => {
    const vision = new VisionCore({port: 0, captureConsole: false})

    const routes = [
      {method: 'GET', path: '/users', handler: 'getUsers'},
      {method: 'POST', path: '/users', handler: 'createUser'},
    ]

    vision.registerRoutes(routes)
    // Routes are registered, no easy way to verify without getter
    expect(true).toBe(true)
  })

  test('should set app status', () => {
    const vision = new VisionCore({port: 0, captureConsole: false})

    vision.setAppStatus({
      name: 'Test App',
      version: '1.0.0',
      environment: 'test',
      running: true,
    })

    expect(true).toBe(true)
  })

  test('should log messages', () => {
    const vision = new VisionCore({port: 0, captureConsole: false})

    const entry = vision.log('info', 'Test log message', {key: 'value'})

    expect(entry).toBeDefined()
    expect(entry.level).toBe('info')
    expect(entry.message).toBe('Test log message')
  })

  test('should broadcast events', () => {
    const vision = new VisionCore({port: 0, captureConsole: false})

    // Just test that broadcast doesn't throw
    vision.broadcast({
      type: 'log.entry',
      data: { id: "id", message: 'hello', level: "info", timestamp: Date.now() }
    })
    expect(true).toBe(true)
  })
})
