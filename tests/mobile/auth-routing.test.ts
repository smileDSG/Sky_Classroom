import { describe, expect, test } from 'vitest';
import { getAuthLoginPath, isAuthRoute } from '@/lib/client/fetch-interceptor';

describe('mobile auth routing', () => {
  test('uses the mobile auth route for mobile pages', () => {
    expect(getAuthLoginPath('/m')).toBe('/m/auth/login');
    expect(getAuthLoginPath('/m/sky/cloud-mind')).toBe('/m/auth/login');
  });

  test('keeps desktop pages on the desktop auth route', () => {
    expect(getAuthLoginPath('/')).toBe('/auth/login');
    expect(getAuthLoginPath('/sky/cloud-mind')).toBe('/auth/login');
  });

  test('recognizes desktop and mobile auth routes', () => {
    expect(isAuthRoute('/auth/login')).toBe(true);
    expect(isAuthRoute('/m/auth/login')).toBe(true);
    expect(isAuthRoute('/m/sky/cloud-mind')).toBe(false);
  });
});
