'use client';

import { useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChatSession, ChatMessageMetadata } from '@/lib/types/chat';
import type { UIMessage } from 'ai';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { AvatarDisplay } from '@/components/ui/avatar-display';
import { CircleStop } from 'lucide-react';
import { InlineActionTag } from './inline-action-tag';
import { useUserProfileStore } from '@/lib/store/user-profile';

interface MessagePart {
  type: string;
  text?: string;
  _partId?: string;
  actionName?: string;
  state?: string;
}

interface ChatSessionProps {
  readonly session: ChatSession;
  readonly isActive: boolean;
  readonly isStreaming?: boolean;
  readonly activeBubbleId?: string | null;
  readonly onEndSession?: (sessionId: string) => void;
}

const AVATARS = {
  teacher: '/avatars/teacher-new.jpg',
  user: '/avatars/user.png',
};

const MessageBubble = memo(function MessageBubble({
  message,
  isUser,
  isTeacher,
  isStreaming,
  isLastMessage,
  isActive,
}: {
  message: UIMessage<ChatMessageMetadata>;
  isUser: boolean;
  isTeacher: boolean;
  isStreaming: boolean;
  isLastMessage: boolean;
  isActive: boolean;
}) {
  const parts: MessagePart[] = (message.parts || []) as MessagePart[];
  const isLive = !!(isStreaming && isLastMessage);

  const hasContent = parts.some(
    (p: MessagePart) => (p.type === 'text' && p.text) || p.type?.startsWith('action-'),
  );

  // Loading dots
  if (!hasContent && isActive && message.role === 'assistant') {
    return (
      <div className="flex gap-1 items-center py-2 px-3">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:300ms]" />
      </div>
    );
  }

  if (!hasContent) return null;

  const lastTextIdx = parts.reduce(
    (acc: number, p: MessagePart, i: number) => (p.type === 'text' && p.text ? i : acc),
    -1,
  );

  return (
    <div
      className={cn(
        'inline-block px-3 py-2 rounded-2xl text-[13px] leading-relaxed max-w-[90%]',
        isUser
          ? 'bg-gradient-to-br from-violet-600 to-violet-700 dark:from-violet-500 dark:to-violet-600 text-white rounded-br-sm shadow-sm shadow-violet-300/30 dark:shadow-violet-900/50'
          : isTeacher
            ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-sm shadow-sm'
            : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200 border border-indigo-100/50 dark:border-indigo-800/50 rounded-bl-sm',
      )}
    >
      <span className="break-words">
        {parts.map((part: MessagePart, i: number) => {
          if (part.type === 'text' || part.type === 'step-start') {
            const text = part.type === 'text' ? part.text : '';
            if (!text) return null;
            const isLast = i === lastTextIdx;
            return (
              <span key={`${message.id}-${i}`}>
                {text}
                {isLive && isLast && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-50 animate-pulse ml-0.5 align-middle" />
                )}
                {message.metadata?.interrupted && isLast && !isLive && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-0.5 align-middle" />
                )}
              </span>
            );
          }

          if (part.type?.startsWith('action-')) {
            return (
              <InlineActionTag
                key={`${message.id}-action-${i}`}
                actionName={part.actionName || part.type.replace('action-', '')}
                state={part.state || 'result'}
              />
            );
          }

          return null;
        })}
      </span>
    </div>
  );
});

export function ChatSessionComponent({
  session,
  isActive,
  isStreaming,
  activeBubbleId,
  onEndSession,
}: ChatSessionProps) {
  const { t } = useI18n();
  const userProfileAvatar = useUserProfileStore((s) => s.avatar);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeBubbleRef = useRef<HTMLDivElement>(null);
  const isDiscussion = session.type === 'discussion';
  const isQA = session.type === 'qa';
  const canEnd = (isDiscussion || isQA) && session.status === 'active';
  const isEnded = session.status === 'completed' && (isDiscussion || isQA);

  const isAtBottomRef = useRef(true);
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  const msgCount = session.messages.length;
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      isAtBottomRef.current = true;
    }
  }, [msgCount]);

  const scrollRaf = useRef(0);
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [session.messages]);

  useEffect(() => {
    if (activeBubbleId && activeBubbleRef.current) {
      activeBubbleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      isAtBottomRef.current = true;
    }
  }, [activeBubbleId]);

  if (session.messages.length === 0 && !isActive) {
    return (
      <div className="h-16 flex items-center justify-center text-center px-2">
        <p className="text-xs text-slate-400 dark:text-slate-500">{t('chat.noMessages')}</p>
      </div>
    );
  }

  const endButtonText = isDiscussion ? t('chat.stopDiscussion') : t('chat.endQA');

  return (
    <div className="flex flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="space-y-1.5 overflow-y-auto scrollbar-hide py-1.5 px-1"
      >
        {session.messages.map((message, msgIdx) => {
          const isUser = message.metadata?.originalRole === 'user';
          const isTeacher = message.metadata?.originalRole === 'teacher';
          const avatar = isUser
            ? userProfileAvatar || AVATARS.user
            : message.metadata?.senderAvatar || AVATARS.teacher;
          const isActiveBubble = activeBubbleId === message.id;
          const isLastMessage = msgIdx === session.messages.length - 1;

          // Avatar ring color based on role
          const ringClass = isUser
            ? 'ring-violet-400/50 dark:ring-violet-500/40'
            : isTeacher
              ? 'ring-sky-400/50 dark:ring-sky-500/40'
              : 'ring-emerald-400/50 dark:ring-emerald-500/40';

          return (
            <motion.div
              key={message.id}
              ref={isActiveBubble ? activeBubbleRef : undefined}
              initial={{ opacity: 0, y: 6 }}
              animate={
                isActiveBubble
                  ? {
                      opacity: 1,
                      y: 0,
                      boxShadow: [
                        '0 0 0 0 rgba(139, 92, 246, 0)',
                        '0 0 16px 0 rgba(139, 92, 246, 0.12)',
                        '0 0 6px 0 rgba(139, 92, 246, 0.06)',
                      ],
                    }
                  : { opacity: 1, y: 0, boxShadow: '0 0 0 0 rgba(139, 92, 246, 0)' }
              }
              transition={
                isActiveBubble
                  ? {
                      boxShadow: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
                      default: { duration: 0.3 },
                    }
                  : { duration: 0.3 }
              }
              className={cn(
                'flex gap-2 items-start px-1 py-0.5',
                isUser && 'flex-row-reverse',
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-6 h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5 ring-2',
                ringClass,
              )}>
                <AvatarDisplay src={avatar} alt="avatar" className="text-xs" />
              </div>

              {/* Content */}
              <div className={cn('flex flex-col min-w-0', isUser && 'items-end')}>
                {/* Sender name */}
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider mb-0.5 px-0.5',
                    isUser
                      ? 'text-violet-500 dark:text-violet-400'
                      : isTeacher
                        ? 'text-sky-500 dark:text-sky-400'
                        : 'text-emerald-500 dark:text-emerald-400',
                  )}
                >
                  {(() => {
                    const agentId = message.metadata?.agentId;
                    if (agentId) {
                      const i18nName = t(`settings.agentNames.${agentId}`);
                      if (i18nName !== `settings.agentNames.${agentId}`) return i18nName;
                    }
                    return message.metadata?.senderName || t('chat.unknown');
                  })()}
                </span>

                <MessageBubble
                  message={message}
                  isUser={isUser}
                  isTeacher={isTeacher}
                  isStreaming={!!isStreaming}
                  isLastMessage={isLastMessage}
                  isActive={isActive}
                />
              </div>
            </motion.div>
          );
        })}

        {/* Session ended indicator */}
        <AnimatePresence>
          {isEnded && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mx-3 mt-3 mb-1 flex items-center gap-2"
            >
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
              <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                <CircleStop className="w-3 h-3" />
                {t('chat.ended')}
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* End Session Button */}
      <AnimatePresence>
        {canEnd && onEndSession && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => onEndSession(session.id)}
            className="mt-1 mb-2 mx-2 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm
              text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/50
              px-3 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5
              transition-all shadow-sm hover:shadow-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 dark:bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 dark:bg-red-400" />
            </span>
            {endButtonText}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
