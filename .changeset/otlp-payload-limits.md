---
"@getvision/core": patch
"@getvision/server": patch
---

Fix OTLP exports getting stuck on oversized payloads and make request errors visible.

- `OtlpTraceExporter` / `OtlpLogExporter`: batches are split so each request stays under the new `maxPayloadBytes` option (default `1_000_000`). A `413`/`400`/`422` response now halves the batch and resends it; a single rejected item is dropped and reported via `onError` instead of being retried forever. `429`, `5xx`, network errors, and timeouts still re-buffer.
- `OtlpTraceExporter` / `OtlpLogExporter`: new `compression: 'gzip' | 'none'` option (default `'none'`). Uses `CompressionStream` and falls back to an uncompressed body where it isn't available.
- `@getvision/server`: captured request bodies are capped at 65536 characters (`'<truncated>'` placeholder), matching the existing response-body cap.
- `@getvision/server`: unhandled request errors are now logged with `console.error`, including method, path, and trace id when available.
