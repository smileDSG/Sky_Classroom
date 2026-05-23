'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Monitor, Globe, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

// Languages list from supportedLocales
const languages = [
  { code: 'zh-CN' as const, name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW' as const, name: '繁體中文', flag: '🇹🇼' },
  { code: 'en-US' as const, name: 'English', flag: '🇺🇸' },
  { code: 'ja-JP' as const, name: '日本語', flag: '🇯🇵' },
  { code: 'ru-RU' as const, name: 'Русский', flag: '🇷🇺' },
  { code: 'ar-SA' as const, name: 'العربية', flag: '🇸🇦' },
];

// 精简导航栏组件
export function MinimalNavbar({
  userSection,
}: {
  userSection: React.ReactNode;
}) {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const currentLang = languages.find((l) => l.code === locale) || languages[0];

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* 背景模糊层 */}
      <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/30" />

      {/* 内容 */}
      <div className="relative flex items-center justify-between h-16 px-4 md:px-6">
        {/* 左侧 - Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
              <ellipse cx="8" cy="16" rx="5" ry="4" />
              <ellipse cx="14" cy="12" rx="7" ry="5" />
              <ellipse cx="18" cy="15" rx="4" ry="3" />
            </svg>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent hidden sm:block">
            天空课堂
          </span>
        </motion.div>

        {/* 右侧 - 工具栏 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          {/* 语言切换 */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowLangMenu(!showLangMenu);
                setShowThemeMenu(false);
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl',
                'text-sm font-medium text-slate-700 dark:text-slate-300',
                'bg-slate-100/50 dark:bg-slate-800/50',
                'hover:bg-slate-200/50 dark:hover:bg-slate-700/50',
                'transition-colors',
                showLangMenu && 'bg-slate-200 dark:bg-slate-700'
              )}
            >
              <span>{currentLang.flag}</span>
              <span className="hidden sm:inline">{currentLang.name}</span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  showLangMenu && 'rotate-180'
                )}
              />
            </motion.button>

            <AnimatePresence>
              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className={cn(
                    'absolute right-0 top-full mt-2 py-2 rounded-2xl',
                    'bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl',
                    'border border-slate-200/50 dark:border-slate-700/50',
                    'shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50',
                    'min-w-[180px] z-50'
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
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                        'text-sm transition-colors',
                        locale === l.code
                          ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      )}
                    >
                      <span>{l.flag}</span>
                      <span>{l.name}</span>
                      {locale === l.code && (
                        <motion.div
                          layoutId="lang-check"
                          className="ml-auto w-2 h-2 rounded-full bg-sky-500"
                        />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 主题切换 */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowThemeMenu(!showThemeMenu);
                setShowLangMenu(false);
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl',
                'text-slate-700 dark:text-slate-300',
                'bg-slate-100/50 dark:bg-slate-800/50',
                'hover:bg-slate-200/50 dark:hover:bg-slate-700/50',
                'transition-colors',
                showThemeMenu && 'bg-slate-200 dark:bg-slate-700'
              )}
            >
              {theme === 'light' && <Sun className="w-5 h-5" />}
              {theme === 'dark' && <Moon className="w-5 h-5" />}
              {theme === 'system' && <Monitor className="w-5 h-5" />}
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  showThemeMenu && 'rotate-180'
                )}
              />
            </motion.button>

            <AnimatePresence>
              {showThemeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className={cn(
                    'absolute right-0 top-full mt-2 py-2 rounded-2xl',
                    'bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl',
                    'border border-slate-200/50 dark:border-slate-700/50',
                    'shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50',
                    'min-w-[140px] z-50'
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
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                        'text-sm transition-colors',
                        theme === t.id
                          ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      )}
                    >
                      <t.icon className="w-4 h-4" />
                      <span>{t.label}</span>
                      {theme === t.id && (
                        <motion.div
                          layoutId="theme-check"
                          className="ml-auto w-2 h-2 rounded-full bg-sky-500"
                        />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 用户区域 */}
          {userSection}
        </motion.div>
      </div>
    </header>
  );
}
