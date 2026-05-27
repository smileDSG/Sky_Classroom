'use client';

import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { AssistantPanel } from '@/components/sky/assistant/assistant-panel';
import { AssistantConfig } from '@/components/sky/assistant/assistant-config';
import { AssistantHistory } from '@/components/sky/assistant/assistant-history';
import { AssistantSettings } from '@/components/sky/assistant/assistant-settings';
import {
  Feather,
  Wind,
  Cloud,
  MessageCircle,
  Sparkles,
  History,
  Settings,
} from 'lucide-react';

const SIDEBAR_ITEMS = [
  { key: 'chat', label: '对话', icon: MessageCircle, desc: '与小镜交流' },
  { key: 'history', label: '历史', icon: History, desc: '过往对话' },
  { key: 'settings', label: '设置', icon: Settings, desc: '个性配置' },
] as const;

export default function AssistantPage() {
  const [activeSidebar, setActiveSidebar] = useState<string>('chat');
  const [mode, setMode] = useState<'anime' | 'normal'>(() => {
    try {
      const saved = localStorage.getItem('kagami-mode');
      if (saved === 'normal' || saved === 'anime') return saved;
    } catch { /* ignore */ }
    return 'anime';
  });
  const [loadConvId, setLoadConvId] = useState<string | null>(null);

  const handleLoadConversation = useCallback((messages: { id: string; role: 'user' | 'assistant'; content: string }[], convId: string) => {
    setLoadConvId(convId);
    setActiveSidebar('chat');
  }, []);

  const handleConversationLoaded = useCallback(() => {
    setLoadConvId(null);
  }, []);

  const handleModeChange = useCallback((newMode: 'anime' | 'normal') => {
    setMode(newMode);
    try { localStorage.setItem('kagami-mode', newMode); } catch { /* ignore */ }
  }, []);

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl h-[calc(100vh-120px)] flex gap-5">
        {/* 左侧边栏 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-64 shrink-0 flex flex-col gap-4"
        >
          {/* Hero Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/4" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <Feather className="h-4 w-4 text-sky-200" />
                </div>
                <span className="text-[10px] font-medium text-sky-200 tracking-wider uppercase">
                  AI 助教
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">云翼助手</h2>
              <p className="text-xs text-sky-100 leading-relaxed">
                小镜随时待命，为你解答疑惑、梳理思路。
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1 text-[10px] text-sky-200">
                  <Wind className="h-3 w-3" />
                  <span>即时响应</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-sky-200">
                  <Cloud className="h-3 w-3" />
                  <span>云端记忆</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <div className="flex-1 flex flex-col gap-2">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSidebar === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSidebar(item.key)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/10 border border-sky-200 dark:border-sky-700/30 shadow-sm'
                      : 'hover:bg-white/50 dark:hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      isActive
                        ? 'bg-gradient-to-br from-sky-500 to-blue-500 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700/50'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                  </div>
                  <div>
                    <div
                      className={`text-sm font-medium ${
                        isActive
                          ? 'text-sky-700 dark:text-sky-300'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Tip */}
          <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-700/20 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                提示：小镜会记住你们的对话
              </span>
            </div>
          </div>
        </motion.div>

        {/* 主内容区 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex-1 flex flex-col overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30"
        >
          {activeSidebar === 'chat' && (
            <>
              <div className="shrink-0 border-b border-slate-200/50 dark:border-slate-700/30 p-4">
                <AssistantConfig />
              </div>
              <div className="flex-1 overflow-hidden">
                <AssistantPanel
                  mode={mode}
                  onModeChange={handleModeChange}
                  externalLoadConvId={loadConvId}
                  onConversationLoaded={handleConversationLoaded}
                />
              </div>
            </>
          )}
          {activeSidebar === 'history' && (
            <AssistantHistory mode={mode} onLoadConversation={handleLoadConversation} />
          )}
          {activeSidebar === 'settings' && (
            <AssistantSettings mode={mode} onModeChange={handleModeChange} />
          )}
        </motion.div>
      </div>
    </SkyAppShell>
  );
}
