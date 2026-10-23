import { describe, expect, it } from 'vitest';

import { getApiHealth } from './get-api-health';

const respond =
  (body: unknown, status = 200): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

const healthy = { status: 'ok', version: '0.0.0', timestamp: '2026-01-01T00:00:00.000Z' };

describe('getApiHealth', () => {
  it('returns the status reported by the API', async () => {
    await expect(getApiHealth('http://api', respond(healthy))).resolves.toBe('ok');
  });

  it('is unreachable on an HTTP error', async () => {
    await expect(getApiHealth('http://api', respond(healthy, 500))).resolves.toBe('unreachable');
  });

  it('is unreachable when the body breaks the contract', async () => {
    await expect(getApiHealth('http://api', respond({ status: 'fine' }))).resolves.toBe(
      'unreachable',
    );
  });

  it('is unreachable when the request fails', async () => {
    const failing: typeof fetch = () => Promise.reject(new Error('ECONNREFUSED'));
    await expect(getApiHealth('http://api', failing)).resolves.toBe('unreachable');
  });
});
