'use client';

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AvatarSpeechPopupProps {
  speakingAgentId: string | null | undefined;
  sourceText: string | null | undefined;
  participants: Array<{
    id: string;
    avatar: string;
    name: string;
    role: 'teacher' | 'student' | 'user';
    color?: string;
  }>;
  dismissed?: boolean;
  onDismiss?: () => void;
  container?: HTMLElement | null;
  anchorRefMap?: MutableRefObject<Map<string, HTMLDivElement>>;
  mode?: 'bottom' | 'avatar';
}

const roleTheme = {
  teacher: {
    ring: 'ring-violet-400/40',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
  },
  student: {
    ring: 'ring-sky-400/40',
    dot: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700',
  },
  user: {
    ring: 'ring-emerald-400/40',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
};

export function AvatarSpeechPopup({
  speakingAgentId,
  sourceText,
  participants,
  dismissed = false,
  onDismiss,
  container,
  anchorRefMap,
  mode = 'bottom',
}: AvatarSpeechPopupProps) {
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss?.();
    },
    [onDismiss],
  );

  if (typeof document === 'undefined') return null;
  if (!speakingAgentId || !sourceText?.trim()) return null;
  if (dismissed) return null;

  const speaker = participants.find((p) => p.id === speakingAgentId);
  if (!speaker) return null;

  const theme = roleTheme[speaker.role];
  const anchorRect =
    mode === 'avatar'
      ? (anchorRefMap?.current.get(speakingAgentId)?.getBoundingClientRect() ?? null)
      : null;
  const useAvatarPlacement = mode === 'avatar' && !!anchorRect;
  const avatarPopupWidth = 252;
  const avatarPopupMaxHeight = 260;
  const avatarRailLeft = 82;

  const content = (
    <div
      className={cn(
        'pointer-events-none fixed z-[99999] flex',
        useAvatarPlacement ? 'justify-start' : 'bottom-24 left-0 right-0 justify-center',
      )}
      style={
        useAvatarPlacement
          ? {
              left: Math.max(
                16,
                Math.min(avatarRailLeft, window.innerWidth - avatarPopupWidth - 16),
              ),
              top: Math.max(
                76,
                Math.min(anchorRect.top - 8, window.innerHeight - avatarPopupMaxHeight - 24),
              ),
            }
          : undefined
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={speakingAgentId}
          initial={{
            opacity: 0,
            x: useAvatarPlacement ? -8 : 0,
            y: useAvatarPlacement ? 0 : 12,
          }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{
            opacity: 0,
            x: useAvatarPlacement ? -8 : 0,
            y: useAvatarPlacement ? 0 : 12,
            transition: { duration: 0.2 },
          }}
          transition={{ duration: 0.3, ease: [0.21, 1, 0.36, 1] }}
          className={cn(
            'pointer-events-auto group',
            useAvatarPlacement ? 'w-[min(252px,calc(100vw-6rem))]' : 'mx-4 w-full max-w-2xl',
          )}
        >
          <div
            className={cn(
              'flex items-start gap-2 rounded-2xl px-2.5 py-2',
              useAvatarPlacement
                ? 'border border-white/80 bg-white/90 shadow-[0_18px_48px_rgba(14,116,144,0.18)] backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/90'
                : 'bg-transparent transition-colors duration-200 group-hover:bg-black/10',
            )}
          >
            <div className={cn('h-7 w-7 shrink-0 overflow-hidden rounded-xl ring-2', theme.ring)}>
              <img src={speaker.avatar} alt={speaker.name} className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    useAvatarPlacement ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400',
                  )}
                  style={
                    useAvatarPlacement ? undefined : { textShadow: '0 1px 2px rgba(0,0,0,0.3)' }
                  }
                >
                  {speaker.name}
                </span>
                <span
                  className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', theme.badge)}
                >
                  {speaker.role === 'teacher' ? '老师' : speaker.role === 'user' ? '我' : '学生'}
                </span>
                <span className="ml-1 flex items-center gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: 'easeInOut',
                      }}
                      className={cn('h-1 w-1 rounded-full', theme.dot)}
                    />
                  ))}
                </span>
              </div>
              <p
                className={cn(
                  'leading-relaxed',
                  useAvatarPlacement
                    ? 'mt-1 max-h-[min(34vh,190px)] overflow-y-auto pr-1 text-[13px] text-slate-700 dark:text-slate-300'
                    : 'line-clamp-2 text-base text-slate-400',
                )}
                style={useAvatarPlacement ? undefined : { textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              >
                {sourceText}
              </p>
            </div>

            <button
              onClick={handleClose}
              className={cn(
                'shrink-0 rounded-full p-1 transition-colors',
                useAvatarPlacement
                  ? 'text-slate-400 hover:bg-sky-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  : 'text-slate-400/30 group-hover:bg-slate-200/80 group-hover:text-slate-800',
              )}
              title="关闭字幕"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(content, container ?? document.body);
}
