---
"@getvision/core": minor
"@getvision/server": minor
---

Add a generic exporter mechanism that fans completed traces out to OTLP/HTTP
backends (BetterStack, Honeycomb, Grafana Tempo, an OTel Collector, …). The
destination is purely endpoint + headers, so one exporter targets any
OTLP-compatible backend.

- core: `TraceExporter` interface + `VisionServerOptions.exporters`; fan-out in
  `completeTrace` (isolated per exporter) and flush on `stop()`
- core: `OtlpTraceExporter` (OTLP/JSON over HTTP) with batching, random
  spec-compliant ids via Web Crypto, and Trace→OTLP transform (synthetic root
  SERVER span + nested INTERNAL spans, logs as span events)
- server: forward `vision.exporters` into VisionCore; re-export OtlpTraceExporter
- docs: README + docs-site config/section; mark OpenTelemetry export shipped
