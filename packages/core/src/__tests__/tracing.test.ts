import { describe, test, expect, beforeEach } from 'bun:test'
import { TraceStore, Tracer } from '../tracing/index'
import type { Trace } from '../types/index'

describe('TraceStore', () => {
  let store: TraceStore
  
  beforeEach(() => {
    store = new TraceStore(100)
  })

  test('should add trace', () => {
    const trace: Trace = {
      id: '123',
      timestamp: Date.now(),
      spans: [],
      method: 'GET',
      path: '/test',
      metadata: {},
    }
    
    store.addTrace(trace)
    const retrieved = store.getTrace('123')
    
    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('123')
    expect(retrieved?.path).toBe('/test')
    expect(retrieved?.method).toBe('GET')
  })

  test('should get traces with filters', () => {
    const trace1: Trace = {
      id: '1',
      method: 'GET',
      path: '/users',
      statusCode: 200,
      timestamp: Date.now(),
      spans: [],
      metadata: {},
    }
    
    const trace2: Trace = {
      id: '2',
      timestamp: Date.now(),
      spans: [],
      metadata: {},
      method: 'POST',
      path: '/users',
      statusCode: 201
    }
    
    store.addTrace(trace1)
    store.addTrace(trace2)
    
    const getTraces = store.getTraces({ method: 'GET' })
    expect(getTraces.length).toBe(1)
    expect(getTraces[0].id).toBe('1')
    
    const postTraces = store.getTraces({ method: 'POST' })
    expect(postTraces.length).toBe(1)
    expect(postTraces[0].id).toBe('2')
  })

  test('should limit number of traces', () => {
    const smallStore = new TraceStore(2)
    
    for (let i = 0; i < 5; i++) {
      smallStore.addTrace({
        id: `trace-${i}`,
        timestamp: Date.now(),
        method: "GET",
        path: '/test',
        spans: [],
      })
    }
    
    const traces = smallStore.getAllTraces()
    expect(traces.length).toBeLessThanOrEqual(2)
  })

  test('should clear all traces', () => {
    store.addTrace({
      id: '1',
      timestamp: Date.now(),
      method: "GET",
      path: '/test',
      spans: [],
    })
    
    store.clear()
    const traces = store.getAllTraces()
    
    expect(traces.length).toBe(0)
  })

  test('should filter by status code', () => {
    store.addTrace({
      id: '1',
      timestamp: Date.now(),
      spans: [],
      method: "GET",
      path: '/test',
      statusCode: 200,
      metadata: {},
    })
    
    store.addTrace({
      id: '2',
      timestamp: Date.now(),
      spans: [],
      method: "GET",
      path: '/test2',
      statusCode: 200,
      metadata: {},
    })
    
    const successTraces = store.getTraces({ statusCode: 200 })
    expect(successTraces.length).toBe(2)
    expect(successTraces[0]?.statusCode).toBe(200)
    expect(successTraces[1]?.statusCode).toBe(200)
  })
})

describe('Tracer', () => {
  test('should create tracer instance', () => {
    const tracer = new Tracer()
    expect(tracer).toBeDefined()
  })
})
