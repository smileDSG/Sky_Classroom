'use client';

import { usePathname } from 'next/navigation';
import { useOptionalAuth } from '@/components/auth/auth-provider';
import { KagamiPanel } from './kagami-panel';

export function KagamiPanelGuard() {
  const pathname = usePathname();
  const { isGuest } = useOptionalAuth();
  if (pathname?.startsWith('/m/')) return null;
  if (isGuest) return null;
  return <KagamiPanel />;
}
