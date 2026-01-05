import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Play, Copy, Clock } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useRoutes, useAddClientMetrics } from '../hooks/useVision'
import { TracesPanel } from './TracesPanel'
import { JsonViewer } from './JsonViewer'
import { TraceLogs } from './TraceLogs'
import { useToast } from '../contexts/ToastContext'
import { getBackendUrl } from '../lib/config'
import type { RouteMetadata } from '@getvision/core'

type ExplorerTab = {
  id: string
  title: string
  sessionId: string
  route: RouteMetadata | null
  urlParams: Record<string, string>
  requestBody: string
  response: any
  requestTime: number | null
  executedAt: number | null
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function ApiExplorer() {
  const { data: routes = [] } = useRoutes()
  const { addToast } = useToast()
  const addClientMetrics = useAddClientMetrics()
  const initialTab: ExplorerTab = useMemo(() => ({
    id: genId(),
    title: 'New tab',
    sessionId: genId(),
    route: null,
    urlParams: {},
    requestBody: '',
    response: null,
    requestTime: null,
    executedAt: null,
  }), [])

  const [tabs, setTabs] = useState<ExplorerTab[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id)
  const [loading, setLoading] = useState(false)

  const STORAGE_TABS_KEY = 'vision.apiExplorer.tabs'
  const STORAGE_ACTIVE_KEY = 'vision.apiExplorer.activeTabId'

  // Load persisted tabs once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_TABS_KEY)
      const rawActive = localStorage.getItem(STORAGE_ACTIVE_KEY)
      if (raw) {
        const parsed: ExplorerTab[] = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTabs(parsed)
          if (rawActive && parsed.some(t => t.id === rawActive)) {
            setActiveTabId(rawActive)
          } else {
            setActiveTabId(parsed[0].id)
          }
        }
      }
    } catch {}
  }, [])

  // Persist tabs and active tab
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TABS_KEY, JSON.stringify(tabs))
      localStorage.setItem(STORAGE_ACTIVE_KEY, activeTabId)
    } catch {}
  }, [tabs, activeTabId])

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  // Clear response when switching endpoints
  const handleSelectRoute = (route: RouteMetadata) => {
    // Use Zod-generated template if available
    const requestBody = route.requestBody?.template || ''
    
    setTabs(tabs => tabs.map(t => t.id === activeTabId
      ? { ...t, route, title: route.path, response: null, requestTime: null, executedAt: null, urlParams: {}, requestBody }
      : t
    ))
  }

  const handleCallApi = async () => {
    const tab = activeTab
    if (!tab.route) return

    setLoading(true)
    setTabs(tabs => tabs.map(t => t.id === activeTabId ? { ...t, response: null } : t))
    
    const startTime = Date.now()
    
    try {
      // Replace URL parameters
      let url = tab.route.path
      Object.entries(tab.urlParams).forEach(([key, value]) => {
        url = url.replace(`:${key}`, value)
      })
      
      const fullUrl = `${getBackendUrl()}${url}`
      
      // Prepare request options
      const options: RequestInit = {
        method: tab.route.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Vision-Session': tab.sessionId,
        },
      }
      
      // Add body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(tab.route.method) && tab.requestBody) {
        try {
          // Remove comments from JSON template before parsing
          const cleanedBody = tab.requestBody
            .split('\n')
            .map(line => line.replace(/\/\/.*$/, '').trim())
            .filter(line => line.length > 0)
            .join('\n')
          options.body = JSON.stringify(JSON.parse(cleanedBody))
        } catch (e) {
          // If parsing fails, try to send as-is
          options.body = tab.requestBody
        }
      }
      
      const res = await fetch(fullUrl, options)
      
      const data = await res.json()
      const duration = Date.now() - startTime
      
      const headers: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        headers[key] = value
      })
      
      setTabs(tabs => tabs.map(t => t.id === activeTabId ? {
        ...t,
        response: { status: res.status, data, headers },
        requestTime: duration,
        executedAt: startTime,
      } : t))
      addToast(`API call completed in ${duration}ms`, 'success')
      
      // Send client-side duration to backend if we got a trace ID
      const traceId = res.headers.get('X-Vision-Trace-Id')
      console.log('📊 Trace ID from header:', traceId, 'Client duration:', duration)
      if (traceId) {
        addClientMetrics.mutate({ traceId, clientDuration: duration })
      }
    } catch (error) {
      setTabs(tabs => tabs.map(t => t.id === activeTabId ? {
        ...t,
        response: { status: 0, error: error instanceof Error ? error.message : 'Unknown error' },
        executedAt: startTime,
      } : t))
      addToast(error instanceof Error ? error.message : 'API call failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const setUrlParam = (key: string, value: string) => {
    setTabs(tabs => tabs.map(t => t.id === activeTabId ? {
      ...t, urlParams: { ...t.urlParams, [key]: value }
    } : t))
  }

  const setRequestBodyForTab = (value: string) => {
    setTabs(tabs => tabs.map(t => t.id === activeTabId ? { ...t, requestBody: value } : t))
  }

  const addTab = () => {
    const t: ExplorerTab = {
      id: genId(),
      title: 'New tab',
      sessionId: genId(),
      route: null,
      urlParams: {},
      requestBody: '',
      response: null,
      requestTime: null,
      executedAt: null,
    }
    setTabs(prev => [...prev, t])
    setActiveTabId(t.id)
  }

  const closeTab = (id: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev // do not remove the last tab
      const next = prev.filter(t => t.id !== id)
      if (activeTabId === id) {
        const fallback = next[next.length - 1]
        setActiveTabId(fallback.id)
      }
      return next
    })
  }

  return (
    <div className="flex h-full bg-background">
      {/* Left Sidebar - Routes List */}
      <div className="w-64 border-r border-border bg-muted/20 overflow-y-auto flex-shrink-0">
        <div className="p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Endpoints</h2>
          <div className="space-y-1">
            {routes.map((route, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectRoute(route)}
                className={`w-full text-left p-2 rounded-md text-sm font-medium transition-colors
                  ${activeTab.route === route 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent text-foreground'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Badge 
                    className={`text-[10px] font-mono w-12 flex items-center justify-center border-0
                      ${route.method === 'GET' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''}
                      ${route.method === 'POST' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : ''}
                      ${route.method === 'PUT' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' : ''}
                      ${route.method === 'DELETE' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : ''}
                    `}
                  >
                    {route.method}
                  </Badge>
                  <span className="font-mono text-xs truncate">{route.path}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Tabs + API Caller */}
      <div className="flex-1 overflow-y-auto bg-background">
        {/* Tabs Bar */}
        <div className="px-6 pt-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`relative flex-none inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                  tab.id === activeTabId 
                    ? 'bg-background text-foreground rounded-t-md border-t border-x border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50 rounded-t-md border-transparent border-t border-x'
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className="font-mono text-sm truncate max-w-[200px]">{tab.title}</span>
                {tabs.length > 1 && (
                  <button 
                    className="ml-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm p-0.5 -mr-1" 
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {tab.id === activeTabId && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-none ml-2 text-sm font-medium text-muted-foreground hover:text-foreground" 
              onClick={addTab}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New tab
            </Button>
          </div>
        </div>

        <div className="p-6 max-w-4xl">
          {activeTab.route ? (
            <div className="space-y-4">
              {/* API Caller Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">API Caller</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Endpoint</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-muted rounded-md p-2 font-mono text-sm border">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">{activeTab.route.method}</span>
                        {' '}
                        <span className="text-foreground">{activeTab.route.path}</span>
                      </div>
                      <Button 
                        onClick={handleCallApi}
                        disabled={loading}
                        className="bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-medium">Calling...</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Play className="w-4 h-4" />
                            <span className="text-sm font-medium">Call API</span>
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* URL Parameters */}
                  {activeTab.route.path.includes(':') && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">URL Parameters</Label>
                      <div className="space-y-3">
                        {activeTab.route.path.match(/:[^/]+/g)?.map((param) => {
                          const paramName = param.slice(1)
                          return (
                            <div key={paramName} className="grid grid-cols-4 gap-3 items-center">
                              <Label htmlFor={paramName} className="text-sm text-muted-foreground">{paramName}</Label>
                              <Input
                                id={paramName}
                                type="text"
                                value={activeTab.urlParams[paramName] || ''}
                                onChange={(e) => setUrlParam(paramName, e.target.value)}
                                placeholder={`Enter ${paramName}`}
                                className="col-span-3 text-sm"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Request Body */}
                  {['POST', 'PUT', 'PATCH'].includes(activeTab.route.method) && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Request Body (JSON)</Label>
                      <div className="border rounded-md overflow-hidden">
                        <Editor
                          height="200px"
                          language="json"
                          value={activeTab.requestBody}
                          onChange={(value) => setRequestBodyForTab(value || '')}
                          theme="vs-dark"
                          options={{
                            readOnly: false,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            formatOnPaste: true,
                            formatOnType: true,
                            fontSize: 14,
                            glyphMargin: false,
                            folding: true,
                            lineDecorationsWidth: 0,
                            lineNumbersMinChars: 3,
                            renderLineHighlight: 'all',
                            tabSize: 2,
                            insertSpaces: true,
                            scrollbar: {
                              vertical: 'auto',
                              horizontal: 'auto',
                              verticalScrollbarSize: 8,
                              horizontalScrollbarSize: 8,
                            },
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Response Section */}
              {activeTab.response && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base font-semibold">Response</CardTitle>
                        <Badge 
                          className={`text-xs font-mono
                            ${activeTab.response.status >= 200 && activeTab.response.status < 300 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900' : ''}
                            ${activeTab.response.status >= 400 ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900' : ''}
                          `}
                        >
                          {activeTab.response.status || 'ERROR'}
                        </Badge>
                        {activeTab.requestTime && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {activeTab.requestTime}ms
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(activeTab.response.data, null, 2))}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <JsonViewer data={activeTab.response.data || activeTab.response.error} />
                  </CardContent>
                </Card>
              )}

              {/* Request Logs Section */}
              {activeTab.response && activeTab.executedAt && (
                <TraceLogs 
                  title="Request Logs"
                  logs={[
                    {
                      id: 'req-start',
                      timestamp: activeTab.executedAt,
                      level: 'info',
                      message: `INF starting request endpoint=${activeTab.route?.path} service=${activeTab.route?.handler}`
                    },
                    {
                      id: 'req-end',
                      timestamp: activeTab.executedAt + (activeTab.requestTime || 0),
                      level: activeTab.response.status === 0 || activeTab.response.status >= 500 ? 'error' : 'info',
                      message: activeTab.response.status === 0 
                        ? `INF request failed error="${activeTab.response.error}" duration=${activeTab.requestTime}ms`
                        : `INF request completed code=${activeTab.response.status} duration=${activeTab.requestTime}ms`
                    }
                  ]}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Select an endpoint from the sidebar to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Traces */}
      <TracesPanel sessionId={activeTab.sessionId} />
    </div>
  )
}
