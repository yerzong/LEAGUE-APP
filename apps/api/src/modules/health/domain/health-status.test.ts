import { describe, expect, it } from 'vitest';

import { resolveHealthStatus } from './health-status.js';

const up = { name: 'a', healthy: true };
const failing = { name: 'b', healthy: false };

describe('resolveHealthStatus', () => {
  it('is ok when there are no checks', () => {
    expect(resolveHealthStatus([])).toBe('ok');
  });

  it('is ok when every check is healthy', () => {
    expect(resolveHealthStatus([up, up])).toBe('ok');
  });

  it('is degraded when only some checks fail', () => {
    expect(resolveHealthStatus([up, failing])).toBe('degraded');
  });

  it('is down when every check fails', () => {
    expect(resolveHealthStatus([failing, failing])).toBe('down');
  });
});
