import 'server-only';

import { ApiErrorSchema } from '@league/contracts';
import type { z } from 'zod';

import { getServerEnv } from '@/config/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; details?: Record<string, unknown> | undefined };

interface RequestOptions<S extends z.ZodType | undefined> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Multipart uploads (avatar, logo). */
  form?: FormData;
  /** Response contract; omit for 204 responses. */
  schema?: S;
  /** `optional` sends the token when there is a session (public pages). */
  auth?: 'required' | 'optional';
}

async function accessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  // The token was verified by the proxy for this request; the API verifies it again.
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Calls apps/api from the server with the user's access token. Never throws for API errors. */
export async function apiRequest<S extends z.ZodType | undefined = undefined>(
  path: string,
  { method = 'GET', body, form, schema, auth = 'required' }: RequestOptions<S> = {},
): Promise<ApiResult<S extends z.ZodType ? z.infer<S> : null>> {
  type Data = S extends z.ZodType ? z.infer<S> : null;
  const token = await accessToken();
  if (!token && auth === 'required') return { ok: false, status: 401, code: 'unauthorized' };

  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(new URL(path, getServerEnv().API_URL), {
      method,
      headers,
      body: form ?? (body === undefined ? null : JSON.stringify(body)),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 503, code: 'unknown' };
  }

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
    return {
      ok: false,
      status: response.status,
      code: parsed.success ? parsed.data.code : 'unknown',
      details: parsed.success ? parsed.data.details : undefined,
    };
  }
  if (!schema || response.status === 204) return { ok: true, data: null as Data };
  return { ok: true, data: schema.parse(await response.json()) as Data };
}
