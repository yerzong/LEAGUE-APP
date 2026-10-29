import { describe, expect, it } from 'vitest';

import {
  DeliveryQuerySchema,
  InboxQuerySchema,
  PreviewTemplateRequestSchema,
  UpdatePreferencesRequestSchema,
  UpdateRuleRequestSchema,
} from './notifications.js';

describe('notification contracts', () => {
  it('pages the inbox with defaults', () => {
    expect(InboxQuerySchema.parse({})).toEqual({ limit: 20, unread: false });
    expect(InboxQuerySchema.parse({ limit: '5', unread: 'true' })).toEqual({
      limit: 5,
      unread: true,
    });
    expect(InboxQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('accepts preference changes by category and channel only', () => {
    expect(
      UpdatePreferencesRequestSchema.safeParse({
        items: [{ category: 'matches', channel: 'email', enabled: false }],
      }).success,
    ).toBe(true);
    expect(
      UpdatePreferencesRequestSchema.safeParse({
        items: [{ category: 'matches', channel: 'sms', enabled: false }],
      }).success,
    ).toBe(false);
    expect(UpdatePreferencesRequestSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('needs at least one channel in a rule', () => {
    expect(UpdateRuleRequestSchema.safeParse({ enabled: true, channels: [] }).success).toBe(false);
  });

  it('trims template text and rejects an empty body', () => {
    const parsed = PreviewTemplateRequestSchema.parse({
      typeKey: 'registration.approved',
      channel: 'email',
      subject: '  Hola  ',
      body: ' {{entrant.name}} ',
    });
    expect(parsed.subject).toBe('Hola');
    expect(PreviewTemplateRequestSchema.safeParse({ ...parsed, body: '   ' }).success).toBe(false);
  });

  it('filters the delivery history by known statuses and channels', () => {
    expect(DeliveryQuerySchema.parse({ status: 'failed' })).toEqual({ status: 'failed' });
    expect(DeliveryQuerySchema.safeParse({ status: 'lost' }).success).toBe(false);
  });
});
