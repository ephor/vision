# Vision Web App

## Configuring Backend URL

The web app uses a priority-based configuration system for determining the backend URL:

### 1. Server-injected Configuration (Recommended)

When using Vision as a library, the backend URL is automatically injected by the server:

```typescript
import { VisionCore } from '@getvision/core'

const vision = new VisionCore({
  port: 9500,
  apiUrl: 'http://localhost:3000'  // Your API server URL
})
```

The dashboard will automatically use this URL for API calls.
