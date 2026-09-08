"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "@/lib/hooks/use-theme";
import { motion } from "motion/react";
import { HeaderControls } from "@/components/sky/home/header-controls";
import { FloatingUserCard } from "@/components/sky/home/floating-user-card";
import { SkySidebar } from "./sidebar-nav";
import { BackgroundTasksIndicator } from "./background-tasks-indicator";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import { useStudyTimer } from "@/lib/hooks/use-study-timer";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { MobileSkyShell } from "@/components/mobile/shell/mobile-sky-shell";
import { SkySectionNav, type SkySection } from "./sky-section-nav";
import { fetchLearningStats } from "@/lib/client/learning-stats";

const SettingsDialog = dynamic(
  () => import("@/components/settings").then((module) => module.SettingsDialog),
  { ssr: false },
);
const UpgradeDialog = dynamic(
  () => import("@/components/billing/upgrade-dialog").then((module) => module.UpgradeDialog),
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

  const isDark = resolvedTheme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Base tone */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)"
            : "#FAFBFC",
        }}
      />

      {/* Soft watercolor washes */}
      {isDark ? (
        <>
          <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] bg-sky-900/20 rounded-full blur-[120px]" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-900/15 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] bg-indigo-900/10 rounded-full blur-[80px]" />
        </>
      ) : (
        <>
          <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] bg-sky-100/40 rounded-full blur-[120px]" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] bg-indigo-50/30 rounded-full blur-[80px]" />
        </>
      )}

      {/* Subtle grain texture overlay */}
      <div
        className="absolute inset-0"
        style={{
          opacity: isDark ? 0.03 : 0.015,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
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
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
      const res = await fetch("/api/sky/check-in", {
        method: "POST",
        credentials: "include",
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

  const workspace = pathname.startsWith("/sky/teaching") || pathname.startsWith("/sky/cloud-mind/teaching")
    ? {
        label: "备课工作区",
        description: "课程、教案、课件和课堂历史",
      }
    : pathname.startsWith("/sky/cloud-mind") ||
        pathname.startsWith("/sky/question-bank") ||
        pathname.startsWith("/sky/assistant") ||
        pathname.startsWith("/sky/solve") ||
        pathname.startsWith("/sky/slides")
      ? {
          label: "学习资源",
          description: "题目、讲解、复习和课程材料",
        }
      : {
          label: "学习工作台",
          description: "今天学什么、为什么学、下一步怎么走",
        };

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip">
      <AtmosphericBackground />
      <SkySidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />

      <div
        className={`ml-[248px] flex min-h-dvh min-w-0 flex-col ${
          sidebarCollapsed ? "ml-[72px]" : ""
        }`}
      >
        <header
          className={`sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 px-5 transition-all duration-500 xl:px-8 ${
            scrolled
              ? "bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl shadow-[0_1px_20px_-8px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_20px_-8px_rgba(0,0,0,0.2)] border-b border-slate-200/40 dark:border-slate-700/20"
              : "bg-transparent"
          }`}
        >
          {scrolled && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              className="absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
            />
          )}

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
              {checkingIn ? "打卡中..." : "今日打卡"}
            </Button>
          )}
          {user && checkedIn && (
            <div className="hidden md:flex items-center gap-1.5 text-sm text-rose-500 font-medium">
              <Sparkles className="h-4 w-4" />
              <span>{streakDays > 0 ? `${streakDays} 天` : "已打卡"}</span>
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
            fullBleed
              ? "min-w-0 flex-1"
              : "min-w-0 flex-1 px-4 py-5 md:px-6 md:py-7 xl:px-8"
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
          currentPlan={user?.planType ?? "free"}
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
