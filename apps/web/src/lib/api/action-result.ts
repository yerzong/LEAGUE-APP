import type { ApiResult } from './server-client';
import { errorMessage } from './errors';

/** What a server action returns to the form: the UI shows `message` in a toast. */
export type ActionResult<T = null> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

export function toActionResult<T>(result: ApiResult<T>): ActionResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, code: result.code, message: errorMessage(result.code) };
}
