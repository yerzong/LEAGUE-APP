import { describe, expect, it } from 'vitest';

import { FakeEmailAdapter } from './fake-email-adapter.js';
import { emailHtml } from './layout.js';
import { EmailError } from './ports.js';
import { ResendEmailAdapter } from './resend-email-adapter.js';

const message = {
  to: 'ana@example.com',
  subject: 'Inscripción aprobada',
  text: 'Hola',
  html: '<p>Hola</p>',
  idempotencyKey: 'delivery-1',
};

function fakeFetch(status: number, body?: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
    );
  };
  return { fetchFn, calls };
}

describe('ResendEmailAdapter', () => {
  it('posts the message with the key in a header and returns the provider id', async () => {
    const { fetchFn, calls } = fakeFetch(200, { id: 're_123' });
    const adapter = new ResendEmailAdapter({
      apiKey: 're_secret',
      from: 'Liga <no-reply@example.com>',
      fetch: fetchFn,
    });

    await expect(adapter.send(message)).resolves.toEqual({ providerMessageId: 're_123' });
    const [call] = calls;
    expect(call?.url).toBe('https://api.resend.com/emails');
    const headers = new Headers(call?.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer re_secret');
    expect(headers.get('idempotency-key')).toBe('delivery-1');
    expect(JSON.parse(call?.init?.body as string)).toEqual({
      from: 'Liga <no-reply@example.com>',
      to: ['ana@example.com'],
      subject: 'Inscripción aprobada',
      text: 'Hola',
      html: '<p>Hola</p>',
    });
  });

  it.each([
    [429, 'rate_limited', true],
    [401, 'unauthorized', true],
    [422, 'rejected', false],
    [500, 'unavailable', true],
  ] as const)('maps HTTP %i to %s (retryable: %s)', async (status, kind, retryable) => {
    const adapter = new ResendEmailAdapter({
      apiKey: 're_secret',
      from: 'x <a@b.c>',
      fetch: fakeFetch(status).fetchFn,
    });
    const error = await adapter.send(message).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailError);
    expect((error as EmailError).kind).toBe(kind);
    expect((error as EmailError).retryable).toBe(retryable);
    expect(String(error)).not.toContain('re_secret');
  });

  it('reports a network failure as unavailable', async () => {
    const adapter = new ResendEmailAdapter({
      apiKey: 'k',
      from: 'x <a@b.c>',
      fetch: () => Promise.reject(new Error('offline')),
    });
    await expect(adapter.send(message)).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('FakeEmailAdapter', () => {
  it('captures the messages, once per idempotency key', async () => {
    const fake = new FakeEmailAdapter();
    await fake.send(message);
    await fake.send(message);
    await fake.send({ ...message, idempotencyKey: 'delivery-2' });
    expect(fake.sent.map((m) => m.idempotencyKey)).toEqual(['delivery-1', 'delivery-2']);
  });

  it('fails on demand', async () => {
    const fake = new FakeEmailAdapter();
    fake.failNext(new EmailError('unavailable', 503));
    await expect(fake.send(message)).rejects.toBeInstanceOf(EmailError);
    await expect(fake.send(message)).resolves.toBeTruthy();
  });
});

describe('emailHtml', () => {
  it('escapes the content and turns paragraphs and line breaks into HTML', () => {
    const html = emailHtml({
      title: 'Hola <b>',
      body: 'Equipo <script>\nsegunda línea\n\nOtro párrafo',
      action: { label: 'Ver', url: 'https://liga.example/app?a=1&b="2"' },
      footer: 'Pie',
    });
    expect(html).toContain('<title>Hola &lt;b&gt;</title>');
    expect(html).toContain('<p>Equipo &lt;script&gt;<br>segunda línea</p><p>Otro párrafo</p>');
    expect(html).toContain('href="https://liga.example/app?a=1&amp;b=&quot;2&quot;"');
    expect(html).not.toContain('<script>');
  });
});
