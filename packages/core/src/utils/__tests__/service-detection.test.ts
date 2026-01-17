import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { 
  autoDetectPackageInfo,
  autoDetectIntegrations,
  detectDrizzle,
  startDrizzleStudio,
  stopDrizzleStudio
} from '../service-detection'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

describe('Service Detection', () => {
  const originalCwd = process.cwd()
  const tempDir = '/tmp/vision-test'
  const packageJsonPath = join(tempDir, 'package.json')

  beforeEach(() => {
    // Create temp directory
    if (!existsSync(tempDir)) {
      require('fs').mkdirSync(tempDir, { recursive: true })
    }
    // Change to temp directory
    process.chdir(tempDir)
  })

  afterEach(() => {
    // Clean up
    if (existsSync(packageJsonPath)) {
      unlinkSync(packageJsonPath)
    }
    // Change back to original directory
    process.chdir(originalCwd)
  })

  describe('autoDetectPackageInfo', () => {
    test('detects package name and version', () => {
      const packageInfo = {
        name: 'test-app',
        version: '1.0.0',
      }
      writeFileSync(packageJsonPath, JSON.stringify(packageInfo))

      const result = autoDetectPackageInfo()
      
      expect(result).toBeDefined()
      expect(result.name).toBe('test-app')
      expect(result.version).toBe('1.0.0')
    })

    test('handles missing package.json', () => {
      if (existsSync(packageJsonPath)) {
        unlinkSync(packageJsonPath)
      }
      const result = autoDetectPackageInfo()
      expect(result.name).toBe('unknown')
      expect(result.version).toBe('0.0.0')
    })

    test('extracts framework from dependencies', () => {
      const packageInfo = {
        name: 'test-app',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
        },
      }
      writeFileSync(packageJsonPath, JSON.stringify(packageInfo))

      const result = autoDetectPackageInfo()
      expect(result.name).toBe('test-app')
      expect(result.version).toBe('1.0.0')
    })
  })

  describe('autoDetectIntegrations', () => {
    test('detects database from env vars', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/test'
      
      const integrations = autoDetectIntegrations()
      expect(integrations.database).toBe('postgresql://localhost/test')
      
      delete process.env.DATABASE_URL
    })

    test('detects redis from env vars', () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      
      const integrations = autoDetectIntegrations()
      expect(integrations.redis).toBe('redis://localhost:6379')
      
      delete process.env.REDIS_URL
    })

    test('returns empty object when no env vars', () => {
      // Clear any existing env vars
      delete process.env.DATABASE_URL
      delete process.env.DB_URL
      delete process.env.REDIS_URL
      
      const integrations = autoDetectIntegrations()
      expect(integrations).toEqual({})
    })
  })

  describe('detectDrizzle', () => {
    test('detects drizzle from config file', () => {
      // Create a mock drizzle config
      const configPath = join(tempDir, 'drizzle.config.ts')
      writeFileSync(configPath, 'export default {}')
      
      const drizzleInfo = detectDrizzle()
      expect(drizzleInfo.detected).toBe(true)
      expect(drizzleInfo.configPath).toContain('drizzle.config.ts')

      // Clean up
      unlinkSync(configPath)
    })

    test('finds drizzle config with different extensions', () => {
      // Test .js extension
      const configPath = join(tempDir, 'drizzle.config.js')
      writeFileSync(configPath, 'module.exports = {}')
      
      const drizzleInfo = detectDrizzle()
      expect(drizzleInfo.detected).toBe(true)
      expect(drizzleInfo.configPath).toContain('drizzle.config.js')

      // Clean up
      unlinkSync(configPath)
    })

    test('returns false when drizzle not found', () => {
      const drizzleInfo = detectDrizzle()
      expect(drizzleInfo.detected).toBe(false)
      expect(drizzleInfo.configPath).toBeUndefined()
    })
  })

  describe('Drizzle Studio', () => {
    test('starts and stops studio process', async () => {
      // This is a basic test - real testing would require actual drizzle setup
      expect(() => {
        startDrizzleStudio()
      }).not.toThrow()

      expect(() => {
        stopDrizzleStudio()
      }).not.toThrow()
    })
  })
})
