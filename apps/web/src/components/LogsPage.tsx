import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2, Search, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react'
import { useLogs, useClearLogs } from '@/hooks/useVision'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { LogLevel } from '@getvision/core'
import { useNavigate } from 'react-router-dom'

export function LogsPage() {
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const clearLogs = useClearLogs()
  const navigate = useNavigate()
  
  const { data: logs = [] } = useLogs({ 
    limit: 10_000,
    level: levelFilter === 'all' ? undefined : levelFilter,
    search: searchQuery || undefined,
  })

  const parentRef = useRef<HTMLDivElement>(null)

  // Virtualize rows for performance (dynamic heights supported)
  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // base estimate, rows can grow
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  const handleClear = () => {
    if (confirm('Clear all logs?')) {
      clearLogs.mutate()
    }
  }

  const getTraceId = (log: any): string | undefined => {
    // Try parsing from message (e.g., "traceId=abc123")
    const msg = log.message || ''
    const match = msg.match(/traceId=([^\s]+)/)
    if (match) return match[1]
    
    // Fallback: check args for object with traceId
    const obj = log?.args?.find((a: any) => a && typeof a === 'object' && 'traceId' in a)
    return obj?.traceId as string | undefined
  }

  const getStructured = (log: any): Record<string, any> | undefined => {
    // Parse key=value pairs from message (e.g., "method=GET endpoint=/users/:id code=200")
    const msg = log.message || ''
    const kvPattern = /(\w+)=([^\s]+)/g
    const matches = [...msg.matchAll(kvPattern)]
    if (matches.length === 0) return undefined
    
    const result: Record<string, any> = {}
    matches.forEach(([, key, value]) => {
      // Parse JSON values if they look like JSON
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          result[key] = JSON.parse(value)
        } catch {
          result[key] = value
        }
      } else {
        result[key] = value
      }
    })
    return Object.keys(result).length ? result : undefined
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'info': return <Info className="w-4 h-4 text-blue-500" />
      case 'debug': return <Bug className="w-4 h-4 text-gray-500" />
      default: return <Info className="w-4 h-4 text-gray-400" />
    }
  }

  const getLevelBgClass = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
      case 'warn': return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
      case 'info': return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
      case 'debug': return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
      default: return 'bg-background border-border'
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-background border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Logs</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClear} className="text-sm font-medium">
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          {/* Level Filter */}
          <div className="flex gap-1">
            {(['all', 'log', 'info', 'warn', 'error', 'debug'] as const).map((level) => (
              <Button
                key={level}
                variant={levelFilter === level ? "default" : "outline"}
                size="sm"
                onClick={() => setLevelFilter(level)}
                className="text-sm font-medium"
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {/* Stats */}
          <Badge variant="secondary" className="text-sm">
            {logs.length.toLocaleString()} entries
          </Badge>
        </div>
      </div>

      {/* Logs List (Virtualized) */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto bg-muted px-6 py-4"
      >
        {logs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">No logs yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Logs will appear here as your application runs. Try making some API calls or use console.log() in your code.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const log = logs[virtualRow.index]
              const traceId = getTraceId(log)
              const meta = getStructured(log)
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className={`mb-2 p-3 border rounded-lg ${getLevelBgClass(log.level)}`}>
                    <div className="flex items-start gap-3">
                      {/* Level Icon */}
                      <div className="mt-0.5">{getLevelIcon(log.level)}</div>

                      {/* Timestamp */}
                      <div className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0 mt-0.5">
                        {formatTime(log.timestamp)}
                      </div>

                      {/* Message */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            {/* Message text + tags inline */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-mono">{log.message}</span>
                              {meta && (
                                <>
                                  {meta.method && <Badge className="font-mono text-xs">{meta.method}</Badge>}
                                  {meta.endpoint && <Badge variant="secondary" className="font-mono text-xs">{meta.endpoint}</Badge>}
                                  {meta.code !== undefined && <Badge variant="secondary" className="font-mono text-xs">code={meta.code}</Badge>}
                                  {meta.duration && <Badge variant="secondary" className="font-mono text-xs">duration={meta.duration}</Badge>}
                                  {meta.sessionId && <Badge variant="outline" className="font-mono text-xs">session={meta.sessionId}</Badge>}
                                  {meta.params && typeof meta.params === 'object' && (
                                    <>
                                      {Object.entries(meta.params).map(([k, v]) => (
                                        <Badge key={k} variant="outline" className="font-mono text-xs">
                                          {k}={String(v)}
                                        </Badge>
                                      ))}
                                    </>
                                  )}
                                  {meta.query && typeof meta.query === 'object' && (
                                    <>
                                      {Object.entries(meta.query).map(([k, v]) => (
                                        <Badge key={k} variant="outline" className="font-mono text-xs">
                                          {k}={String(v)}
                                        </Badge>
                                      ))}
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {traceId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/traces/${traceId}`)}
                              className="text-xs font-medium"
                            >
                              Go to trace
                            </Button>
                          )}
                        </div>

                        {/* Stack Trace (for errors) */}
                        {log.stack && (
                          <details className="mt-2" onToggle={(e) => {
                            // Re-measure row after expand/collapse
                            const el = (e.currentTarget.closest('[data-index]') as HTMLElement) || undefined
                            if (el) rowVirtualizer.measureElement(el)
                          }}>
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Stack trace
                            </summary>
                            <pre className="mt-2 text-xs bg-background p-2 rounded border overflow-auto whitespace-pre-wrap select-text">
                              {log.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
