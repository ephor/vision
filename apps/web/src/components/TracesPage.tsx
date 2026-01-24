import { useEffect, useRef } from 'react'
import { Clock, Zap, ArrowLeft, Trash2, Download, RefreshCcw, Info, Layers, BookOpen } from 'lucide-react'
import { useTraces, useClearTraces, useExportTraces, useAddClientMetrics } from '../hooks/useVision'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { SectionCard } from './ui/section-card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { SpansWaterfall } from './SpansWaterfall'
import { TraceRequestResponse } from './TraceRequestResponse'
import { TraceLogs } from './TraceLogs'
import { getVisionClient } from '../lib/websocket'
import { useToast } from '../contexts/ToastContext'
import type { Trace } from '@getvision/core'

export function TracesPage() {
  const { data: traces = [] } = useTraces({ limit: 100 })
  const clearTraces = useClearTraces()
  const exportTraces = useExportTraces()
  const { traceId } = useParams<{ traceId: string }>()
  const { addToast } = useToast()
  const listContainerRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(traces.length)

  // Auto-scroll to top when new trace arrives
  useEffect(() => {
    if (traces.length > prevCountRef.current && listContainerRef.current) {
      listContainerRef.current.scrollTop = 0
    }
    prevCountRef.current = traces.length
  }, [traces.length])

  const handleClearTraces = async () => {
    if (traces.length === 0) return
    const confirmed = window.confirm(`Remove ${traces.length} trace${traces.length === 1 ? '' : 's'}?`)
    if (!confirmed) return
    try {
      await clearTraces.mutateAsync()
    } catch (error) {
      console.error('Failed to clear traces:', error)
      addToast('Failed to clear traces', 'error')
    }
  }

  const handleExportTraces = async () => {
    try {
      const result = await exportTraces.mutateAsync({ format: 'json' })
      const jsonString = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.download = `vision-traces-${timestamp}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export traces:', error)
      addToast('Failed to export traces', 'error')
    }
  }

  return (
    <div className="h-full flex bg-background">
      {/* Left: list */}
     <div className="w-1/3 flex flex-col border-r border-border bg-muted/20">
      <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">Traces</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Recent requests</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTraces}
                disabled={exportTraces.isPending || traces.length === 0}
                className="text-sm"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearTraces}
                disabled={clearTraces.isPending || traces.length === 0}
                className="text-sm"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto" style={{ contentVisibility: 'auto' }}>
          {traces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-muted-foreground">
              <Zap className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">No traces yet</p>
              <p className="text-xs mt-1">Make some API calls to see traces here</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {traces.map((trace, index) => (
                <div key={trace.id}>
                  <Link to={`/traces/${trace.id}`}>
                    <TraceListItem trace={trace} isActive={trace.id === traceId} />
                  </Link>
                  {index < traces.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail outlet */}
      <div className="w-2/3 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function TraceListItem({ trace, isActive }: { trace: Trace; isActive: boolean }) {
  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900'
      case 'POST': return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900'
      case 'PUT': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900'
      case 'DELETE': return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  const getStatusBadgeClass = (statusCode?: number) => {
    if (!statusCode) return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900'
    if (statusCode >= 400) return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900'
    return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900'
  }

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null) return '-'
    if (ms < 1) return '< 1ms'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  return (
    <div className={`w-full bg-background rounded-md border p-3 transition-all text-left cursor-pointer ${
      isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Badge className={`text-xs font-mono px-1.5 py-0 ${getMethodBadgeClass(trace.method)}`}>
          {trace.method}
        </Badge>
        <Badge className={`text-xs font-mono px-1.5 py-0 ${getStatusBadgeClass(trace.statusCode)}`}>
          {trace.statusCode || '...'}
        </Badge>
        {trace.spans.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {trace.spans.length} span{trace.spans.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="font-mono text-sm text-foreground truncate mb-2">
        {trace.path}
      </div>

      {(trace.metadata as any)?.sessionId && (
        <div className="mb-2">
          <Badge variant="outline" className="text-[10px] h-5 font-mono text-muted-foreground">
            session: {(trace.metadata as any).sessionId}
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatTime(trace.timestamp)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span className={trace.duration && trace.duration > 1000 ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
            {formatDuration(trace.duration)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function TraceDetail({ trace, onBack }: { trace: Trace; onBack?: () => void }) {
  const navigate = useNavigate()
  const addClientMetrics = useAddClientMetrics()

  const handleReplay = async () => {
    try {
      // Try to reconstruct the concrete URL used in the original request
      const reqSpan = trace.spans.find(s => s.name === 'http.request' || !!s.attributes?.['http.url'])
      const urlAttr = (reqSpan?.attributes?.['http.url'] as string | undefined) || trace.path

      const startedAt = Date.now()

      // Build URL - if urlAttr is already a full URL, use it; otherwise prepend base
      let url: string
      try {
        new URL(urlAttr) // Check if it's already a full URL
        url = urlAttr
      } catch {
        // It's a path, prepend base URL
        url = `http://localhost:3000${urlAttr.startsWith('/') ? '' : '/'}${urlAttr}`
      }

      // Subscribe once to the next trace after we fire the replay
      const client = getVisionClient()
      const unsubscribe = client.on('trace.new', (t: Trace) => {
        // Heuristic: same method and created after we triggered replay
        if (t.method === trace.method && t.timestamp >= startedAt) {
          navigate(`/traces/${t.id}`)
          unsubscribe()
        }
      })

      const replayStartTime = Date.now()
      const response = await fetch(url, { method: trace.method, headers: { 'Content-Type': 'application/json' } })
      const replayDuration = Date.now() - replayStartTime

      // Capture trace ID and send client metrics
      const replayTraceId = response.headers.get('X-Vision-Trace-Id')
      if (replayTraceId) {
        addClientMetrics.mutate({ traceId: replayTraceId, clientDuration: replayDuration })
      }

      // Rely on websocket trace.new to render latest in list; navigation handled by /traces/$traceId route when user clicks
    } catch (error) {
      console.error('Failed to replay request:', error)
    }
  }
  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1) return '< 1ms'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false
    })
  }

  const getStatusBadgeClass = (statusCode?: number) => {
    if (!statusCode) return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
    if (statusCode >= 400) return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
    return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
  }

  return (
    <div className="w-full">
      {onBack && (
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Traces
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {/* Overview Card */}
        <SectionCard
          title="Request Overview"
          icon={Info}
          headerRight={
            <Button onClick={handleReplay} variant="ghost" size="sm" className="h-7 cursor-pointer">
              <RefreshCcw className="w-4 h-4" />
            </Button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Method</p>
              <p className="font-mono text-sm font-medium">{trace.method}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Path</p>
              <p className="font-mono text-sm font-medium truncate">{trace.path}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Status</p>
              <Badge className={`text-xs font-mono ${getStatusBadgeClass(trace.statusCode)}`}>
                {trace.statusCode || 'Pending'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Duration</p>
              {(trace.metadata as any)?.clientDuration ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Server:</span>
                    <span className="font-mono text-sm">{formatDuration(trace.duration)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Total:</span>
                    <span className="font-mono text-sm font-medium">{formatDuration((trace.metadata as any).clientDuration)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Network:</span>
                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                      {formatDuration((trace.metadata as any).clientDuration - (trace.duration || 0))}
                    </span>
                  </div>
                </div>
              ) : (
                <p className={`font-mono text-sm font-medium ${trace.duration && trace.duration > 1000 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                  {formatDuration(trace.duration)}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Timestamp</p>
              <p className="font-mono text-sm">{formatTime(trace.timestamp)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Trace ID</p>
              <p className="font-mono text-xs text-muted-foreground">{trace.id}</p>
            </div>
          </div>
        </SectionCard>

        {/* Context Card */}
        {(() => {
          const systemKeys = ['request', 'response', 'sessionId', 'clientDuration']
          const contextKeys = Object.keys(trace.metadata || {}).filter(k => !systemKeys.includes(k))
          
          if (contextKeys.length === 0) return null

          return (
            <SectionCard title="Context" icon={BookOpen}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {contextKeys.map(key => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{key}</p>
                    <div className="font-mono text-sm bg-muted/50 rounded px-2 py-1 inline-block break-all">
                      {typeof (trace.metadata as any)[key] === 'object' 
                        ? JSON.stringify((trace.metadata as any)[key])
                        : String((trace.metadata as any)[key])
                      }
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )
        })()}

        {/* Request & Response Details */}
        <TraceRequestResponse trace={trace} formatDuration={formatDuration} />

        {/* Logs */}
        {trace.logs && trace.logs.length > 0 && (
          <TraceLogs logs={trace.logs} />
        )}

        {/* Spans Card */}
        {trace.spans.length > 0 && (
          <SectionCard
            title="Spans Timeline"
            icon={Layers}
            headerExtra={
              <span className="text-xs text-muted-foreground font-mono ml-2">
                {trace.spans.length} {trace.spans.length === 1 ? 'span' : 'spans'}
              </span>
            }
          >
            <SpansWaterfall spans={trace.spans} formatDuration={formatDuration} />
          </SectionCard>
        )}
      </div>
    </div>
  )
}
