'use client';

import { SkyTabBar } from './sky-tab-bar';
import Link from 'next/link';

interface SkyAppShellProps {
  children: React.ReactNode;
}

export function SkyAppShell({ children }: SkyAppShellProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-[#F8FAFC]">
      <header className="grid h-14 shrink-0 grid-cols-3 items-center border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-xl">☁️</span>
            <h1 className="text-lg font-bold text-[#8B5CF6]">天空课堂</h1>
          </Link>
        </div>

        <div className="flex justify-center">
          <SkyTabBar />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="切换主题"
          >
            🌙
          </button>
          <div className="h-8 w-8 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center text-sm text-[#8B5CF6] font-semibold">
            👤
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
