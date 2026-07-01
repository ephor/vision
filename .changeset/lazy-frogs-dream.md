---
"@getvision/core": minor
"@getvision/server": minor
---

Add OTLP log exporter — all console.* logs captured by ConsoleInterceptor are now
exportable as OTLP LogRecords to any OTLP/HTTP backend (BetterStack, Honeycomb,
Grafana Tempo, OTel Collector).

- core: `LogExporter` interface with `export()`/`shutdown()` contract
- core: `OtlpLogExporter` — buffered OTLP/JSON log exporter (same batching,
  retry, and isolation pattern as `OtlpTraceExporter`)
- core: `VisionServerOptions.exporters` grouped under `{ traces?, logs? }` for a
  single entry point
- core: `ConsoleInterceptor` propagates `traceId` on `LogEntry` for trace-log
  correlation in downstream backends
- server: forward `vision.exporters.logs` into VisionCore; re-export
  `OtlpLogExporter`
