'use client';

import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, ChevronRight, HelpCircle, MapPin, MessageSquare, Users, X } from 'lucide-react';
import { ChatSessionComponent } from './chat-session';
import type { ChatSession } from '@/lib/types/chat';
import { cn } from '@/lib/utils';

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

const SESSION_TYPE_CONFIG: Record<
  string,
  {
    Icon: typeof MessageSquare;
    color: string;
    bgGradient: string;
    ringColor: string;
  }
> = {
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

function getLastTextPreview(session: ChatSession) {
  const lastMessage = session.messages[session.messages.length - 1];
  const parts = lastMessage?.parts as Array<{ type?: string; text?: string }> | undefined;
  return parts?.find((part) => part.type === 'text' && part.text)?.text?.slice(0, 40) || '';
}

function getSceneLabel(
  session: ChatSession,
  sceneTitleMap?: Map<string, { title: string; order: number }>,
) {
  if (!session.sceneId || !sceneTitleMap?.has(session.sceneId)) return '未关联幻灯片';
  const scene = sceneTitleMap.get(session.sceneId)!;
  return `第 ${scene.order + 1} 页 · ${scene.title}`;
}

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
  return (
    <div className="space-y-1.5 px-2">
      <AnimatePresence mode="popLayout">
        {sessions.map((session) => {
          const isExpanded = expandedSessionIds.has(session.id);
          const isActive = session.status === 'active';
          const cfg = SESSION_TYPE_CONFIG[session.type] || SESSION_TYPE_CONFIG.qa;
          const { Icon } = cfg;
          const lastTextPreview = getLastTextPreview(session);
          const participantRoles = new Set(
            session.messages.map((message) => message.metadata?.originalRole || message.role),
          );

          return (
            <motion.div
              key={session.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'overflow-hidden rounded-xl border transition-all duration-200',
                isExpanded
                  ? 'border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800'
                  : isActive
                    ? `bg-gradient-to-r ${cfg.bgGradient} border-transparent shadow-sm ring-1 ${cfg.ringColor}`
                    : 'border-slate-200/60 bg-white hover:shadow-sm dark:border-slate-700/45 dark:bg-slate-800',
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onToggleExpand(session.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleExpand(session.id);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                    isExpanded ? `bg-gradient-to-br ${cfg.bgGradient} ${cfg.color}` : cfg.color,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'truncate text-[15px] font-semibold',
                        isExpanded
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'text-slate-700 dark:text-slate-200',
                      )}
                    >
                      {session.title}
                    </span>
                    {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                  </div>

                  {!isExpanded && (
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-sm text-slate-400 dark:text-slate-500">
                        {lastTextPreview || '暂无消息'}
                      </span>
                    </div>
                  )}

                  {!isExpanded && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-sky-500/75 dark:text-sky-400/75">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{getSceneLabel(session, sceneTitleMap)}</span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {!isExpanded && (
                    <>
                      {participantRoles.size > 1 && (
                        <div className="flex items-center gap-0.5 text-xs text-slate-400 dark:text-slate-500">
                          <Users className="h-3 w-3" />
                          {participantRoles.size}
                        </div>
                      )}
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-px text-xs font-medium',
                          isActive
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400',
                        )}
                      >
                        {session.messages.length}
                      </span>
                    </>
                  )}

                  {!isActive && !isExpanded && onDeleteSession && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteSession(session.id);
                        }
                      }}
                      className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-900/20"
                      title="删除会话"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}

                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500',
                      isExpanded ? 'rotate-90' : 'rotate-0',
                    )}
                  />
                </div>
              </div>

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
                      <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-sky-50/60 px-2 py-1 text-xs text-sky-500/85 dark:bg-sky-950/30 dark:text-sky-400/85">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate font-medium">
                          {getSceneLabel(session, sceneTitleMap)}
                        </span>
                      </div>
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

      {sessions.length === 0 && (
        <div className="flex h-36 flex-col items-center justify-center px-4 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/50 text-slate-400 shadow-inner dark:from-slate-800 dark:to-slate-800/50 dark:text-slate-500">
            <MessageSquare className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold text-slate-400 dark:text-slate-500">暂无对话</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">输入消息开始对话</p>
        </div>
      )}
    </div>
  );
}
