/**
 * OTLP requires a 16-byte trace id and 8-byte span id. Following the OpenTelemetry
 * SDKs, we mint them as cryptographically-random ids rather than deriving them from
 * Vision's nanoid — the transform keeps a per-trace `visionId → otlpId` map so
 * parent/child references stay consistent within a batch.
 *
 * Randomness comes from the standard Web Crypto API (`globalThis.crypto`), which is
 * available in Bun, Node 18+, and edge runtimes — no runtime-specific import.
 */

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(buffer)
  let hex = ''
  for (const byte of buffer) hex += byte.toString(16).padStart(2, '0')
  return hex
}

/** New random 16-byte (32 hex char) OTLP trace id. */
export function newTraceId(): string {
  return randomHex(16)
}

/** New random 8-byte (16 hex char) OTLP span id. */
export function newSpanId(): string {
  return randomHex(8)
}
