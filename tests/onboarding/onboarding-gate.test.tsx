import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { AuthUser } from '@/components/auth/auth-provider';

const navigation = vi.hoisted(() => ({
  pathname: '/sky/cloud-mind/quiz',
  search: 'topic=%E5%87%BD%E6%95%B0',
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/components/auth/auth-provider';
import { OnboardingGate, sanitizeInternalRedirect } from '@/components/auth/onboarding-gate';

const mockUseAuth = vi.mocked(useAuth);

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'student@example.com',
    username: 'student',
    role: 'user',
    status: 'active',
    planType: 'free',
    emailVerified: true,
    createdAt: 1,
    onboardingStatus: 'pending',
    ...overrides,
  };
}

beforeEach(() => {
  navigation.pathname = '/sky/cloud-mind/quiz';
  navigation.search = 'topic=%E5%87%BD%E6%95%B0';
  navigation.replace.mockReset();
  mockUseAuth.mockReturnValue({
    user: user(),
    isLoading: false,
  } as ReturnType<typeof useAuth>);
});

describe('OnboardingGate', () => {
  it('preserves the current internal URL for a pending ordinary user', async () => {
    render(<OnboardingGate />);

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        '/sky/onboarding?redirect=%2Fsky%2Fcloud-mind%2Fquiz%3Ftopic%3D%E5%87%BD%E6%95%B0',
      ),
    );
  });

  it.each([
    ['completed user', user({ onboardingStatus: 'completed' })],
    ['skipped user', user({ onboardingStatus: 'skipped' })],
    ['guest', null],
    ['admin', user({ role: 'admin' })],
  ])('does not redirect a %s', async (_label, currentUser) => {
    mockUseAuth.mockReturnValue({
      user: currentUser,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    render(<OnboardingGate />);

    await waitFor(() => expect(navigation.replace).not.toHaveBeenCalled());
  });

  it.each(['/auth/login', '/auth/register', '/sky/onboarding'])(
    'does not redirect from %s',
    async (pathname) => {
      navigation.pathname = pathname;

      render(<OnboardingGate />);

      await waitFor(() => expect(navigation.replace).not.toHaveBeenCalled());
    },
  );

  it('rejects protocol-relative redirects', () => {
    expect(sanitizeInternalRedirect('//example.com')).toBe('/sky');
    expect(sanitizeInternalRedirect('/sky/learning')).toBe('/sky/learning');
  });
});
