import { describe, expect, test } from 'vitest';
import { toMobileHref } from '@/components/mobile/mobile-route-guard';

describe('MobileRouteGuard route mapping', () => {
  test('maps the legacy learning route to the native mobile study lab', () => {
    expect(toMobileHref('/sky/learning')).toBe('/m/sky/study-lab');
  });
});
