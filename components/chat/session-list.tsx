'use client';

import type { ChatSession, SessionStatus } from '@/lib/types/chat';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { MessageSquare, HelpCircle, BookOpen, Users, MapPin, Clock, CheckCircle2, Circle, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatSessionComponent } from './chat-session';

interface SessionListProps {
  sessions: ChatSession[];
  expandedSessionIds: Set<string>;
  isStreaming: boolean;
  activeBubbleId?: string | null;
  sceneTitleMap?: Map<string, { title: string; order: number }>;
  onToggleExpand: (sessionId: string) => void;
  onEndSession: (sessionId: string) => Promise<void>;
  onDeleteSession?: (sessionId: string) => void;
}

const SESSION_TYPE_CONFIG: Record<string, {
  Icon: typeof MessageSquare;
  color: string;
  bgGradient: string;
  ringColor: string;
}> = {
  discussion: {
    Icon: MessageSquare,
    color: 'text-amber-600 dark:text-amber-400',
    bgGradient: 'from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10',
    ringColor: 'ring-amber-200 dark:ring-amber-800',
  },
  qa: {
    Icon: HelpCircle,
    color: 'text-blue-600 dark:text-blue-400',
    bgGradient: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10',
    ringColor: 'ring-blue-200 dark:ring-blue-800',
  },
  lecture: {
    Icon: BookOpen,
    color: 'text-violet-600 dark:text-violet-400',
    bgGradient: 'from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-900/10',
    ringColor: 'ring-violet-200 dark:ring-violet-800',
  },
};

export function SessionList({
  sessions,
  expandedSessionIds,
  isStreaming,
  activeBubbleId,
  sceneTitleMap,
  onToggleExpand,
  onEndSession,
  onDeleteSession,
}: SessionListProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-1.5 px-0.5">
      <AnimatePresence mode="popLayout">
        {sessions.map((session) => {
          const isExpanded = expandedSessionIds.has(session.id);
          const isActive = session.status === 'active';
          const cfg = SESSION_TYPE_CONFIG[session.type] || SESSION_TYPE_CONFIG.qa;
          const { Icon } = cfg;

          // Get last message preview
          const lastMsg = session.messages[session.messages.length - 1];
          const lastMsgText = (lastMsg?.parts as any[])
            ?.find((p: any) => p.type === 'text' && p.text)
            ?.text
            ?.slice(0, 40) || '';

          // Get unique participant roles
          const participantRoles = new Set(
            session.messages.map((m) => m.metadata?.originalRole || m.role).filter(Boolean)
          );
          const participantCount = participantRoles.size;

          return (
            <motion.div
              key={session.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'rounded-xl border overflow-hidden transition-all duration-200',
                isExpanded
                  ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm'
                  : isActive
                    ? `bg-gradient-to-r ${cfg.bgGradient} border-transparent shadow-sm ring-1 ${cfg.ringColor}`
                    : 'bg-white dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/40 hover:shadow-sm',
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onToggleExpand(session.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(session.id); } }}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left cursor-pointer"
              >
                {/* Type icon */}
                <div className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                  isExpanded
                    ? `bg-gradient-to-br ${cfg.bgGradient} ${cfg.color}`
                    : cfg.color,
                )}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Title + preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[13px] font-semibold truncate',
                      isExpanded ? 'text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200',
                    )}>
                      {session.title}
                    </span>
                    {isActive && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                  </div>
                  {!isExpanded && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {lastMsgText ? (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {lastMsgText}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          暂无消息
                        </span>
                      )}
                    </div>
                  )}
                  {!isExpanded && session.sceneId && sceneTitleMap?.has(session.sceneId) && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-sky-500/70 dark:text-sky-400/70">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">
                        {(() => {
                          const s = sceneTitleMap.get(session.sceneId!)!;
                          return `${t('chat.lectureNotes.pageLabel', { n: s.order + 1 })} — ${s.title}`;
                        })()}
                      </span>
                    </div>
                  )}
                  {!isExpanded && !session.sceneId && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400/70 dark:text-slate-500/70">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{t('chat.lectureNotes.noScene')}</span>
                    </div>
                  )}
                </div>

                {/* Badges + chevron */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isExpanded && (
                    <>
                      {participantCount > 1 && (
                        <div className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          <Users className="w-3 h-3" />
                          {participantCount}
                        </div>
                      )}
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-px rounded-full',
                        isActive
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : session.status === 'completed'
                            ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                            : session.status === 'interrupted'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500',
                      )}>
                        {session.messages.length}
                      </span>
                    </>
                  )}
                  {/* Delete button on collapsed card */}
                  {!isActive && !isExpanded && onDeleteSession && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }
                      }}
                      className="w-5 h-5 rounded-full flex items-center justify-center
                        text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                        transition-colors shrink-0 cursor-pointer"
                      title={t('chat.deleteSession')}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                  <ChevronRight className={cn(
                    'w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0',
                    isExpanded ? 'rotate-90' : 'rotate-0',
                  )} />
                </div>
              </div>

              {/* Expanded messages */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden border-t border-slate-100 dark:border-slate-700/50"
                  >
                    <div className="px-1.5 pb-2 pt-1.5">
                      {session.sceneId && sceneTitleMap?.has(session.sceneId) && (
                        <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 text-[11px] text-sky-500/80 dark:text-sky-400/80 bg-sky-50/50 dark:bg-sky-950/30 rounded-lg">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate font-medium">
                            {(() => {
                              const s = sceneTitleMap.get(session.sceneId!)!;
                              return `${t('chat.lectureNotes.pageLabel', { n: s.order + 1 })} — ${s.title}`;
                            })()}
                          </span>
                        </div>
                      )}
                      {!session.sceneId && (
                        <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 text-[11px] text-slate-500/80 dark:text-slate-400/80 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate font-medium">{t('chat.lectureNotes.noScene')}</span>
                        </div>
                      )}
                      <ChatSessionComponent
                        session={session}
                        isActive={isActive}
                        isStreaming={isStreaming && isActive}
                        activeBubbleId={activeBubbleId}
                        onEndSession={onEndSession}
                        onDeleteSession={onDeleteSession}
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
        <div className="h-36 flex flex-col items-center justify-center text-center px-4">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200/50 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl flex items-center justify-center mb-3 text-slate-400 dark:text-slate-500 shadow-inner">
            <MessageSquare className="w-6 h-6" />
          </div>
          <p className="text-[13px] font-semibold text-slate-400 dark:text-slate-500">
            {t('chat.noConversations')}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {t('chat.startConversation')}
          </p>
        </div>
      )}
    </div>
  );
}
