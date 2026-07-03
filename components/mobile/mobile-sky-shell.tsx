'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileSkyShellProps {
  children: ReactNode;
}

export function MobileSkyShell({ children }: MobileSkyShellProps) {
  return (
    <main className={cn('px-4 pb-6 pt-3', 'space-y-3')}>{children}</main>
  );
}
