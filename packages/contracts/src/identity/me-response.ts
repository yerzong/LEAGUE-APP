import { z } from 'zod';

export const MeResponseSchema = z.object({
  id: z.uuid(),
  email: z.email().nullable(),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
