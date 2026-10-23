import { describe, expect, it } from 'vitest';

import { decideZoneAccess, loginPath, protectedZoneOf, safeNextPath } from './access';

describe('protectedZoneOf', () => {
  it('maps the portal and admin prefixes', () => {
    expect(protectedZoneOf('/app')).toBe('portal');
    expect(protectedZoneOf('/app/teams')).toBe('portal');
    expect(protectedZoneOf('/admin/users')).toBe('admin');
  });

  it('ignores public paths, including look-alike prefixes', () => {
    expect(protectedZoneOf('/')).toBeNull();
    expect(protectedZoneOf('/login')).toBeNull();
    expect(protectedZoneOf('/application')).toBeNull();
    expect(protectedZoneOf('/administrators')).toBeNull();
  });
});

describe('decideZoneAccess', () => {
  const anonymous = { authenticated: false, isSuperAdmin: false };
  const player = { authenticated: true, isSuperAdmin: false };
  const superAdmin = { authenticated: true, isSuperAdmin: true };

  it('sends users without a session to login', () => {
    expect(decideZoneAccess('portal', anonymous)).toBe('login');
    expect(decideZoneAccess('admin', anonymous)).toBe('login');
  });

  it('lets any signed-in user into the portal', () => {
    expect(decideZoneAccess('portal', player)).toBe('allow');
  });

  it('keeps regular users out of admin', () => {
    expect(decideZoneAccess('admin', player)).toBe('forbidden');
    expect(decideZoneAccess('admin', superAdmin)).toBe('allow');
  });
});

describe('safeNextPath', () => {
  it('keeps same-site paths', () => {
    expect(safeNextPath('/admin?tab=users')).toBe('/admin?tab=users');
  });

  it('rejects external and protocol-relative targets', () => {
    expect(safeNextPath('https://evil.test')).toBe('/app');
    expect(safeNextPath('//evil.test')).toBe('/app');
    expect(safeNextPath('/\\evil.test')).toBe('/app');
    expect(safeNextPath(null)).toBe('/app');
  });
});

describe('loginPath', () => {
  it('encodes the destination', () => {
    expect(loginPath('/admin?tab=a&b=c')).toBe('/login?next=%2Fadmin%3Ftab%3Da%26b%3Dc');
  });
});
