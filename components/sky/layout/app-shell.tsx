'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { HeaderControls } from '@/components/sky/home/header-controls';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { SettingsDialog } from '@/components/settings';
import { UpgradeDialog } from '@/components/billing/upgrade-dialog';
import { SkyTabBar } from './sky-tab-bar';
import { BackgroundTasksIndicator } from './background-tasks-indicator';
import { useAuth } from '@/components/auth/auth-provider';
import { useStudyTimer } from '@/lib/hooks/use-study-timer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, Sparkles } from 'lucide-react';

interface SkyAppShellProps {
  children: React.ReactNode;
}

/**
 * Atmospheric background — soft watercolor washes and drifting light
 */
function AtmosphericBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Base warm paper tone */}
      <div className="absolute inset-0 bg-[#FAFBFC] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Soft watercolor washes */}
      <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] bg-sky-100/40 dark:bg-sky-900/10 rounded-full blur-[120px]" />
      <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-50/50 dark:bg-blue-900/8 rounded-full blur-[100px]" />
      <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] bg-indigo-50/30 dark:bg-indigo-900/5 rounded-full blur-[80px]" />

      {/* Subtle grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

/**
 * Logo with refined hover interaction
 */
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <div className="relative">
        <motion.img
          src="/logo-icon.svg"
          alt="天空课堂"
          className="w-7 h-7"
          whileHover={{ scale: 1.08, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        />
        <div className="absolute inset-0 rounded-lg bg-sky-400/0 group-hover:bg-sky-400/10 transition-colors duration-300 -z-10 blur-md" />
      </div>
      <div className="flex flex-col">
        <h1 className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
          天空课堂
        </h1>
        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 -mt-0.5 tracking-[0.15em] uppercase">
          Sky Classroom
        </span>
      </div>
    </Link>
  );
}

export function SkyAppShell({ children }: SkyAppShellProps) {
  const { user, refresh } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [streakDays, setStreakDays] = useState(0);

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

    fetch('/api/sky/learning-stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setCheckedIn(data.checkedInToday || false);
          setStreakDays(data.streakDays || 0);
        }
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

  return (
    <div className="flex h-screen w-full flex-col relative">
      <AtmosphericBackground />

      {/* Header */}
      <header
        className={`sticky top-0 z-50 grid h-16 shrink-0 grid-cols-3 items-center px-6 transition-all duration-500 ${
          scrolled
            ? 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_1px_20px_-8px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_20px_-8px_rgba(0,0,0,0.2)] border-b border-slate-200/40 dark:border-slate-700/20'
            : 'bg-transparent'
        }`}
      >
        {/* Top accent line on scroll */}
        {scrolled && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent origin-left"
          />
        )}

        <div className="flex items-center gap-3">
          <Logo />
        </div>

        <div className="flex justify-center">
          <SkyTabBar />
        </div>

        <div className="flex items-center justify-end gap-3">
          {/* Check-in Button - Only show when logged in and not checked in */}
          {user && !checkedIn && (
            <Button
              size="sm"
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25"
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
          <div className="h-5 w-px bg-slate-200/60 dark:bg-slate-700/40" />
          <FloatingUserCard
            onUpgradeOpen={() => setUpgradeOpen(true)}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6">{children}</main>

      <BackgroundTasksIndicator />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlan={user?.planType ?? 'free'}
        onPlanChanged={refresh}
      />
    </div>
  );
}
