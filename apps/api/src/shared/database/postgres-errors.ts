import type { PostgrestError } from '@supabase/supabase-js';

/** Unique violation on a given constraint or index (Postgres 23505). */
export function isUniqueViolation(error: PostgrestError | null, constraint: string): boolean {
  return error?.code === '23505' && `${error.message} ${error.details}`.includes(constraint);
}

/** Exception raised by a svc_* function with `raise exception '<code>'`. */
export function raisedCode(error: PostgrestError | null): string | null {
  return error?.code === 'P0001' ? error.message : null;
}

/** Throws the unexpected database errors; callers handle the expected ones first. */
export function assertNoError(error: PostgrestError | null): void {
  if (error) throw new Error(`Database error ${error.code}`);
}
