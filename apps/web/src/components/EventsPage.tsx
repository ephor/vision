import { Calendar, AlertCircle, CheckCircle2, Clock, Tag, Zap } from 'lucide-react'
import { useEvents, useCrons } from '@/hooks/useVision'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export function EventsPage() {
  const { data: events = [], isLoading: eventsLoading } = useEvents()
  const { data: crons = [], isLoading: cronsLoading } = useCrons()
  
  const loading = eventsLoading || cronsLoading

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getSuccessRate = (total: number, failed: number) => {
    if (total === 0) return 0
    return Math.round(((total - failed) / total) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events and cron jobs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-background border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Events & Cron Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Monitor your event-driven architecture and scheduled tasks</p>
      </div>

      <div className="bg-background border-b px-6 py-4">
        <Tabs defaultValue="events" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="events">
              <Zap className="w-4 h-4 mr-2" />
              Events ({events.length})
            </TabsTrigger>
            <TabsTrigger value="crons">
              <Clock className="w-4 h-4 mr-2" />
              Cron Jobs ({crons.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            {events.length === 0 ? (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-gray-500 text-center">No events registered yet</p>
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Card key={event.name} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="text-xl mt-0.5">{event.icon || '📡'}</div>
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold">{event.name}</CardTitle>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-primary">{event.totalCount}</div>
                        <p className="text-xs text-gray-500">total events</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Handlers</p>
                        <p className="text-sm font-medium">{event.handlers}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Success Rate</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${getSuccessRate(event.totalCount, event.failedCount)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {getSuccessRate(event.totalCount, event.failedCount)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Last Triggered</p>
                        <p className="text-sm">{formatDate(event.lastTriggered)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Failed Events</p>
                        <div className="flex items-center gap-2">
                          {event.failedCount > 0 ? (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <span className="text-sm font-medium text-red-600">{event.failedCount}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-600">No failures</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {event.tags && event.tags.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500 mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {event.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="crons" className="space-y-4">
            {crons.length === 0 ? (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-gray-500 text-center">No cron jobs scheduled</p>
                </CardContent>
              </Card>
            ) : (
              crons.map((cron) => (
                <Card key={cron.name} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="text-xl mt-0.5">{cron.icon || '⏰'}</div>
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold">{cron.name}</CardTitle>
                          {cron.description && (
                            <p className="text-sm text-muted-foreground mt-1">{cron.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                              {cron.schedule}
                            </code>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-primary">{cron.totalRuns}</div>
                        <p className="text-xs text-gray-500">total runs</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Success Rate</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${getSuccessRate(cron.totalRuns, cron.failedRuns)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {getSuccessRate(cron.totalRuns, cron.failedRuns)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Failed Runs</p>
                        <div className="flex items-center gap-2">
                          {cron.failedRuns > 0 ? (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <span className="text-sm font-medium text-red-600">{cron.failedRuns}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-600">No failures</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Last Run</p>
                        <p className="text-sm">{formatDate(cron.lastRun)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Next Run</p>
                        <p className="text-sm">{formatDate(cron.nextRun)}</p>
                      </div>
                    </div>

                    {cron.tags && cron.tags.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500 mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {cron.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
