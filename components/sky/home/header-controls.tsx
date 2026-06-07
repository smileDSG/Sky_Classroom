'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

const languages = [
  { code: 'zh-CN' as const, name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW' as const, name: '繁體中文', flag: '🇹🇼' },
  { code: 'en-US' as const, name: 'English', flag: '🇺🇸' },
  { code: 'ja-JP' as const, name: '日本語', flag: '🇯🇵' },
  { code: 'ru-RU' as const, name: 'Русский', flag: '🇷🇺' },
  { code: 'ar-SA' as const, name: 'العربية', flag: '🇸🇦' },
];

/**
 * Compact header controls: language switcher + theme switcher.
 * Shared between MinimalNavbar (home) and SkyAppShell (/sky pages).
 */
export function HeaderControls() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const currentLang = languages.find((l) => l.code === locale) || languages[0];

  return (
    <>
      {/* 语言切换 */}
      <div className="relative">
        <button
          onClick={() => {
            setShowLangMenu(!showLangMenu);
            setShowThemeMenu(false);
          }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
            'text-sm text-slate-700 dark:text-slate-300',
            'hover:bg-slate-100 dark:hover:bg-slate-700/50',
            'transition-colors',
            showLangMenu && 'bg-slate-200 dark:bg-slate-700',
          )}
        >
          <span className="text-sm">{currentLang.flag}</span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform',
              showLangMenu && 'rotate-180',
            )}
          />
        </button>

        <AnimatePresence>
          {showLangMenu && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={cn(
                'absolute right-0 top-full mt-2 py-2 rounded-xl',
                'bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl',
                'border border-slate-200/50 dark:border-slate-700/50',
                'shadow-xl',
                'min-w-[160px] z-50',
              )}
            >
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLocale(l.code);
                    setShowLangMenu(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-left',
                    'text-sm transition-colors',
                    locale === l.code
                      ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50',
                  )}
                >
                  <span>{l.flag}</span>
                  <span>{l.name}</span>
                  {locale === l.code && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-sky-500" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 主题切换 */}
      <div className="relative">
        <button
          onClick={() => {
            setShowThemeMenu(!showThemeMenu);
            setShowLangMenu(false);
          }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
            'text-slate-700 dark:text-slate-300',
            'hover:bg-slate-100 dark:hover:bg-slate-700/50',
            'transition-colors',
            showThemeMenu && 'bg-slate-200 dark:bg-slate-700',
          )}
        >
          {theme === 'light' && <Sun className="w-4 h-4" />}
          {theme === 'dark' && <Moon className="w-4 h-4" />}
          {theme === 'system' && <Monitor className="w-4 h-4" />}
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform',
              showThemeMenu && 'rotate-180',
            )}
          />
        </button>

        <AnimatePresence>
          {showThemeMenu && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={cn(
                'absolute right-0 top-full mt-2 py-2 rounded-xl',
                'bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl',
                'border border-slate-200/50 dark:border-slate-700/50',
                'shadow-xl',
                'min-w-[130px] z-50',
              )}
            >
              {[
                { id: 'light' as Theme, icon: Sun, label: '浅色' },
                { id: 'dark' as Theme, icon: Moon, label: '深色' },
                { id: 'system' as Theme, icon: Monitor, label: '跟随系统' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setShowThemeMenu(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-left',
                    'text-sm transition-colors',
                    theme === t.id
                      ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50',
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  <span>{t.label}</span>
                  {theme === t.id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-sky-500" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
