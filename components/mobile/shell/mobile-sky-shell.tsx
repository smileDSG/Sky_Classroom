"use client";

import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileTopBar } from "./mobile-top-bar";

interface MobileSkyShellProps {
  children: React.ReactNode;
}

export function MobileSkyShell({ children }: MobileSkyShellProps) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <MobileTopBar />
      <main>{children}</main>
      <MobileBottomNav />
    </div>
  );
}
