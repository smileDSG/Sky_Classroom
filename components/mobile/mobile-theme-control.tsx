'use client';

import type { ElementType } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';

type MobileTheme = 'light' | 'dark' | 'system';

const mobileThemeOptions: {
  id: MobileTheme;
  label: string;
  ariaLabel: string;
  icon: ElementType;
}[] = [
  { id: 'light', label: '浅色', ariaLabel: '切换浅色主题', icon: Sun },
  { id: 'dark', label: '深色', ariaLabel: '切换深色主题', icon: Moon },
  { id: 'system', label: '自动', ariaLabel: '跟随系统主题', icon: Monitor },
];

export function MobileThemeControl({
  className = '',
  variant = 'segment',
}: {
  className?: string;
  variant?: 'segment' | 'toggle';
}) {
  const { theme, setTheme, forceDark } = useTheme();

  if (forceDark) return null;

  if (variant === 'toggle') {
    const isDark = theme === 'dark';
    const Icon = isDark ? Sun : Moon;
    return (
      <button
        type="button"
        aria-label={isDark ? '切换浅色主题' : '切换深色主题'}
        title={isDark ? '切换浅色主题' : '切换深色主题'}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#0d1728] text-slate-300 shadow-sm shadow-black/10 transition-all hover:text-white active:scale-95 ${className}`}
      >
        <Icon className="size-4" />
      </button>
    );
  }

  return (
    <div
      aria-label="系统颜色更改"
      data-testid="mobile-theme-control"
      className={`flex h-9 w-full items-center rounded-full border border-white/10 bg-[#0d1728] p-0.5 shadow-sm shadow-black/10 ${className}`}
    >
      {mobileThemeOptions.map((option) => {
        const Icon = option.icon;
        const active = theme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-label={option.ariaLabel}
            aria-pressed={active}
            title={option.ariaLabel}
            onClick={() => setTheme(option.id)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 ${
              active
                ? 'bg-sky-300 text-[#082033] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Icon className="size-4" />
            <span className="text-[10px] font-medium leading-none">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
