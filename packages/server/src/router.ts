import type { Hono } from 'hono'
import { readdirSync, statSync } from 'fs'
import { join, resolve, relative, sep } from 'path'
import { pathToFileURL } from 'url'

/**
 * Autoload Vision/Hono sub-apps from a directory structure like app/routes/.../index.ts
 * Each folder becomes a base path. Dynamic segments [id] are converted to :id.
 *
 * Examples:
 * - app/routes/users/index.ts        -> /users
 * - app/routes/users/[id]/index.ts   -> /users/:id
 * - app/routes/index.ts              -> /
 */
export async function loadSubApps(app: Hono, routesDir: string = './app/routes'): Promise<Array<{ name: string; routes: any[] }>> {
  const mounted: Array<{ base: string }> = []
  const allSubAppSummaries: Array<{ name: string; routes: any[] }> = []

  function toBasePath(dirPath: string): string {
    const rel = relative(resolve(routesDir), resolve(dirPath))
    if (!rel || rel === '' || rel === '.' ) return '/'
    const segments = rel.split(sep).filter(Boolean).map((s) => {
      if (s.startsWith('[') && s.endsWith(']')) return `:${s.slice(1, -1)}`
      return s
    })
    return '/' + segments.join('/')
  }

  async function scan(dir: string) {
    const entries = readdirSync(dir)
    // If folder contains index.ts or index.js, treat it as a sub-app root
    const hasTs = entries.includes('index.ts')
    const hasJs = entries.includes('index.js')
    if (hasTs || hasJs) {
      const indexFile = resolve(dir, hasTs ? 'index.ts' : 'index.js')
      const modUrl = pathToFileURL(indexFile).href
      const mod: any = await import(modUrl)
      const subApp = mod?.default
      if (subApp) {
        const base = toBasePath(dir)
        // If it's a Vision sub-app, build its services before mounting
        try {
          if (typeof (subApp as any)?.service === 'function') {
            await (subApp as any).buildAllServices?.()
            // Collect sub-app services/routes for bulk registration later
            const summaries = (subApp as any).getServiceSummaries?.()
            if (Array.isArray(summaries) && summaries.length > 0) {
              // Prefix all route paths with the base path
              const prefixedSummaries = summaries.map(s => ({
                ...s,
                routes: s.routes.map((r: any) => ({
                  ...r,
                  path: base === '/' ? r.path : base + (r.path === '/' ? '' : r.path)
                }))
              }))
              allSubAppSummaries.push(...prefixedSummaries)
            }
          }
        } catch (e) {
          console.error(`❌ Error preparing sub-app ${dir}:`, (e as any)?.message || e)
        }
        // Mount the sub-app only if it looks like a Hono/Vision instance with routes
        const routes = (subApp as any)?.routes
        if (Array.isArray(routes)) {
          ;(app as any).route(base, subApp)
          mounted.push({ base })
        }
      }
    }
    // Recurse into child directories
    for (const name of entries) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) await scan(full)
    }
  }

  // Only scan if directory exists
  try {
    statSync(routesDir)
  } catch {
    return []
  }

  await scan(routesDir)
  
  // Merge services by name (combine routes from same service name)
  const mergedServices = new Map<string, { name: string; routes: any[] }>()
  for (const summary of allSubAppSummaries) {
    if (mergedServices.has(summary.name)) {
      const existing = mergedServices.get(summary.name)!
      existing.routes.push(...summary.routes)
    } else {
      mergedServices.set(summary.name, { name: summary.name, routes: [...summary.routes] })
    }
  }
  
  // Return merged services (don't register here - let caller handle it)
  return Array.from(mergedServices.values())
}
