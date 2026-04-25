---
"@getvision/server": patch
---

Prevent buffering streaming responses in onAfterHandle hookAdded detection for streaming responses (SSE, NDJSON, AI SDK streams) via content-type headers and ReadableStream body checks. Record `<stream>` placeholder in trace instead of cloning and awaiting response body, which would block chunk flush to client until generation completes.
