import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'degraded', 'down']);

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
