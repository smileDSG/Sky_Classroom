'use client';

import { useState } from 'react';
import { SkyTopBar } from './top-bar';
import { SkySidebar } from './sidebar-nav';
import { AssistantFab } from '@/components/sky/assistant/assistant-fab';

interface SkyAppShellProps {
  children: React.ReactNode;
}

export function SkyAppShell({ children }: SkyAppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col bg-[#F8FAFC]">
      <SkyTopBar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />
      <div className="flex flex-1 overflow-hidden">
        <SkySidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      {/* Global AI assistant floating ball — visible on all sky pages */}
      <AssistantFab />
    </div>
  );
}
