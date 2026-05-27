'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  MessageCircle,
  Trash2,
  Search,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  listConversations,
  deleteConversation,
  getConversation,
  type AssistantConversationRecord,
} from '@/lib/storage/dao/assistant-conversation';
import type { AssistantMessage } from '@/lib/utils/database';

interface AssistantHistoryProps {
  mode: 'anime' | 'normal';
  onLoadConversation: (messages: { id: string; role: 'user' | 'assistant'; content: string }[], convId: string) => void;
}

export function AssistantHistory({ mode, onLoadConversation }: AssistantHistoryProps) {
  const [conversations, setConversations] = useState<AssistantConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const convs = await listConversations({ mode, limit: 50 });
      setConversations(convs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const handleDelete = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(convId);
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleLoad = useCallback(async (convId: string) => {
    try {
      const conv = await getConversation(convId);
      if (!conv) return;
      const loadedMessages = conv.messages
        .filter((m: AssistantMessage) => m.role !== 'system')
        .map((m: AssistantMessage, i: number) => ({
          id: m.id || `loaded-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      onLoadConversation(loadedMessages, conv.id);
    } catch {
      // ignore
    }
  }, [onLoadConversation]);

  const filtered = searchQuery.trim()
    ? conversations.filter(
        (c) => c.title && c.title.includes(searchQuery),
      )
    : conversations;

  const modeLabel = mode === 'anime' ? '二次元' : '常规';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search Bar */}
      <div className="shrink-0 px-5 pt-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 transition-all"
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {modeLabel}模式 · 共 {conversations.length} 条对话
        </p>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-sky-500 animate-spin mb-3" />
            <p className="text-sm text-slate-400">加载中…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <History className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery ? '未找到匹配的对话' : '暂无对话历史'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? '试试其他关键词' : '开始一段新对话吧'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((conv, i) => (
                <motion.div
                  key={conv.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => void handleLoad(conv.id)}
                  className="group relative flex items-center gap-3 rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm p-4 cursor-pointer hover:border-sky-300 dark:hover:border-sky-600 hover:shadow-md transition-all"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-900/30">
                    <MessageCircle className="h-4 w-4 text-sky-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {conv.title || '未命名对话'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">
                        {conv.messageCount} 条消息
                      </span>
                      <span className="text-[10px] text-slate-300">·</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRelativeTime(conv.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => void handleDelete(conv.id, e)}
                      disabled={deletingId === conv.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      title="删除对话"
                    >
                      {deletingId === conv.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-400 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}
