import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVisionClient } from '../lib/websocket'
import type { Trace, AppStatus, RouteMetadata } from '@getvision/core'

/**
 * Hook to connect to Vision WebSocket
 */
export function useVisionConnection() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const client = getVisionClient()

    client.connect()
      .then(() => setConnected(true))
      .catch((err) => setError(err))

    return () => {
      client.close()
    }
  }, [])

  return { connected, error }
}

/**
 * Hook to get app status
 */
export function useAppStatus() {
  return useQuery({
    queryKey: ['app-status'],
    queryFn: async () => {
      const client = getVisionClient()
      return await client.call<AppStatus>('status')
    },
    refetchInterval: 5000, // Refresh every 5s
  })
}

/**
 * Hook to get traces
 */
export function useTraces(filters?: {
  method?: string
  statusCode?: number
  limit?: number
}) {
  const queryClient = useQueryClient()

  // Subscribe to new traces
  useEffect(() => {
    const client = getVisionClient()
    const unsubscribe = client.on('trace.new', (trace: Trace) => {
      // Update cache with the same key as the query
      queryClient.setQueryData<Trace[]>(['traces', filters], (old = []) => {
        return [trace, ...old].slice(0, filters?.limit ?? 100)
      })
    })

    return unsubscribe
  }, [queryClient, filters])

  return useQuery({
    queryKey: ['traces', filters],
    queryFn: async () => {
      const client = getVisionClient()
      return await client.call<Trace[]>('traces/list', filters)
    },
  })
}

/**
 * Hook to get a specific trace
 */
export function useTrace(traceId: string | undefined) {
  return useQuery({
    queryKey: ['trace', traceId],
    queryFn: async () => {
      if (!traceId) return null
      const client = getVisionClient()
      return await client.call<Trace>('traces/get', { traceId })
    },
    enabled: !!traceId,
  })
}

/**
 * Hook to clear traces
 */
export function useClearTraces() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const client = getVisionClient()
      return await client.call('traces/clear')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traces'] })
      queryClient.invalidateQueries({ queryKey: ['trace'] })
    },
  })
}

/**
 * Hook to export traces in JSON or NDJSON format
 */
export function useExportTraces() {
  return useMutation({
    mutationFn: async (params: { format?: 'json' | 'ndjson' }) => {
      const client = getVisionClient()
      return await client.call('traces/export', params)
    },
  })
}

/**
 * Hook to add client-side metrics
 */
export function useAddClientMetrics() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: { traceId: string; clientDuration: number }) => {
      const client = getVisionClient()
      return await client.call('traces/addClientMetrics', params)
    },
    onSuccess: () => {
      // Invalidate traces queries to refetch with updated metadata
      queryClient.invalidateQueries({ queryKey: ['traces'] })
    },
  })
}

/**
 * Hook to fetch logs
 */
export function useLogs(params?: { level?: string; search?: string; limit?: number }) {
  const [logs, setLogs] = useState<any[]>([])

  // Subscribe to log.entry events
  useEffect(() => {
    const client = getVisionClient()
    
    const handleLogEntry = (entry: any) => {
      setLogs((prev) => [entry, ...prev].slice(0, params?.limit || 100))
    }

    client.on('log.entry', handleLogEntry)

    return () => {
      // Cleanup - remove listener
      const listeners = (client as any).eventHandlers?.get('log.entry')
      if (listeners) {
        listeners.delete(handleLogEntry)
      }
    }
  }, [params?.limit])

  // Fetch initial logs
  const query = useQuery({
    queryKey: ['logs', params],
    queryFn: async () => {
      const client = getVisionClient()
      return await client.call('logs/list', params)
    },
  })

  // Merge server logs with live updates
  useEffect(() => {
    if (query.data) {
      setLogs(query.data as any[])
    }
  }, [query.data])

  return { 
    data: logs, 
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook to clear logs
 */
export function useClearLogs() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const client = getVisionClient()
      return await client.call('logs/clear')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] })
    },
  })
}

/**
 * Hook to get routes
 */
export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const client = getVisionClient()
      return await client.call<RouteMetadata[]>('routes/list')
    },
  })
}

export interface ServiceGroup {
  name: string
  description?: string
  routes: RouteMetadata[]
}

/**
 * Hook to get services (grouped routes)
 */
export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const client = getVisionClient()
      return await client.call<ServiceGroup[]>('services/list')
    },
  })
}

/**
 * Hook to listen to logs
 */
export function useLogsListener() {
  const [logs, setLogs] = useState<Array<{
    type: 'stdout' | 'stderr'
    message: string
    timestamp: number
  }>>([])

  useEffect(() => {
    const client = getVisionClient()

    const unsubStdout = client.on('log.stdout', (data) => {
      setLogs(prev => [...prev, { type: 'stdout', ...data }].slice(-100))
    })

    const unsubStderr = client.on('log.stderr', (data) => {
      setLogs(prev => [...prev, { type: 'stderr', ...data }].slice(-100))
    })

    return () => {
      unsubStdout()
      unsubStderr()
    }
  }, [])

  return logs
}

/**
 * Hook to make RPC calls
 */
export function useVisionRPC() {
  return {
    call: async <T = any>(method: string, params?: any): Promise<T> => {
      const client = getVisionClient()
      return await client.call<T>(method, params)
    }
  }
}

export interface EventMetadata {
  name: string
  description?: string
  icon?: string
  tags?: string[]
  handlers: number
  lastTriggered?: string
  totalCount: number
  failedCount: number
}

export interface CronMetadata {
  name: string
  schedule: string
  description?: string
  icon?: string
  tags?: string[]
  lastRun?: string
  nextRun?: string
  totalRuns: number
  failedRuns: number
}

/**
 * Hook to get all registered events
 */
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const client = getVisionClient()
      return await client.call<EventMetadata[]>('events/list')
    },
    refetchInterval: 5000, // Auto-refresh every 5s
  })
}

/**
 * Hook to get all registered cron jobs
 */
export function useCrons() {
  return useQuery({
    queryKey: ['crons'],
    queryFn: async () => {
      const client = getVisionClient()
      return await client.call<CronMetadata[]>('cron/list')
    },
    refetchInterval: 5000, // Auto-refresh every 5s
  })
}
