import { useEffect, useRef } from 'react'
import { Clock, Zap } from 'lucide-react'
import { useTraces } from '@/hooks/useVision'
import type { Trace } from '@getvision/core'
import { Link, useParams } from 'react-router-dom'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { ScrollArea } from './ui/scroll-area'

interface TracesPanelProps {
  sessionId?: string
}

export function TracesPanel({ sessionId }: TracesPanelProps) {
  const { data: traces = [] } = useTraces({ limit: 50 })
  const filtered = sessionId ? traces.filter(t => (t.metadata as any)?.sessionId === sessionId) : traces
  const { traceId } = useParams<{ traceId: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(filtered.length)

  // Auto-scroll to top when new trace arrives
  useEffect(() => {
    if (filtered.length > prevCountRef.current && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    prevCountRef.current = filtered.length
  }, [filtered.length])

  return (
    <div className="w-80 border-l glass-muted flex flex-col">
      <div className="px-4 py-3 border-b glass">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Traces</h2>
          <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={containerRef}>
        <div className="p-3 space-y-2">
          {traces.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Traces will appear here</p>
              <p className="text-xs mt-1">after making API calls</p>
            </div>
          ) : (
            filtered.map((trace, index) => (
              <div key={trace.id}>
                <Link to={`/traces/${trace.id}`}>
                  <TraceItem trace={trace} isActive={trace.id === traceId} />
                </Link>
                {index < filtered.length - 1 && <Separator className="my-2" />}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function TraceItem({ trace, isActive }: { trace: Trace; isActive: boolean }) {
  const getStatusBadgeClass = (statusCode?: number) => {
    if (!statusCode) return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900'
    if (statusCode >= 400) return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900'
    return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900'
  }

  const getMethodBadgeClass = (method: string) => {
    if (method === 'GET') return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900'
    if (method === 'POST') return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900'
    if (method === 'PUT') return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900'
    if (method === 'DELETE') return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900'
    return ''
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
      second: '2-digit'
    })
  }

  return (
    <div className={`w-full text-left bg-background rounded-md p-2.5 border transition-all cursor-pointer ${
      isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
    }`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Badge className={`text-[10px] font-mono px-1.5 py-0 ${getMethodBadgeClass(trace.method)}`}>
          {trace.method}
        </Badge>
        <Badge className={`text-[10px] font-mono px-1.5 py-0 ${getStatusBadgeClass(trace.statusCode)}`}>
          {trace.statusCode || '...'}
        </Badge>
        {trace.spans.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {trace.spans.length} span{trace.spans.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      <div className="text-xs font-mono text-foreground truncate mb-2">
        {trace.path}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
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
