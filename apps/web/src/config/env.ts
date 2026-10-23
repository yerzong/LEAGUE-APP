import 'server-only';

import { z } from 'zod';

const ServerEnvSchema = z.object({
  API_URL: z.url().default('http://localhost:4000'),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return ServerEnvSchema.parse(source);
}
