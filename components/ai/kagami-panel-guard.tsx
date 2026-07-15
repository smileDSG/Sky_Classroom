'use client';

import { usePathname } from 'next/navigation';
import { KagamiPanel } from './kagami-panel';

export function KagamiPanelGuard() {
  const pathname = usePathname();
  if (pathname?.startsWith('/m/')) return null;
  return <KagamiPanel />;
}
