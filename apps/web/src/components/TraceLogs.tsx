import { Terminal } from 'lucide-react'
import { SectionCard } from './ui/section-card'
import type { LogEntry } from '@getvision/core'

interface TraceLogsProps {
  logs: LogEntry[]
  title?: string
}

export function TraceLogs({ logs, title = 'Terminal Output' }: TraceLogsProps) {
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
    // Format like a typical server log: HH:mm:ss.ms
    const date = new Date(timestamp)
    return date.toISOString().split('T')[1].slice(0, -1) 
  }

  const parseLogMessage = (msg: string) => {
    if (!msg) return { cleanMessage: '', properties: null }
    
    const pattern = /(\w+)=(?:"([^"]*)"|([^\s]*))/g
    const matches = [...msg.matchAll(pattern)]
    
    if (matches.length === 0) return { cleanMessage: msg, properties: null }

    let cleanMessage = msg
    const properties: Record<string, any> = {}

    matches.forEach((match) => {
        const [fullMatch, key, quotedVal, simpleVal] = match
        const value = quotedVal ?? simpleVal
        
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

  if (!logs || logs.length === 0) {
    return null
  }

  return (
    <SectionCard
      title={title}
      icon={Terminal}
      contentClassName="p-0"
      headerExtra={
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {logs.length} entries
        </span>
      }
    >
      <div className="font-mono text-[11px] md:text-xs overflow-x-auto max-h-[500px] overflow-y-auto p-4 space-y-0.5">
          {logs.map((log) => {
            const isSystemLog = log.message.includes('starting request') || log.message.includes('request completed') || log.message.includes('request failed')
            const { cleanMessage, properties: msgProperties } = isSystemLog ? parseLogMessage(log.message) : { cleanMessage: log.message, properties: null }
            
            return (
            <div 
              key={log.id} 
              className="group flex items-start gap-3 hover:bg-muted/50 px-2 -mx-2 rounded transition-colors py-0.5"
            >
              {/* Timestamp */}
              <span className="shrink-0 text-muted-foreground select-none w-20 md:w-24 tabular-nums opacity-70 group-hover:opacity-100 transition-opacity">
                {formatTime(log.timestamp)}
              </span>

              {/* Level */}
              <span className={`shrink-0 w-10 md:w-12 font-bold uppercase tracking-wider text-[10px] md:text-[11px] py-px ${getLevelColor(log.level)}`}>
                {log.level}
              </span>

              {/* Message & Stack */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-foreground break-words whitespace-pre-wrap leading-relaxed">
                    {cleanMessage}
                  </span>

                  {/* System Log Badges */}
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
                </div>
                
                {log.stack && (
                  <details className="mt-1">
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
    </SectionCard>
  )
}
