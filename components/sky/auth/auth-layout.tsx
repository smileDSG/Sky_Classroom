'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Decorative elements ──────────────────────────────────────────

function FloatingCloud({ delay = 0, duration = 25, y = 0, scale = 1, opacity = 0.4 }: {
  delay?: number; duration?: number; y?: number; scale?: number; opacity?: number;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      initial={{ x: '-100%', y: `${y}%` }}
      animate={{ x: 'calc(100vw + 100%)' }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
      style={{ scale, opacity }}
    >
      <svg viewBox="0 0 200 100" className="w-24 h-12 md:w-36 md:h-18 text-white/40 dark:text-white/15" fill="currentColor">
        <ellipse cx="50" cy="60" rx="35" ry="25" />
        <ellipse cx="90" cy="45" rx="45" ry="35" />
        <ellipse cx="140" cy="55" rx="40" ry="28" />
      </svg>
    </motion.div>
  );
}

function TwinklingStar({ x, y, delay = 0, size = 2 }: {
  x: string; y: string; delay?: number; size?: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full bg-white dark:bg-sky-200 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, boxShadow: '0 0 6px 2px rgba(255,255,255,0.4)' }}
      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
      transition={{ duration: 3, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// ── Auth Layout ──────────────────────────────────────────────────

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Override max-width of the card (default: max-w-md) */
  maxWidth?: string;
}

export function AuthLayout({ children, className, maxWidth = 'max-w-md' }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* ── Sky gradient background ── */}
      <div className="fixed inset-0 bg-gradient-to-b from-sky-200 via-sky-100 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Sunrise/sunset glow */}
      <div
        className="fixed inset-0 opacity-60 dark:opacity-30 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, rgba(135,206,235,0.4) 0%, transparent 50%),
            radial-gradient(ellipse 80% 60% at 80% 100%, rgba(255,183,178,0.2) 0%, transparent 40%)
          `,
        }}
      />

      {/* ── Floating clouds (light mode) ── */}
      <div className="fixed inset-0 dark:hidden pointer-events-none">
        <FloatingCloud delay={0} duration={35} y={10} scale={0.7} opacity={0.35} />
        <FloatingCloud delay={8} duration={45} y={30} scale={1} opacity={0.3} />
        <FloatingCloud delay={18} duration={40} y={60} scale={0.5} opacity={0.25} />
      </div>

      {/* ── Twinkling stars (dark mode) ── */}
      <div className="fixed inset-0 hidden dark:block pointer-events-none">
        <TwinklingStar x="10%" y="15%" delay={0} size={2} />
        <TwinklingStar x="30%" y="8%" delay={0.5} size={3} />
        <TwinklingStar x="50%" y="22%" delay={1} size={2} />
        <TwinklingStar x="75%" y="12%" delay={1.5} size={2.5} />
        <TwinklingStar x="90%" y="20%" delay={2} size={2} />
        <TwinklingStar x="15%" y="35%" delay={3} size={1.5} />
        <TwinklingStar x="85%" y="30%" delay={0.8} size={2} />
      </div>

      {/* ── Bottom gradient fade ── */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/60 dark:from-slate-950/60 to-transparent pointer-events-none" />

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'relative w-full',
          maxWidth,
          'rounded-2xl border border-white/40 dark:border-slate-700/40',
          'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl',
          'shadow-xl shadow-sky-200/30 dark:shadow-slate-950/50',
          'p-6 sm:p-8',
          className,
        )}
      >
        {/* Logo header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="flex flex-col items-center mb-6"
        >
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-icon.svg"
              alt="Sky Classroom"
              className="w-10 h-10 transition-transform group-hover:scale-110"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
              Sky Classroom
            </span>
          </Link>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
