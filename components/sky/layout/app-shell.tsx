'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { HeaderControls } from '@/components/sky/home/header-controls';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { SettingsDialog } from '@/components/settings';
import { UpgradeDialog } from '@/components/billing/upgrade-dialog';
import { SkyTabBar } from './sky-tab-bar';
import Link from 'next/link';

interface SkyAppShellProps {
  children: React.ReactNode;
}

/**
 * Starry background with floating particles
 */
function StarryBackground() {
  const [stars, setStars] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    const generated = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    }));
    setStars(generated);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-900" />

      {/* Floating stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-indigo-400/40 dark:bg-indigo-300/30"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Subtle aurora effect */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-400/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/5 dark:bg-blue-500/10 rounded-full blur-3xl" />
    </div>
  );
}

/**
 * Animated logo with glow effect
 */
function AnimatedLogo() {
  return (
    <Link href="/" className="flex items-center gap-3 group">
      <div className="relative">
        <motion.div
          className="text-2xl"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          ☁️
        </motion.div>
        <motion.div
          className="absolute inset-0 rounded-full bg-indigo-400/20 blur-md"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <div className="flex flex-col">
        <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
          天空课堂
        </h1>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 -mt-0.5 tracking-wider">
          SKY CLASSROOM
        </span>
      </div>
    </Link>
  );
}

export function SkyAppShell({ children }: SkyAppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col relative">
      <StarryBackground />

      {/* Header */}
      <header
        className={`sticky top-0 z-50 grid h-16 shrink-0 grid-cols-3 items-center px-6 transition-all duration-500 ${
          scrolled
            ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-indigo-500/5 border-b border-slate-200/50 dark:border-slate-700/30'
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-center gap-3">
          <AnimatedLogo />
        </div>

        <div className="flex justify-center">
          <SkyTabBar />
        </div>

        <div className="flex items-center justify-end gap-3">
          <HeaderControls />
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <FloatingUserCard
            onSettingsOpen={() => setSettingsOpen(true)}
            onUpgradeOpen={() => setUpgradeOpen(true)}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6">{children}</main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentPlan="free" />
    </div>
  );
}
