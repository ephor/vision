import type { VisionCore, Trace } from '@getvision/core';

declare module '@fastify/request-context' {
  interface RequestContextData {
    visionTrace: {
      vision: VisionCore;
      trace: Trace;
      traceId: string;
      rootSpanId: string;
    };
  }
}