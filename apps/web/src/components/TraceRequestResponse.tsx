import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { SectionCard } from './ui/section-card'
import { Badge } from './ui/badge'
import { JsonViewer } from './JsonViewer'
import type { Trace } from '@getvision/core'

interface TraceRequestResponseProps {
  trace: Trace
  formatDuration: (ms?: number) => string
}

export function TraceRequestResponse({ trace, formatDuration }: TraceRequestResponseProps) {
  const reqSpan = trace.spans.find(s => s.name === 'http.request')
  const reqMeta = trace.metadata?.request || (reqSpan?.attributes?.['http.request'] as any)
  const resMeta = trace.metadata?.response || (reqSpan?.attributes?.['http.response'] as any)

  const getStatusBadgeClass = (statusCode?: number) => {
    if (!statusCode) return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
    if (statusCode >= 400) return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
    return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Request */}
      <SectionCard
        title="Request"
        icon={ArrowUpFromLine}
        headerExtra={
          <>
            <Badge className="font-mono text-xs ml-2">{trace.method}</Badge>
            <span className="font-mono text-xs text-muted-foreground ml-2">{formatDuration(trace.duration)}</span>
          </>
        }
      >
        <div className="space-y-3">
          <div className="font-mono text-sm break-all text-muted-foreground">{reqMeta?.url || trace.path}</div>
          {reqMeta?.headers && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Headers</p>
              <JsonViewer data={reqMeta.headers} showHeader={false} />
            </div>
          )}
          {reqMeta?.body !== undefined && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Body</p>
              <JsonViewer data={reqMeta.body} showHeader={false} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Response */}
      <SectionCard
        title="Response"
        icon={ArrowDownToLine}
        headerExtra={
          <>
            <Badge className={`font-mono text-xs ml-2 ${getStatusBadgeClass(trace.statusCode)}`}>
              {trace.statusCode || resMeta?.status || '-'}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono ml-2">{formatDuration(trace.duration)}</span>
          </>
        }
      >
        <div className="space-y-3">
          {resMeta?.headers && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Headers</p>
              <JsonViewer data={resMeta.headers} showHeader={false} />
            </div>
          )}
          {resMeta?.body !== undefined && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Body</p>
              <JsonViewer data={resMeta.body} showHeader={false} />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
