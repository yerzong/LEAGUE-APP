import type { z } from 'zod';

import { ApplicationError } from './application-error.js';

/** Parses a request body or query; failures list field paths and codes, never values. */
export function validate<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApplicationError('invalid', 'validation_failed', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
      })),
    });
  }
  return result.data;
}
