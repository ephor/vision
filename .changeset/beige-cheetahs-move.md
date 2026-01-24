---
"@getvision/adapter-express": patch
"@getvision/adapter-fastify": patch
"@getvision/adapter-hono": patch
"@getvision/server": patch
"@getvision/core": patch
"web": patch
---

feat(web): add query parameters support, custom query params, and polished UI

Introduced support for API query parameters in the API Explorer, including the ability to add and manage custom query parameters. Refactored UI components to use a new `Checkbox` component and replaced `Card` with `SectionCard` for better consistency. Enhanced request body handling with JSON5 parsing.
