'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileSkyShellProps {
  children: ReactNode;
  fullBleed?: boolean;
}

export function MobileContentShell({ children, fullBleed = false }: MobileSkyShellProps) {
  return (
    <main
      className={cn(
        'w-full pb-[calc(env(safe-area-inset-bottom)+5rem)]',
        !fullBleed && ['px-4 pt-4', 'space-y-4'],
        fullBleed && 'pt-0',
      )}
    >
      {children}
    </main>
  );
}

export function MobileSkyShell({ children, fullBleed = false }: MobileSkyShellProps) {
  return <MobileContentShell fullBleed={fullBleed}>{children}</MobileContentShell>;
}
