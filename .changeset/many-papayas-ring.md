---
"@getvision/server": patch
---

Add event handler context

Event handlers receive a Hono-like `Context` as the second argument. You can run service-level middleware to inject resources using `c.set(...)` and then access them in the handler via `c.get(...)`.
