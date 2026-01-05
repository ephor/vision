import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2, Search, Terminal, ArrowUpRight } from 'lucide-react'
import { useLogs, useClearLogs } from '@/hooks/useVision'
import { Button } from './ui/button'
import { Input } from './ui/input'
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
    estimateSize: () => 28, // Compact terminal rows are smaller
    overscan: 20,
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

  const parseLogMessage = (msg: string) => {
    if (!msg) return { cleanMessage: '', properties: null }
    
    // Match key=value where value can be quoted string or non-whitespace
    const pattern = /(\w+)=(?:"([^"]*)"|([^\s]*))/g
    const matches = [...msg.matchAll(pattern)]
    
    if (matches.length === 0) return { cleanMessage: msg, properties: null }

    let cleanMessage = msg
    const properties: Record<string, any> = {}

    matches.forEach((match) => {
        const [fullMatch, key, quotedVal, simpleVal] = match
        const value = quotedVal ?? simpleVal
        
        // Remove from message - use split/join to replace all occurrences or just careful replacement
        // For logs, replace is usually safe enough
        cleanMessage = cleanMessage.replace(fullMatch, '')
        
        try {
            properties[key] = value.startsWith('{') || value.startsWith('[') ? JSON.parse(value) : value
        } catch {
            properties[key] = value
        }
    })
    
    return { 
        cleanMessage: cleanMessage.replace(/\s+/g, ' ').trim(), 
        properties 
    }
  }

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'text-red-500 dark:text-red-400'
      case 'warn': return 'text-yellow-500 dark:text-yellow-400'
      case 'info': return 'text-blue-500 dark:text-blue-400'
      case 'debug': return 'text-purple-500 dark:text-purple-400'
      default: return 'text-gray-500 dark:text-gray-400'
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toISOString().split('T')[1].slice(0, -1) // HH:mm:ss.ms
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold tracking-tight">System Logs</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClear} className="text-xs font-mono h-8">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              clear_logs
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Level Filter */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg self-start">
            {(['all', 'log', 'info', 'warn', 'error', 'debug'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-1 text-[11px] font-medium font-mono uppercase tracking-wider rounded-md transition-all ${
                  levelFilter === level 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder="grep logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm font-mono bg-muted/50 border-transparent focus:border-border focus:bg-background transition-all"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 ml-auto text-xs font-mono text-muted-foreground">
            <span>{logs.length} entries</span>
          </div>
        </div>
      </div>

      {/* Logs List (Virtualized) */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto px-4 py-2 font-mono text-[11px] md:text-xs"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <Terminal className="w-12 h-12 mb-4 stroke-1" />
            <p className="text-sm">No logs output</p>
            <p className="text-xs mt-1 font-mono">Waiting for system activity...</p>
          </div>
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
              const isSystemLog = log.message.includes('starting request') || log.message.includes('request completed') || log.message.includes('request failed')
              
              const { cleanMessage, properties: msgProperties } = isSystemLog ? parseLogMessage(log.message) : { cleanMessage: log.message, properties: null }
              
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
                  className="group flex items-start gap-3 hover:bg-muted/40 px-2 -mx-2 rounded transition-colors py-0.5"
                >
                  {/* Timestamp */}
                  <span className="shrink-0 text-muted-foreground select-none w-20 md:w-24 tabular-nums opacity-60 group-hover:opacity-100 transition-opacity">
                    {formatTime(log.timestamp)}
                  </span>

                  {/* Level */}
                  <span className={`shrink-0 w-10 md:w-12 font-bold uppercase tracking-wider text-[10px] md:text-[11px] py-px ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>

                  {/* Message & Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-foreground break-words whitespace-pre-wrap leading-relaxed">
                        {cleanMessage}
                      </span>

                      {/* System Log Badges (Message Properties + Context) */}
                      {isSystemLog && (
                        <>
                          {/* Message Properties */}
                          {msgProperties && Object.entries(msgProperties).map(([k, v]) => (
                            <span key={`meta-${k}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border">
                              <span className="opacity-70 mr-1">{k}=</span>
                              <span className="font-medium text-foreground">{String(v)}</span>
                            </span>
                          ))}

                          {/* Context Properties */}
                          {log.context && Object.entries(log.context).map(([k, v]) => {
                            if (['request', 'response', 'sessionId', 'clientDuration'].includes(k)) return null
                            // Avoid duplicating keys that were in message
                            if (msgProperties && k in msgProperties) return null
                            
                            return (
                              <span key={`ctx-${k}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">
                                <span className="opacity-70 mr-1">{k}=</span>
                                <span className="font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                              </span>
                            )
                          })}
                        </>
                      )}

                      {/* Trace Link */}
                      {traceId && (
                        <button
                          onClick={() => navigate(`/traces/${traceId}`)}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                        >
                          <span>trace:{traceId.slice(0, 7)}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Stack Trace */}
                    {log.stack && (
                      <details className="mt-1" onToggle={(e) => {
                        // Re-measure row after expand/collapse
                        const el = (e.currentTarget.closest('[data-index]') as HTMLElement) || undefined
                        if (el) rowVirtualizer.measureElement(el)
                      }}>
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none inline-flex items-center gap-1 transition-colors">
                          <span className="text-[10px] uppercase tracking-wide">Show Stack Trace</span>
                        </summary>
                        <div className="mt-2 pl-3 border-l-2 border-border text-muted-foreground overflow-x-auto">
                          <pre className="font-mono text-[10px] leading-relaxed whitespace-pre select-text">
                            {log.stack}
                          </pre>
                        </div>
                      </details>
                    )}
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
