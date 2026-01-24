import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import { formatJson5 } from '../lib/formatJson5'
import { parseJson5 } from '../lib/parseJson5'
import { Button } from './ui/button'

Prism.languages.json5 = {
  comment: {
    pattern: /\/\/.*|\/\*[\s\S]*?\*\//,
    greedy: true,
  },
  property: {
    pattern: /(?:"(?:\\.|[^\\"\r\n])*"|'(?:\\.|[^\\'\r\n])*'|\b[a-zA-Z_$][\w$]*\b)(?=\s*:)/,
    greedy: true,
  },
  string: {
    pattern: /"(?:\\.|[^\\"\r\n])*"|'(?:\\.|[^\\'\r\n])*'/,
    greedy: true,
  },
  number: /-?(?:0x[\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)/,
  punctuation: /[{}[\],]/,
  operator: /:/,
  boolean: /\b(?:true|false)\b/,
  null: /\bnull\b/,
}

interface JsonEditorProps {
  value: string
  onChange: (value: string, parsed?: unknown) => void
  error?: string
  height?: string
}

export function JsonEditor({ value, onChange, error, height = '200px' }: JsonEditorProps) {
  const [localError, setLocalError] = useState<string | undefined>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const highlighted = useMemo(() => {
    const safeValue = value || ''
    return Prism.highlight(safeValue, Prism.languages.json5, 'json5')
  }, [value])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (!value.trim()) {
        setLocalError(undefined)
        return
      }
      try {
        const parsed = parseJson5(value)
        setLocalError(undefined)
        onChange(value, parsed)
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Invalid JSON5')
      }
    }, 350)

    return () => window.clearTimeout(handle)
  }, [value, onChange])

  const handleScroll = () => {
    if (!textareaRef.current || !preRef.current) return
    preRef.current.scrollTop = textareaRef.current.scrollTop
    preRef.current.scrollLeft = textareaRef.current.scrollLeft
  }

  const [isFormatting, setIsFormatting] = useState(false)

  const handleFormat = useCallback(async () => {
    setIsFormatting(true)
    try {
      const formatted = await formatJson5(value)
      onChange(formatted, parseJson5(formatted))
      setLocalError(undefined)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Invalid JSON5')
    } finally {
      setIsFormatting(false)
    }
  }, [value, onChange])

  const visibleError = error || localError

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-md border border-border bg-background font-mono text-xs text-foreground"
        style={{ height }}
      >
        <div className="flex items-center justify-between absolute top-2 right-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFormat}
            disabled={!value.trim() || Boolean(visibleError) || isFormatting}
            className="h-7 text-xs cursor-pointer"
          >
            Format
          </Button>
      </div>
        <pre
          ref={preRef}
          className="pointer-events-none absolute inset-0 overflow-auto p-3 font-mono text-xs
            [&_.token.property]:text-blue-500
            [&_.token.string]:text-green-500
            [&_.token.number]:text-orange-400
            [&_.token.boolean]:text-purple-400
            [&_.token.null]:text-purple-400
            [&_.token.punctuation]:text-gray-400
            [&_.token.operator]:text-gray-400
            [&_.token.comment]:text-gray-400"
          style={{
            lineHeight: '20px',
            letterSpacing: '0.025em',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxSizing: 'border-box',
            margin: 0,
          }}
          aria-hidden
        >
          <code
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: '12px',
              lineHeight: '20px',
              letterSpacing: '0.025em',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
            }}
            dangerouslySetInnerHTML={{ __html: highlighted || ' ' }}
          />
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="absolute inset-0 h-full w-full resize-none bg-transparent p-3 text-transparent caret-foreground outline-none"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: '12px',
            lineHeight: '20px',
            letterSpacing: '0.025em',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxSizing: 'border-box',
            tabSize: 2,
          }}
        />
      </div>
      {visibleError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {visibleError}
        </div>
      )}
    </div>
  )
}
