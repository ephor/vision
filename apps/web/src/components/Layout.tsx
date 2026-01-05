import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAppStatus, useEvents } from '../hooks/useVision'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

export function Layout() {
  const { data: status } = useAppStatus()
  const { data: events } = useEvents()

  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('vision.theme') as 'light' | 'dark') || 'light')
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
    localStorage.setItem('vision.theme', theme)
  }, [theme])

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top Navigation */}
      <nav className="bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">{status?.name || 'Vision Dashboard'}</span>
            <Badge 
              variant={status?.running ? "default" : "secondary"}
              className={status?.running ? "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700" : ""}
            >
              {status?.running ? 'Running' : 'Stopped'}
            </Badge>
          </div>
          
          <Separator orientation="vertical" className="h-6 bg-border" />
          
          <div className="flex gap-1">
            <NavLink
              to="/api-explorer"
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isActive ? 'bg-white text-black' : 'text-gray-400 hover:text-foreground/90 hover:bg-accent'
                }`
              }
            >
              API Explorer
            </NavLink>
            <NavLink
              to="/traces"
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isActive ? 'bg-white text-black' : 'text-gray-400 hover:text-foreground/90 hover:bg-accent'
                }`
              }
            >
              Traces
            </NavLink>
            <NavLink
              to="/logs"
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isActive ? 'bg-white text-black' : 'text-gray-400 hover:text-foreground/90 hover:bg-accent'
                }`
              }
            >
              Logs
            </NavLink>
            {Boolean(events && events.length > 0) && (
              <NavLink
                to="/events"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    isActive ? 'bg-white text-black' : 'text-gray-400 hover:text-foreground/90 hover:bg-accent'
                  }`
                }
              >
                Events
              </NavLink>
            )}
            <NavLink
              to="/services"
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isActive ? 'bg-white text-black' : 'text-gray-400 hover:text-foreground/90 hover:bg-accent'
                }`
              }
            >
              Services
            </NavLink>
            {status?.metadata?.drizzle?.detected && (
              <NavLink
                to="/database"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    isActive ? 'bg-white text-black' : 'text-gray-400 hover:text-foreground/90 hover:bg-accent'
                  }`
                }
              >
                Database
              </NavLink>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-gray-400 hover:text-foreground/90 hover:bg-accent"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="ml-2 text-sm font-medium hidden sm:inline">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </span>
        </Button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
