export type OtlpCompression = 'gzip' | 'none'

export const DEFAULT_MAX_PAYLOAD_BYTES = 1_000_000

const encoder = new TextEncoder()

export function resolveMaxPayloadBytes(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_MAX_PAYLOAD_BYTES
}

export function jsonByteLength(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength
}

/**
 * Split items into consecutive chunks whose estimated payload stays within
 * `maxBytes`. An item larger than `maxBytes` gets a chunk of its own.
 *
 * @param items Items to split, in order.
 * @param sizeOf Estimated serialized byte size of one item.
 * @param baseBytes Fixed byte size of the payload envelope.
 * @param maxBytes Payload size cap.
 * @returns Non-empty chunks covering every item in order.
 */
export function chunkBySize<T>(
  items: T[],
  sizeOf: (item: T) => number,
  baseBytes: number,
  maxBytes: number
): T[][] {
  const chunks: T[][] = []
  let current: T[] = []
  let currentBytes = baseBytes
  for (const item of items) {
    const size = sizeOf(item)
    if (current.length > 0 && currentBytes + size > maxBytes) {
      chunks.push(current)
      current = []
      currentBytes = baseBytes
    }
    current.push(item)
    currentBytes += size
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

/** Statuses meaning the backend will never accept this payload as-is. */
export function isPayloadRejection(status: number): boolean {
  return status === 413 || status === 400 || status === 422
}

/**
 * POST a JSON body, gzip-compressed when requested and supported by the runtime.
 *
 * @param endpoint OTLP/HTTP endpoint URL.
 * @param headers Request headers.
 * @param json Serialized OTLP payload.
 * @param compression Body encoding.
 * @param timeoutMs Request timeout in ms.
 * @returns The backend response.
 */
export async function postOtlp(
  endpoint: string,
  headers: Record<string, string>,
  json: string,
  compression: OtlpCompression,
  timeoutMs: number
): Promise<Response> {
  const gzipped = compression === 'gzip' ? await gzip(json) : undefined
  return fetch(endpoint, {
    method: 'POST',
    headers: gzipped ? { ...headers, 'content-encoding': 'gzip' } : headers,
    body: gzipped ?? json,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function gzip(text: string): Promise<ArrayBuffer | undefined> {
  const Compression = (
    globalThis as { CompressionStream?: typeof CompressionStream }
  ).CompressionStream
  if (!Compression) return undefined
  const stream = new Blob([text]).stream().pipeThrough(new Compression('gzip'))
  return new Response(stream).arrayBuffer()
}
