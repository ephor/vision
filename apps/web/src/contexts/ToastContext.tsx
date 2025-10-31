import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Toast } from '../components/ui/toast'

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type?: Toast['type'], duration?: number) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', duration?: number) => {
    const id = Math.random().toString(36).slice(2)
    const toast: Toast = { id, message, type, duration }
    setToasts(prev => [...prev, toast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
