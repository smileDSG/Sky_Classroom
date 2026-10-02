'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from '@/lib/hooks/use-theme';
import { HeaderControls } from '@/components/sky/home/header-controls';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { SkySidebar } from './sidebar-nav';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { BackgroundTasksIndicator } from './background-tasks-indicator';
import { useOptionalAuth } from '@/components/auth/auth-provider';
import { useStudyTimer } from '@/lib/hooks/use-study-timer';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/shell/mobile-sky-shell';
import { getSkySection, SECTION_META, SkySectionNav, type SkySection } from './sky-section-nav';
import { fetchLearningStats } from '@/lib/client/learning-stats';

const SettingsDialog = dynamic(
  () => import('@/components/settings').then((module) => module.SettingsDialog),
  { ssr: false },
);
const UpgradeDialog = dynamic(
  () => import('@/components/billing/upgrade-dialog').then((module) => module.UpgradeDialog),
  { ssr: false },
);

interface SkyAppShellProps {
  children: React.ReactNode;
  section?: SkySection;
  fullBleed?: boolean;
}

/**
 * Atmospheric background — soft watercolor washes and drifting light.
 *
 * Uses a mount-gate pattern to prevent SSR hydration mismatch:
 * - SSR renders null (no HTML at all)
 * - Client hydration also renders null → perfect match
 * - After mount, renders real background with correct theme
 */
function AtmosphericBackground() {
  const { resolvedTheme, isMounted } = useTheme();

  // During SSR and hydration: return null → no mismatch
  if (!isMounted) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Base tone — bright daylight wash, one clean gradient (no halo stacking) */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'linear-gradient(165deg, #0b1222 0%, #101a30 55%, #0b1423 100%)'
            : 'linear-gradient(180deg, #f2f8ff 0%, #f7fbfe 55%, #f1f7fd 100%)',
        }}
      />

      {/* Light starfield only as a faint brand accent — no nebula, no grid, no parallax */}
      <div className="absolute inset-0">
        <CelestialCanvas
          starCount={isDark ? 40 : 26}
          parallax={false}
          nebula={false}
          grid={false}
        />
      </div>

      {/* Single soft ambient highlight, kept subtle & light-mode centric */}
      {isDark ? (
        <div className="absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-sky-500/[0.06] blur-[90px]" />
      ) : (
        <div className="absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-sky-400/[0.10] blur-[90px]" />
      )}
    </div>
  );
}

function DesktopSkyShell({ children, fullBleed = false }: SkyAppShellProps) {
  const { user, refresh } = useOptionalAuth();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Track real study time when user is logged in
  useStudyTimer(!!user);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check today's check-in status
  useEffect(() => {
    if (!user) return;

    fetchLearningStats()
      .then((data) => {
        setCheckedIn(data.checkedInToday || false);
        setStreakDays(data.streakDays || 0);
      })
      .catch(() => {});
  }, [user]);

  const handleCheckIn = useCallback(async () => {
    if (!user || checkedIn || checkingIn) return;

    setCheckingIn(true);
    try {
      const res = await fetch('/api/sky/check-in', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();

      if (data?.success) {
        setCheckedIn(true);
        setStreakDays(data.streakDays || 0);
      }
    } catch {
      /* ignore */
    } finally {
      setCheckingIn(false);
    }
  }, [user, checkedIn, checkingIn]);

  const workspace = SECTION_META[getSkySection(pathname)];

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip">
      <AtmosphericBackground />
      <SkySidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />

      <div
        className={`ml-[248px] flex min-h-dvh min-w-0 flex-col ${
          sidebarCollapsed ? 'ml-[72px]' : ''
        }`}
      >
        <header
          className={`sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 px-5 transition-all duration-500 xl:px-8 ${
            scrolled
              ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl shadow-[0_1px_20px_-8px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_20px_-8px_rgba(0,0,0,0.2)] border-b border-slate-200/40 dark:border-slate-700/20'
              : 'bg-transparent'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-8 w-1 rounded-full bg-sky-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {workspace.label}
              </p>
              <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block">
                {workspace.description}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 md:gap-3">
            {/* Check-in Button - Only show when logged in and not checked in */}
            {user && !checkedIn && (
              <Button
                size="sm"
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="hidden lg:flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25"
              >
                <CheckCircle2 className="h-4 w-4" />
                {checkingIn ? '打卡中...' : '今日打卡'}
              </Button>
            )}
            {user && checkedIn && (
              <div className="hidden md:flex items-center gap-1.5 text-sm text-rose-500 font-medium">
                <Sparkles className="h-4 w-4" />
                <span>{streakDays > 0 ? `${streakDays} 天` : '已打卡'}</span>
              </div>
            )}
            <HeaderControls />
            <div className="hidden h-5 w-px bg-slate-200/60 dark:bg-slate-700/40 sm:block" />
            <FloatingUserCard onUpgradeOpen={() => setUpgradeOpen(true)} />
          </div>
        </header>

        <main
          data-sky-desktop-main
          className={
            fullBleed ? 'min-w-0 flex-1' : 'min-w-0 flex-1 px-4 py-5 md:px-5 md:py-7'
          }
        >
          {children}
        </main>
      </div>

      <BackgroundTasksIndicator />
      {settingsOpen && <SettingsDialog open onOpenChange={setSettingsOpen} />}
      {upgradeOpen && (
        <UpgradeDialog
          open
          onClose={() => setUpgradeOpen(false)}
          currentPlan={user?.planType ?? 'free'}
          onPlanChanged={refresh}
        />
      )}
    </div>
  );
}

export function SkyAppShell({ children, section, fullBleed = false }: SkyAppShellProps) {
  return (
    <>
      <div className="hidden md:block">
        <DesktopSkyShell fullBleed={fullBleed}>{children}</DesktopSkyShell>
      </div>
      <div className="md:hidden">
        <MobileSkyShell>
          {section && (
            <div className="px-4 pt-4">
              <SkySectionNav section={section} />
            </div>
          )}
          {children}
        </MobileSkyShell>
      </div>
    </>
  );
}
