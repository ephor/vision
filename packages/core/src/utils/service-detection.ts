import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'

/**
 * Package info detected from package.json
 */
export interface PackageInfo {
  name: string
  version: string
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  database?: string
  redis?: string
  [key: string]: string | undefined
}

/**
 * Drizzle detection result
 */
export interface DrizzleInfo {
  detected: boolean
  configPath?: string
}

/**
 * Auto-detect package.json for service name and version
 */
export function autoDetectPackageInfo(): PackageInfo {
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return {
        name: pkg.name || 'unknown',
        version: pkg.version || '0.0.0',
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return { name: 'unknown', version: '0.0.0' }
}

/**
 * Auto-detect integrations from environment variables
 */
export function autoDetectIntegrations(): IntegrationConfig {
  const integrations: IntegrationConfig = {}

  // Common database env vars
  const dbKeys = ['DATABASE_URL', 'DB_URL', 'POSTGRES_URL', 'MYSQL_URL', 'MONGODB_URL']
  for (const key of dbKeys) {
    if (process.env[key]) {
      integrations.database = process.env[key]!
      break
    }
  }

  // Common redis env vars
  const redisKeys = ['REDIS_URL', 'CACHE_URL', 'UPSTASH_REDIS_URL']
  for (const key of redisKeys) {
    if (process.env[key]) {
      integrations.redis = process.env[key]!
      break
    }
  }

  return integrations
}

/**
 * Detect Drizzle configuration
 */
export function detectDrizzle(): DrizzleInfo {
  const possiblePaths = [
    'drizzle.config.ts',
    'drizzle.config.js',
    'drizzle.config.mjs',
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return { detected: true, configPath: path }
    }
  }

  return { detected: false }
}

let drizzleStudioProcess: ChildProcess | null = null

/**
 * Start Drizzle Studio
 */
export function startDrizzleStudio(port: number = 4983): boolean {
  const drizzleInfo = detectDrizzle()

  if (!drizzleInfo.detected) {
    console.warn('⚠️  Drizzle config not found. Skipping Drizzle Studio auto-start.')
    return false
  }

  console.log(`🗄️  Starting Drizzle Studio on port ${port}...`)

  try {
    drizzleStudioProcess = spawn('npx', ['drizzle-kit', 'studio', '--port', String(port), '--host', '0.0.0.0'], {
      stdio: 'inherit',
      detached: false,
    })

    drizzleStudioProcess.on('error', (error) => {
      console.error('❌ Failed to start Drizzle Studio:', error.message)
    })

    drizzleStudioProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ Drizzle Studio exited with code ${code}`)
      }
    })

    console.log(`✅ Drizzle Studio started`)
    return true
  } catch (error) {
    console.error('❌ Failed to start Drizzle Studio:', error)
    return false
  }
}

/**
 * Stop Drizzle Studio
 */
export function stopDrizzleStudio(): void {
  if (drizzleStudioProcess) {
    drizzleStudioProcess.kill()
    drizzleStudioProcess = null
    console.log('🛑 Drizzle Studio stopped')
  }
}
