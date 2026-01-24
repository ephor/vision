import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Button } from './ui/button'

interface JsonViewerProps {
  data: unknown
  initialDepth?: number
  showHeader?: boolean
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface Line {
  id: string
  indent: number
  foldable: boolean
  foldEnd?: number
  content: React.ReactNode
}

interface BuildContext {
  lines: Line[]
}

function buildLines(
  ctx: BuildContext,
  value: JsonValue,
  key: string | null,
  indent: number,
  path: string,
  isLast: boolean,
  isArrayItem: boolean,
): void {
  const comma = isLast ? '' : ','

  if (value === null) {
    ctx.lines.push({
      id: path,
      indent,
      foldable: false,
      content: (
        <>
          {key !== null && (
            <>
              <span className="text-blue-500">{isArrayItem ? `${key}` : `"${key}"`}</span>
              <span className="text-gray-400">: </span>
            </>
          )}
          <span className="text-purple-400">null</span>
          <span className="text-gray-400">{comma}</span>
        </>
      ),
    })
    return
  }

  if (typeof value === 'boolean') {
    ctx.lines.push({
      id: path,
      indent,
      foldable: false,
      content: (
        <>
          {key !== null && (
            <>
              <span className="text-blue-500">{isArrayItem ? `${key}` : `"${key}"`}</span>
              <span className="text-gray-400">: </span>
            </>
          )}
          <span className="text-purple-400">{value ? 'true' : 'false'}</span>
          <span className="text-gray-400">{comma}</span>
        </>
      ),
    })
    return
  }

  if (typeof value === 'number') {
    ctx.lines.push({
      id: path,
      indent,
      foldable: false,
      content: (
        <>
          {key !== null && (
            <>
              <span className="text-blue-500">{isArrayItem ? `${key}` : `"${key}"`}</span>
              <span className="text-gray-400">: </span>
            </>
          )}
          <span className="text-orange-400">{value}</span>
          <span className="text-gray-400">{comma}</span>
        </>
      ),
    })
    return
  }

  if (typeof value === 'string') {
    ctx.lines.push({
      id: path,
      indent,
      foldable: false,
      content: (
        <>
          {key !== null && (
            <>
              <span className="text-blue-500">{isArrayItem ? `${key}` : `"${key}"`}</span>
              <span className="text-gray-400">: </span>
            </>
          )}
          <span className="text-green-500">"{value}"</span>
          <span className="text-gray-400">{comma}</span>
        </>
      ),
    })
    return
  }

  if (Array.isArray(value)) {
    const startIndex = ctx.lines.length
    const startLine: Line = {
      id: path,
      indent,
      foldable: value.length > 0,
      content: (
        <>
          {key !== null && (
            <>
              <span className="text-blue-500">{isArrayItem ? `${key}` : `"${key}"`}</span>
              <span className="text-gray-400">: </span>
            </>
          )}
          <span className="text-gray-400">[</span>
        </>
      ),
    }
    ctx.lines.push(startLine)

    value.forEach((item, index) => {
      buildLines(ctx, item as JsonValue, String(index), indent + 1, `${path}[${index}]`, index === value.length - 1, true)
    })

    ctx.lines.push({
      id: `${path}__end`,
      indent,
      foldable: false,
      content: <span className="text-gray-400">]{comma}</span>,
    })
    ctx.lines[startIndex].foldEnd = ctx.lines.length - 1
    return
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    const startIndex = ctx.lines.length
    const startLine: Line = {
      id: path,
      indent,
      foldable: entries.length > 0,
      content: (
        <>
          {key !== null && (
            <>
              <span className="text-blue-500">{isArrayItem ? `${key}` : `"${key}"`}</span>
              <span className="text-gray-400">: </span>
            </>
          )}
          <span className="text-gray-400">{'{'}</span>
        </>
      ),
    }
    ctx.lines.push(startLine)

    entries.forEach(([k, v], index) => {
      buildLines(ctx, v, k, indent + 1, `${path}.${k}`, index === entries.length - 1, false)
    })

    ctx.lines.push({
      id: `${path}__end`,
      indent,
      foldable: false,
      content: <span className="text-gray-400">{'}'}{comma}</span>,
    })
    ctx.lines[startIndex].foldEnd = ctx.lines.length - 1
    return
  }
}

function createLines(value: JsonValue): Line[] {
  const ctx: BuildContext = { lines: [] }
  buildLines(ctx, value, null, 0, 'root', true, false)
  return ctx.lines
}

function getCollapsedPreview(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.length} items]`
  if (isPlainObject(value)) return `{${Object.keys(value).length} keys}`
  return ''
}

export function JsonViewer({ data, initialDepth = 2, showHeader = true }: JsonViewerProps) {
  const [copied, setCopied] = useState(false)

  const safeData = useMemo<JsonValue>(() => {
    if (data === undefined) return null
    if (typeof data === 'object' || typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data as JsonValue
    }
    return String(data)
  }, [data])

  const allLines = useMemo(() => createLines(safeData), [safeData])

  const initialCollapsed = useMemo(() => {
    const set = new Set<string>()
    function walk(value: JsonValue, depth: number, path: string) {
      if (depth >= initialDepth) {
        if (Array.isArray(value) && value.length > 0) set.add(path)
        else if (isPlainObject(value) && Object.keys(value).length > 0) set.add(path)
      }
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item as JsonValue, depth + 1, `${path}[${i}]`))
      } else if (isPlainObject(value)) {
        Object.entries(value).forEach(([k, v]) => walk(v, depth + 1, `${path}.${k}`))
      }
    }
    walk(safeData, 0, 'root')
    return set
  }, [safeData, initialDepth])

  const [collapsedState, setCollapsedState] = useState<Set<string>>(initialCollapsed)

  const toggleCollapse = (id: string) => {
    setCollapsedState((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleLines = useMemo(() => {
    const result: Array<{ line: Line; lineNum: number; originalIndex: number }> = []
    let i = 0
    while (i < allLines.length) {
      const line = allLines[i]
      result.push({ line, lineNum: result.length + 1, originalIndex: i })

      if (line.foldable && line.foldEnd !== undefined && collapsedState.has(line.id)) {
        i = line.foldEnd
      }
      i++
    }
    return result
  }, [allLines, collapsedState])

  const getValueAtPath = (path: string): JsonValue => {
    if (path === 'root') return safeData
    const parts = path.replace(/^root/, '').split(/\.|\[|\]/).filter(Boolean)
    let current: JsonValue = safeData
    for (const part of parts) {
      if (Array.isArray(current)) current = current[Number(part)] as JsonValue
      else if (isPlainObject(current)) current = current[part]
      else return null
    }
    return current
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const lineNumWidth = String(visibleLines.length).length * 8 + 12

  return (
    <div className={showHeader ? 'rounded-md border border-border bg-background' : ''}>
      {showHeader && (
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-mono">JSON Response</span>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs cursor-pointer">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}
      <div className="max-h-[480px] overflow-auto font-mono text-xs">
        <div className="flex">
          {/* Gutter */}
          <div
            className="flex-shrink-0 select-none border-r border-border/40 bg-muted/30"
            style={{ minWidth: lineNumWidth + 24 }}
          >
            {visibleLines.map(({ line, lineNum }) => (
              <div key={line.id + lineNum} className="flex h-5 items-center">
                <span
                  className="text-right text-[11px] text-muted-foreground/70 pr-1"
                  style={{ minWidth: lineNumWidth }}
                >
                  {lineNum}
                </span>
                <div className="w-4 h-4 flex items-center justify-center">
                  {line.foldable && (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(line.id)}
                      className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                    >
                      {collapsedState.has(line.id) ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 py-0">
            {visibleLines.map(({ line, lineNum }) => {
              const isCollapsed = line.foldable && collapsedState.has(line.id)
              const valueAtPath = isCollapsed ? getValueAtPath(line.id) : null

              return (
                <div key={line.id + lineNum} className="h-5 flex items-center whitespace-pre">
                  <span style={{ paddingLeft: line.indent * 16 }}>{line.content}</span>
                  {isCollapsed && valueAtPath !== null && (
                    <span className="text-muted-foreground ml-0.5">
                      {getCollapsedPreview(valueAtPath)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
