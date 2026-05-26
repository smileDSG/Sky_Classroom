'use client';

import type { ChatSession, SessionStatus } from '@/lib/types/chat';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { ChevronDown, Circle, CheckCircle, Clock, MessageSquare, HelpCircle, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatSessionComponent } from './chat-session';

interface SessionListProps {
  sessions: ChatSession[];
  expandedSessionIds: Set<string>;
  isStreaming: boolean;
  activeBubbleId?: string | null;
  onToggleExpand: (sessionId: string) => void;
  onEndSession: (sessionId: string) => Promise<void>;
}

function getStatusIcon(status: SessionStatus) {
  switch (status) {
    case 'active':
      return <Circle className="size-2.5 fill-emerald-500 text-emerald-500" />;
    case 'interrupted':
      return <Clock className="size-2.5 text-amber-500" />;
    case 'completed':
      return <CheckCircle className="size-2.5 text-slate-400" />;
    case 'idle':
    default:
      return <Circle className="size-2.5 text-slate-300" />;
  }
}

function getSessionIcon(type: string) {
  switch (type) {
    case 'discussion':
      return <MessageSquare className="w-3.5 h-3.5" />;
    case 'qa':
      return <HelpCircle className="w-3.5 h-3.5" />;
    case 'lecture':
      return <BookOpen className="w-3.5 h-3.5" />;
    default:
      return <MessageSquare className="w-3.5 h-3.5" />;
  }
}

function getSessionColorClasses(type: string) {
  const colors: Record<string, { border: string; bg: string; badge: string; title: string; dot: string }> = {
    discussion: {
      border: 'border-l-amber-400 dark:border-l-amber-500',
      bg: 'bg-amber-50/20 dark:bg-amber-900/10',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      title: 'text-amber-900 dark:text-amber-100',
      dot: 'bg-amber-500',
    },
    qa: {
      border: 'border-l-blue-400 dark:border-l-blue-500',
      bg: 'bg-blue-50/20 dark:bg-blue-900/10',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      title: 'text-blue-900 dark:text-blue-100',
      dot: 'bg-blue-500',
    },
    lecture: {
      border: 'border-l-violet-400 dark:border-l-violet-500',
      bg: 'bg-violet-50/20 dark:bg-violet-900/10',
      badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      title: 'text-violet-900 dark:text-violet-100',
      dot: 'bg-violet-500',
    },
    default: {
      border: 'border-l-slate-300 dark:border-l-slate-600',
      bg: 'bg-slate-50/20 dark:bg-slate-800/20',
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300',
      title: 'text-slate-900 dark:text-slate-100',
      dot: 'bg-slate-400',
    },
  };
  return colors[type] || colors.default;
}

export function SessionList({
  sessions,
  expandedSessionIds,
  isStreaming,
  activeBubbleId,
  onToggleExpand,
  onEndSession,
}: SessionListProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {sessions.map((session) => {
          const isExpanded = expandedSessionIds.has(session.id);
          const isActive = session.status === 'active';
          const colors = getSessionColorClasses(session.type);

          return (
            <motion.div
              key={session.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'rounded-xl border border-l-[3px] transition-all duration-300 overflow-hidden',
                colors.border,
                isActive
                  ? cn(colors.bg, 'shadow-sm ring-1 ring-current/10')
                  : 'bg-white/50 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/50',
              )}
            >
              {/* Topic header */}
              <button
                onClick={() => onToggleExpand(session.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left
                  hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                {/* Session type icon */}
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', colors.badge)}>
                  {getSessionIcon(session.type)}
                </div>

                {/* Topic title */}
                <span className={cn('flex-1 text-[13px] font-semibold truncate', colors.title)}>
                  {session.title}
                </span>

                {/* Message count badge */}
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tabular-nums shrink-0">
                  💬 {session.messages.length}
                </span>

                {/* Status icon */}
                <div className="shrink-0">
                  {isActive && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors.dot)} />
                      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colors.dot)} />
                    </span>
                  )}
                  {!isActive && getStatusIcon(session.status)}
                </div>

                {/* Chevron */}
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 shrink-0',
                    isExpanded ? 'rotate-180' : 'rotate-0',
                  )}
                />
              </button>

              {/* Expanded messages */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden border-t border-slate-100/50 dark:border-slate-700/50"
                  >
                    <div className="px-2 pb-2 pt-1">
                      <ChatSessionComponent
                        session={session}
                        isActive={isActive}
                        isStreaming={isStreaming && isActive}
                        activeBubbleId={activeBubbleId}
                        onEndSession={onEndSession}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="h-32 flex flex-col items-center justify-center text-center px-4 opacity-60">
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-2 text-slate-400 dark:text-slate-500">
            <MessageSquare className="w-5 h-5" />
          </div>
          <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
            {t('chat.noConversations')}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {t('chat.startConversation')}
          </p>
        </div>
      )}
    </div>
  );
}
