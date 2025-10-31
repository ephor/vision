import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ApiExplorer } from './components/ApiExplorer'
import { TracesPage, TraceDetail } from './components/TracesPage'
import { LogsPage } from './components/LogsPage'
import { EventsPage } from './components/EventsPage'
import { ServicesPage } from './components/ServicesPage'
import { DatabasePage } from './components/DatabasePage'
import { useTrace, useVisionConnection } from './hooks/useVision'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/toast'
import './index.css'

const queryClient = new QueryClient()

function ConnectionGate({ children }: { children: React.ReactNode }) {
  const { connected, error } = useVisionConnection()
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Connection Error</h1>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    )
  }
  if (!connected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to Vision Dashboard...</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

function TraceDetailRoute() {
  const { traceId } = useParams<{ traceId: string }>()
  const { data } = useTrace(traceId || '')
  if (!data) return <div className="text-gray-500">Loading trace...</div>
  return <TraceDetail trace={data} />
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

function AppContent() {
  const { toasts, removeToast } = useToast()

  return (
    <>
      <BrowserRouter>
        <ConnectionGate>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/api-explorer" replace />} />
              <Route path="api-explorer" element={<ApiExplorer />} />
              <Route path="traces" element={<TracesPage />}>
                <Route path=":traceId" element={<TraceDetailRoute />} />
              </Route>
              <Route path="logs" element={<LogsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="database" element={<DatabasePage />} />
            </Route>
          </Routes>
        </ConnectionGate>
      </BrowserRouter>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
