import type { Span } from '@getvision/core'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Database, Globe, Zap } from 'lucide-react'

interface SpansWaterfallProps {
  spans: Span[]
  formatDuration: (ms?: number) => string
}

// Organize spans into tree structure
function buildSpanTree(spans: Span[]) {
  // Sort spans by startTime first
  const sortedSpans = [...spans].sort((a, b) => a.startTime - b.startTime)
  
  const spanMap = new Map(sortedSpans.map(s => [s.id, { ...s, children: [] as Span[] }]))
  const roots: Span[] = []
  
  for (const span of sortedSpans) {
    const node = spanMap.get(span.id)!
    if (span.parentId) {
      const parent = spanMap.get(span.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        // Parent not found, treat as root
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }
  
  // Sort children by startTime as well
  for (const [_, span] of spanMap) {
    if (span.children && span.children.length > 1) {
      span.children.sort((a, b) => a.startTime - b.startTime)
    }
  }
  
  return roots
}

// Get span color based on name
function getSpanColor(name: string): { bg: string; border: string; text: string } {
  if (name.startsWith('http.')) {
    return {
      bg: 'bg-gradient-to-r from-blue-500/90 to-blue-600/90',
      border: 'border-blue-500/30',
      text: 'text-blue-50'
    }
  }
  if (name.startsWith('db.')) {
    return {
      bg: 'bg-gradient-to-r from-purple-500/90 to-purple-600/90',
      border: 'border-purple-500/30',
      text: 'text-purple-50'
    }
  }
  return {
    bg: 'bg-gradient-to-r from-emerald-500/90 to-emerald-600/90',
    border: 'border-emerald-500/30',
    text: 'text-emerald-50'
  }
}

// Get icon for span type
function getSpanIcon(name: string) {
  if (name.startsWith('http.')) return <Globe className="w-3.5 h-3.5" />
  if (name.startsWith('db.')) return <Database className="w-3.5 h-3.5" />
  return <Zap className="w-3.5 h-3.5" />
}

interface SpanRowProps {
  span: Span & { children?: Span[] }
  depth: number
  totalDuration: number
  t0: number
  formatDuration: (ms?: number) => string
}

function SpanRow({ span, depth, totalDuration, t0, formatDuration }: SpanRowProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = (span.children?.length || 0) > 0
  const offset = ((span.startTime - t0) / totalDuration) * 100
  const width = ((span.duration || 0) / totalDuration) * 100
  const hasAttrs = span.attributes && Object.keys(span.attributes).length > 0
  const [showAttrs, setShowAttrs] = useState(false)
  const colors = getSpanColor(span.name)
  const icon = getSpanIcon(span.name)

  return (
    <>
      <div className="group hover:bg-muted/50 transition-colors rounded-lg">
        <div className="flex items-start gap-3 p-3">
          {/* Expand/Collapse + Icon */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-0.5 hover:bg-muted rounded transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}
            <div className={`p-1.5 rounded-md ${colors.bg.replace('/90', '/20')} ${colors.border} border`}>
              {icon}
            </div>
          </div>

          {/* Span Info */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold font-mono truncate">{span.name}</span>
                {hasAttrs && (
                  <button
                    onClick={() => setShowAttrs(!showAttrs)}
                    className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 transition-colors font-medium"
                  >
                    {Object.keys(span.attributes || {}).length} attrs
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-mono font-semibold tabular-nums">
                  {formatDuration(span.duration)}
                </span>
              </div>
            </div>

            {/* Timeline Bar */}
            <div className="relative h-8 bg-muted/50 rounded-lg overflow-hidden border border-border/50">
              <div
                className={`absolute h-full ${colors.bg} ${colors.border} border-2 flex items-center px-2.5 shadow-lg transition-all duration-200 group-hover:shadow-xl`}
                style={{ left: `${offset}%`, width: `${Math.max(width, 0.5)}%` }}
              >
                <span className={`text-xs font-mono font-semibold ${colors.text} truncate drop-shadow-sm`}>
                  {span.name}
                </span>
              </div>
            </div>

            {/* Attributes */}
            {showAttrs && hasAttrs && (
              <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border/50 space-y-1.5">
                {Object.entries(span.attributes || {}).map(([key, value]) => {
                  if (key === 'http.request' || key === 'http.response') return null
                  if (typeof value === 'object' && value !== null) {
                    return (
                      <div key={key} className="font-mono text-xs flex items-start gap-2">
                        <span className="text-muted-foreground font-semibold">{key}:</span>
                        <span className="text-muted-foreground italic">[object]</span>
                      </div>
                    )
                  }
                  return (
                    <div key={key} className="font-mono text-xs flex items-start gap-2">
                      <span className="text-muted-foreground font-semibold min-w-[120px]">{key}:</span>
                      <span className="text-foreground break-all">{String(value)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="space-y-1">
          {span.children!.map(child => (
            <SpanRow
              key={child.id}
              span={child}
              depth={depth + 1}
              totalDuration={totalDuration}
              t0={t0}
              formatDuration={formatDuration}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function SpansWaterfall({ spans, formatDuration }: SpansWaterfallProps) {
  if (spans.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No spans recorded
      </div>
    )
  }

  const t0 = Math.min(...spans.map(s => s.startTime))
  const tEnd = Math.max(...spans.map(s => s.endTime || s.startTime))
  const totalDuration = tEnd - t0 || 1
  const tree = buildSpanTree(spans)
  
  // Debug: log tree structure
  console.log('[SpansWaterfall] Tree:', tree.map(s => ({
    name: s.name,
    id: s.id.slice(0, 8),
    parentId: s.parentId?.slice(0, 8),
    duration: s.duration
  })))
  
  console.log('[SpansWaterfall] All spans:', spans.map(s => ({
    name: s.name,
    id: s.id.slice(0, 8),
    parentId: s.parentId?.slice(0, 8),
    duration: s.duration
  })))

  return (
    <div className="space-y-3">
      {/* Timeline ruler */}
      <div className="flex justify-between items-center px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Timeline</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold">
            {spans.length} {spans.length === 1 ? 'span' : 'spans'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono font-semibold tabular-nums">
          <span className="text-muted-foreground">0ms</span>
          <div className="w-px h-4 bg-border" />
          <span className="text-foreground">{formatDuration(totalDuration)}</span>
        </div>
      </div>

      {/* Spans */}
      <div className="space-y-1">
        {tree.map(span => (
          <SpanRow
            key={span.id}
            span={span}
            depth={0}
            totalDuration={totalDuration}
            t0={t0}
            formatDuration={formatDuration}
          />
        ))}
      </div>
    </div>
  )
}
