'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import {
  QUICK_IDENTITY_KEY,
  isWelcomeSeen,
  markWelcomeSeen,
  welcomeEntriesFor,
} from '@/lib/sky/welcome';

export function WelcomeCard() {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<ReturnType<typeof welcomeEntriesFor>>([]);

  useEffect(() => {
    if (isWelcomeSeen()) return;
    let identity: string | null = null;
    try {
      identity = localStorage.getItem(QUICK_IDENTITY_KEY);
    } catch {
      /* ignore */
    }
    setEntries(welcomeEntriesFor(identity));
    setVisible(true);
  }, []);

  function dismiss() {
    markWelcomeSeen();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-5 dark:border-sky-200/20 dark:from-sky-400/10 dark:to-indigo-400/10">
      <button
        type="button"
        onClick={dismiss}
        aria-label="关闭欢迎提示"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-600 dark:hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        欢迎来到天空课堂 👋
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        第一次来？从一个入口开始，其余随时回来探索。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            onClick={dismiss}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 dark:bg-slate-900/60 dark:text-sky-200 dark:hover:bg-slate-900"
          >
            {entry.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
