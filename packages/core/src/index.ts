export { VisionCore } from './core'
export { VisionWebSocketServer } from './server/index'
export * from './tracing/index'
export * from './validation/index'
export { generateZodTemplate, generateTemplate } from './utils/template-generator'
export {
  autoDetectPackageInfo,
  autoDetectIntegrations,
  detectDrizzle,
  startDrizzleStudio,
  stopDrizzleStudio,
} from './utils/service-detection'
export type { PackageInfo, IntegrationConfig, DrizzleInfo } from './utils/service-detection'
export type * from './types/index'
