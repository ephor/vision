import { useAppStatus } from '../hooks/useVision'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Database, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'

export function DatabasePage() {
  const { data: status } = useAppStatus()
  const drizzle = status?.metadata?.drizzle

  if (!drizzle?.detected) {
    return (
      <div className="h-full flex items-center justify-center bg-muted p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
              No Database Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vision couldn't detect a Drizzle configuration file.
            </p>
            <div className="space-y-3">
              <p className="text-sm font-medium">To enable database features:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Create <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono border">drizzle.config.ts</code></li>
                <li>Enable auto-start in Vision config:</li>
              </ol>
              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-300 dark:text-gray-400 p-4 rounded-md text-xs overflow-x-auto font-mono border">
{`app.use('*', visionAdapter({
  drizzle: {
    autoStart: true,  // Auto-start Drizzle Studio
    port: 4983        // Optional, default: 4983
  }
}))`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const studioUrl = drizzle.studioUrl

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 bg-muted">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">Drizzle Studio</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant={drizzle.autoStarted ? "default" : "secondary"}
                  className={drizzle.autoStarted ? "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-xs" : "text-xs"}
                >
                  {drizzle.autoStarted ? 'Running' : 'Stopped'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {drizzle.autoStarted ? 'Auto-started' : 'Manual start required'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {studioUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(studioUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Open in New Tab</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {!drizzle.autoStarted && (
        <div className="p-6">
          <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="text-sm font-medium">Drizzle Studio is not running</p>
                <p className="text-sm text-muted-foreground">
                  Start Drizzle Studio manually or enable auto-start:
                </p>
                <pre className="bg-gray-900 dark:bg-gray-950 text-gray-300 dark:text-gray-400 p-4 rounded-md text-xs overflow-x-auto font-mono border">
                  {`# Start manually:\nnpx drizzle-kit studio --port ${drizzle.studioUrl?.match(/:(\d+)/)?.[1] || 4983}\n\n# Or enable auto-start:\ndrizzle: { autoStart: true }`}
                </pre>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Iframe */}
      {studioUrl && drizzle.autoStarted && (
        <div className="flex-1 relative">
          <iframe
            src={studioUrl}
            className="absolute inset-0 w-full h-full border-0"
            title="Drizzle Studio"
            allow="cross-origin-isolated"
          />
        </div>
      )}
    </div>
  )
}
