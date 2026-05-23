'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';

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
  sidebarWidth?: number;
}

const roleTheme = {
  teacher: {
    border: 'border-violet-400/20',
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    bar: 'bg-violet-500',
  },
  student: {
    border: 'border-sky-400/20',
    bg: 'bg-sky-500/10',
    text: 'text-sky-600',
    bar: 'bg-sky-500',
  },
  user: {
    border: 'border-emerald-400/20',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    bar: 'bg-emerald-500',
  },
};

export function AvatarSpeechPopup({
  speakingAgentId,
  sourceText,
  participants,
  sidebarWidth = 80,
}: AvatarSpeechPopupProps) {
  const { t } = useI18n();

  if (!speakingAgentId || !sourceText?.trim()) return null;

  const speaker = participants.find((p) => p.id === speakingAgentId);
  if (!speaker) return null;

  const theme = roleTheme[speaker.role];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={speakingAgentId}
        initial={{ opacity: 0, x: -20, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.9, transition: { duration: 0.25, ease: [0.21, 1, 0.36, 1] } }}
        transition={{ duration: 0.35, ease: [0.21, 1, 0.36, 1] }}
        className={cn(
          'fixed z-50 top-1/2 -translate-y-1/2',
        )}
        style={{ left: sidebarWidth + 8 }}
        role="status"
        aria-live="polite"
        aria-label="Current speaker speech"
      >
        <div
          className={cn(
            'relative rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl',
            'bg-white/95 dark:bg-slate-800/95',
            'border',
            theme.border,
          )}
        >
          {/* Arrow pointing left to avatar */}
          <div
            className={cn(
              'absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-3 rotate-45',
              'bg-white/95 dark:bg-slate-800/95',
              'border-l border-b',
              theme.border,
            )}
          />

          {/* Speaker header */}
          <div className="flex items-center gap-2 mb-2">
            <img
              src={speaker.avatar}
              alt={speaker.name}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {speaker.name}
            </span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                theme.bg,
                theme.text,
              )}
            >
              {t(`speech.role.${speaker.role}`)}
            </span>
          </div>

          {/* Message text */}
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-4">
            {sourceText}
          </p>

          {/* Speaking indicator */}
          <div className="flex items-center gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 10, 4], opacity: [0.3, 1, 0.3] }}
                aria-hidden="true"
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
                className={cn('w-1 rounded-full', theme.bar)}
              />
            ))}
            <span className="text-[10px] text-slate-400 ml-1.5">{t('speech.speaking')}</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
