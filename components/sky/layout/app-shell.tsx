'use client';

import { SkyTabBar } from './sky-tab-bar';
import { AssistantFab } from '@/components/sky/assistant/assistant-fab';

interface SkyAppShellProps {
  children: React.ReactNode;
}

export function SkyAppShell({ children }: SkyAppShellProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-[#F8FAFC]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">☁️</span>
          <h1 className="text-lg font-bold text-[#4A90D9]">天空课堂</h1>
        </div>

        <SkyTabBar />

        <div className="flex items-center gap-3">
          <button
            className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="切换主题"
          >
            🌙
          </button>
          <div className="h-8 w-8 rounded-full bg-[#4A90D9]/20 flex items-center justify-center text-sm text-[#4A90D9] font-semibold">
            👤
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">{children}</main>

      {/* Global AI assistant floating ball — visible on all sky pages */}
      <AssistantFab />
    </div>
  );
}
