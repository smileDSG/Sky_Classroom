'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MobileClassroomShellProps {
  title?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
}

export function MobileClassroomShell({ title, hideHeader, children }: MobileClassroomShellProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#020817] text-slate-100">
      {!hideHeader && (
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-[#020817]/90 px-4 py-3 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => router.push('/m/sky')}
            className="flex size-11 items-center justify-center rounded-full text-slate-200 transition-colors active:bg-white/10"
            aria-label="返回"
          >
            <ArrowLeft className="size-5" />
          </button>
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-white">{title}</h1>
          ) : null}
        </header>
      )}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
