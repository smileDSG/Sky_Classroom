'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';

export function sanitizeInternalRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/sky';
  return value;
}

export function OnboardingGate() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    if (isLoading || !user) return;
    if (user.role !== 'user') return;
    if (user.onboardingStatus !== 'pending') return;
    if (pathname.startsWith('/auth/') || pathname === '/sky/onboarding') return;

    const decodedQuery = query ? decodeURIComponent(query) : '';
    const currentUrl = sanitizeInternalRedirect(
      `${pathname}${decodedQuery ? `?${decodedQuery}` : ''}`,
    );
    router.replace(`/sky/onboarding?redirect=${encodeURIComponent(currentUrl)}`);
  }, [isLoading, pathname, query, router, user]);

  return null;
}
