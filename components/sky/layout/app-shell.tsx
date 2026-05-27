'use client';

import { useState } from 'react';
import { HeaderControls } from '@/components/sky/home/header-controls';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { SettingsDialog } from '@/components/settings';
import { UpgradeDialog } from '@/components/billing/upgrade-dialog';
import { SkyTabBar } from './sky-tab-bar';
import Link from 'next/link';

interface SkyAppShellProps {
  children: React.ReactNode;
}

export function SkyAppShell({ children }: SkyAppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="grid h-14 shrink-0 grid-cols-3 items-center border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-xl">☁️</span>
            <h1 className="text-lg font-bold text-[#8B5CF6]">天空课堂</h1>
          </Link>
        </div>

        <div className="flex justify-center">
          <SkyTabBar />
        </div>

        <div className="flex items-center justify-end gap-2">
          <HeaderControls />

          {/* 用户区域 */}
          <FloatingUserCard
            onSettingsOpen={() => setSettingsOpen(true)}
            onUpgradeOpen={() => setUpgradeOpen(true)}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">{children}</main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
