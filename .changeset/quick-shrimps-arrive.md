---
"@getvision/server": patch
---

Added full request/response mocking to event context including header manipulation, status codes, and proper Request object initialization. 
Removed premature event registry cleanup during hot-reload to prevent memory issues.
