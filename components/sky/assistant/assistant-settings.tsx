'use client';

import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Palette,
  Type,
  Sparkles,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react';
import {
  listConversations,
  deleteConversation,
  type AssistantConversationRecord,
} from '@/lib/storage/dao/assistant-conversation';

interface AssistantSettingsProps {
  mode: 'anime' | 'normal';
  onModeChange: (mode: 'anime' | 'normal') => void;
  onThemeChange?: (themeId: string) => void;
}

const THEME_COLORS = [
  { id: 'sky', label: '天蓝', color: 'bg-sky-500', ring: 'ring-sky-500' },
  { id: 'violet', label: '紫罗兰', color: 'bg-violet-500', ring: 'ring-violet-500' },
  { id: 'emerald', label: '翡翠绿', color: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'rose', label: '玫瑰红', color: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'amber', label: '琥珀金', color: 'bg-amber-500', ring: 'ring-amber-500' },
];

const FONT_SIZES = [
  { id: 'sm', label: '小', desc: '12px', sample: 'text-xs' },
  { id: 'base', label: '中', desc: '14px', sample: 'text-sm' },
  { id: 'lg', label: '大', desc: '16px', sample: 'text-base' },
];

export function AssistantSettings({ mode, onModeChange, onThemeChange }: AssistantSettingsProps) {
  const [selectedTheme, setSelectedTheme] = useState(() => {
    try {
      return localStorage.getItem('assistant-theme') || 'sky';
    } catch {
      return 'sky';
    }
  });
  const [selectedFontSize, setSelectedFontSize] = useState(() => {
    try {
      return localStorage.getItem('assistant-font-size') || 'base';
    } catch {
      return 'base';
    }
  });
  const [clearingData, setClearingData] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleThemeChange = useCallback(
    (themeId: string) => {
      setSelectedTheme(themeId);
      try {
        localStorage.setItem('assistant-theme', themeId);
      } catch {
        /* ignore */
      }
      onThemeChange?.(themeId);
    },
    [onThemeChange],
  );

  const handleFontSizeChange = useCallback((sizeId: string) => {
    setSelectedFontSize(sizeId);
    try {
      localStorage.setItem('assistant-font-size', sizeId);
    } catch {
      /* ignore */
    }
  }, []);

  const handleClearAllData = useCallback(async () => {
    setClearingData(true);
    try {
      const convs = await listConversations({ limit: 9999 });
      for (const conv of convs) {
        await deleteConversation(conv.id);
      }
      try {
        localStorage.removeItem('kagami-mode');
        localStorage.removeItem('assistant-theme');
        localStorage.removeItem('assistant-font-size');
      } catch {
        /* ignore */
      }
      setCleared(true);
      setTimeout(() => {
        setCleared(false);
        setShowClearConfirm(false);
      }, 2000);
    } catch {
      // ignore
    } finally {
      setClearingData(false);
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      {/* Persona Mode */}
      <Section icon={<Sparkles className="h-4 w-4 text-sky-500" />} title="助手人格">
        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            isActive={mode === 'anime'}
            onClick={() => onModeChange('anime')}
            emoji="🌸"
            label="二次元模式"
            desc="傲娇女高中生·柊镜"
          />
          <ModeCard
            isActive={mode === 'normal'}
            onClick={() => onModeChange('normal')}
            emoji="📖"
            label="常规模式"
            desc="专业友善的 AI 助教"
          />
        </div>
      </Section>

      {/* Theme Color */}
      <Section icon={<Palette className="h-4 w-4 text-violet-500" />} title="主题色">
        <div className="flex gap-3">
          {THEME_COLORS.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className="group flex flex-col items-center gap-1.5"
              title={theme.label}
            >
              <div
                className={`h-8 w-8 rounded-full ${theme.color} transition-all ${
                  selectedTheme === theme.id
                    ? `ring-2 ${theme.ring} ring-offset-2 ring-offset-white dark:ring-offset-slate-800 scale-110`
                    : 'hover:scale-110'
                }`}
              >
                {selectedTheme === theme.id && (
                  <div className="flex h-full items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400">{theme.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Font Size */}
      <Section icon={<Type className="h-4 w-4 text-emerald-500" />} title="对话字号">
        <div className="flex gap-2">
          {FONT_SIZES.map((size) => (
            <button
              key={size.id}
              onClick={() => handleFontSizeChange(size.id)}
              className={`flex-1 flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                selectedFontSize === size.id
                  ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-600'
                  : 'border-slate-200 dark:border-slate-600 hover:border-sky-200'
              }`}
            >
              <span
                className={`${size.sample} font-medium ${
                  selectedFontSize === size.id
                    ? 'text-sky-700 dark:text-sky-300'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {size.label}
              </span>
              <span className="text-[10px] text-slate-400">{size.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Clear Data */}
      <Section icon={<Trash2 className="h-4 w-4 text-rose-500" />} title="数据管理">
        {!showClearConfirm ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            清空所有对话数据
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                  确认清空数据？
                </p>
                <p className="text-xs text-rose-500/80 mt-1">
                  此操作将删除所有对话历史、记忆数据和个性化设置，且无法恢复。
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleClearAllData()}
                    disabled={clearingData}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
                  >
                    {clearingData ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : cleared ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {cleared ? '已清空' : '确认清空'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ModeCard({
  isActive,
  onClick,
  emoji,
  label,
  desc,
}: {
  isActive: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
        isActive
          ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-600'
          : 'border-slate-200 dark:border-slate-600 hover:border-sky-200'
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p
          className={`text-sm font-semibold ${
            isActive ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          {label}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}
