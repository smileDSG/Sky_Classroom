import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingGate, sanitizeInternalRedirect } from '@/components/auth/onboarding-gate';

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => '/sky/cloud-mind/quiz',
  useSearchParams: () => new URLSearchParams('topic=%E5%87%BD%E6%95%B0'),
}));

describe('OnboardingGate', () => {
  it('is a no-op and never redirects (onboarding moved to per-page PageTour)', () => {
    const { container } = render(<OnboardingGate />);
    expect(container.firstChild).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe('sanitizeInternalRedirect', () => {
  it('rejects protocol-relative redirects', () => {
    expect(sanitizeInternalRedirect('//example.com')).toBe('/sky');
  });

  it('rejects empty and non-internal values to a safe default', () => {
    expect(sanitizeInternalRedirect(null)).toBe('/sky');
    expect(sanitizeInternalRedirect('')).toBe('/sky');
    expect(sanitizeInternalRedirect('https://example.com')).toBe('/sky');
  });

  it('keeps valid internal paths intact', () => {
    expect(sanitizeInternalRedirect('/sky/learning')).toBe('/sky/learning');
    expect(sanitizeInternalRedirect('/classroom/new')).toBe('/classroom/new');
  });
});
