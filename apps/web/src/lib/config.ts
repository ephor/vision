declare global {
  interface Window {
    VISION_CONFIG?: {
      apiUrl?: string
    }
  }
}

export function getBackendUrl(): string {
  // 1. Check for injected config from server (preferred)
  if (window.VISION_CONFIG?.apiUrl) {
    return window.VISION_CONFIG.apiUrl;
  }

  // 2. Auto-detect based on current location (fallback)
  const protocol = window.location.protocol;
  const host = window.location.host || 'localhost:4000';
  return `${protocol}//${host}`;
}
