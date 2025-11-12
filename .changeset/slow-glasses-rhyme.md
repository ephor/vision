---
"@getvision/adapter-express": patch
"@getvision/adapter-fastify": patch
"@getvision/adapter-hono": patch
"@getvision/server": patch
---

Expose `apiUrl` in adapter and server options and pass it to VisionCore so the dashboard can target the backend API.
