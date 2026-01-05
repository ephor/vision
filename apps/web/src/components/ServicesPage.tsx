import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStatus, useServices } from '../hooks/useVision'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Database, Server, Activity, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react'

export function ServicesPage() {
  const { data: status } = useAppStatus()
  const { data: services = [] } = useServices()
  const navigate = useNavigate()
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ service: string; method: string; path: string } | null>(null)
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())

  const integrations = status?.metadata?.integrations as Record<string, string> | undefined

  const toggleService = (serviceName: string) => {
    const newExpanded = new Set(expandedServices)
    if (newExpanded.has(serviceName)) {
      newExpanded.delete(serviceName)
    } else {
      newExpanded.add(serviceName)
    }
    setExpandedServices(newExpanded)
  }

  const handleEndpointSelect = (service: string, method: string, path: string) => {
    setSelectedEndpoint({ service, method, path })
  }

  const handleCallAPI = () => {
    if (selectedEndpoint) {
      navigate(`/api-explorer?method=${selectedEndpoint.method}&path=${selectedEndpoint.path}`)
    }
  }

  const totalEndpoints = services.reduce((sum, svc) => sum + svc.routes.length, 0)

  // Get full route metadata for selected endpoint
  const selectedRoute = selectedEndpoint
    ? services
        .find((s) => s.name === selectedEndpoint.service)
        ?.routes.find((r) => r.method === selectedEndpoint.method && r.path === selectedEndpoint.path)
    : null

  // Extract path parameters from route
  const extractPathParams = (path?: string): string[] => {
    const matches = path?.match(/:(\w+)/g)
    return matches ? matches.map((m) => m.slice(1)) : []
  }

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
      case 'POST': return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
      case 'PUT': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
      case 'DELETE': return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
      case 'PATCH': return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  const getIntegrationIcon = (key: string) => {
    if (key.includes('database') || key.includes('postgres') || key.includes('mysql')) {
      return <Database className="w-4 h-4" />
    }
    return <Server className="w-4 h-4" />
  }

  const maskConnectionString = (url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.password) {
        parsed.password = '***'
      }
      return parsed.toString()
    } catch {
      return url
    }
  }

  const pathParams = extractPathParams(selectedEndpoint?.path)

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar - Services Tree */}
      <div className="w-80 border-r border-border bg-muted/20 flex flex-col">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Services</h2>
            <Badge variant="secondary" className="text-xs">{services.length}</Badge>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3">
            {services.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No services discovered yet</p>
              </div>
            ) : (
              <div className="space-y-2">
              {services.map((service) => (
                <div key={service.name}>
                  {/* Service Header */}
                  <button
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-primary dark:hover:text-primary-foreground rounded"
                    onClick={() => toggleService(service.name)}
                  >
                    {expandedServices.has(service.name) ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="font-medium">{service.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">{service.routes.length}</span>
                  </button>

                  {/* Endpoints List */}
                  {expandedServices.has(service.name) && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {service.routes.map((route, idx) => (
                        <button
                          key={`${route.method}-${route.path}-${idx}`}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded ${
                            selectedEndpoint?.service === service.name &&
                            selectedEndpoint?.method === route.method &&
                            selectedEndpoint?.path === route.path
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-50 dark:hover:bg-primary dark:hover:text-primary-foreground'
                          }`}
                          onClick={() => handleEndpointSelect(service.name, route.method, route.path)}
                        >
                          <Badge className={`text-[10px] font-mono w-12 flex items-center justify-center px-1.5 py-0 ${getMethodBadgeClass(route.method)}`}>
                            {route.method}
                          </Badge>
                          <span className="text-xs truncate">{route.path}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
        <h1 className="text-lg font-semibold mb-6">Service Catalog</h1>

        {/* Service Overview Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="w-5 h-5" />
              {status?.name || 'Unknown Service'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Version</p>
                <p className="text-sm font-medium">{status?.version || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Framework</p>
                <p className="text-sm font-medium">{status?.metadata?.framework || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge variant={status?.running ? "default" : "secondary"} className={status?.running ? "bg-green-600" : ""}>
                  {status?.running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Endpoints</p>
                <p className="text-sm font-medium">{totalEndpoints}</p>
              </div>
            </div>

            {status?.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{status.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations Card */}
        {integrations && Object.keys(integrations).length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(integrations).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 p-3 bg-muted rounded-lg border">
                    <div className="mt-0.5">{getIntegrationIcon(key)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{key}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate" title={value}>
                        {maskConnectionString(value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Endpoint Details */}
        {selectedEndpoint && (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={`text-xs font-mono ${getMethodBadgeClass(selectedEndpoint.method)}`}>
                    {selectedEndpoint.method}
                  </Badge>
                  <div>
                    <div className="font-mono text-md font-semibold">{selectedEndpoint.path}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{selectedEndpoint.service} service</div>
                  </div>
                </div>
                <Button 
                  onClick={handleCallAPI}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  size="sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Test in API Explorer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Path Parameters */}
                {pathParams.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Path Parameters</h3>
                    <div className="space-y-2">
                      {pathParams.map((param) => (
                        <div key={param} className="flex items-start gap-3 p-3 bg-muted rounded-lg border">
                          <code className="text-sm font-mono font-semibold text-primary">{param}</code>
                          <span className="text-xs text-muted-foreground mt-0.5">string</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Query Parameters (for GET requests) */}
                {selectedEndpoint.method === 'GET' && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Query Parameters</h3>
                    <div className="p-4 bg-muted rounded-lg border">
                      <p className="text-sm text-muted-foreground">Optional query parameters can be added in API Explorer</p>
                    </div>
                  </div>
                )}

                {/* Request Body (for POST/PUT/PATCH) */}
                {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Request Body Schema</h3>
                    {selectedRoute?.requestBody ? (
                      <div className="space-y-3">
                        {/* Schema Fields */}
                        <div className="space-y-2">
                          {selectedRoute.requestBody.fields.map((field) => (
                            <div key={field.name} className="flex items-start gap-3 p-3 bg-muted rounded-lg border">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <code className="text-sm font-mono font-semibold">{field.name}</code>
                                  <Badge variant="outline" className="text-xs">{field.type}</Badge>
                                  {field.required && (
                                    <Badge variant="destructive" className="text-xs">required</Badge>
                                  )}
                                </div>
                                {field.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Auto-generated from Zod schema</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-muted rounded-lg border">
                        <p className="text-sm text-muted-foreground">No schema defined. Configure request body in API Explorer</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Response Body Schema */}
                {selectedRoute?.responseBody && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Response Body Schema</h3>
                    <div className="space-y-3">
                      {/* Schema Fields */}
                      <div className="space-y-2">
                        {selectedRoute.responseBody.fields.map((field) => (
                          <div key={field.name} className="flex items-start gap-3 p-3 bg-muted rounded-lg border">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono font-semibold">{field.name}</code>
                                <Badge variant="outline" className="text-xs">{field.type}</Badge>
                                {field.required && (
                                  <Badge variant="secondary" className="text-xs">always present</Badge>
                                )}
                              </div>
                              {field.description && (
                                <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Auto-generated from Zod schema</p>
                    </div>
                  </div>
                )}

                {/* Handler Info */}
                {selectedRoute?.handler && selectedRoute.handler !== 'anonymous' && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Handler</h3>
                    <code className="text-sm bg-muted px-3 py-1.5 rounded border inline-block">
                      {selectedRoute.handler}
                    </code>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </ScrollArea>
    </div>
  )
}
