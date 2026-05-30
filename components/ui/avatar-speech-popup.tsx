'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  sidebarWidth?: number;
  speakerTop?: number | null;
  popupLeft?: number;
  dismissed?: boolean;
  onDismiss?: () => void;
  /** Portal target — defaults to document.body. Pass a PPT container ref to follow the slide. */
  container?: HTMLElement | null;
}

const roleTheme = {
  teacher: { ring: 'ring-violet-400/40', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700' },
  student: { ring: 'ring-sky-400/40', dot: 'bg-sky-500', badge: 'bg-sky-100 text-sky-700' },
  user: { ring: 'ring-emerald-400/40', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
};

export function AvatarSpeechPopup({
  speakingAgentId,
  sourceText,
  participants,
  dismissed = false,
  onDismiss,
  container,
}: AvatarSpeechPopupProps) {const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.();
  }, [onDismiss]);

  if (!mounted) return null;
  if (!speakingAgentId || !sourceText?.trim()) return null;
  if (dismissed) return null;

  const speaker = participants.find((p) => p.id === speakingAgentId);
  if (!speaker) return null;

  const theme = roleTheme[speaker.role];

  const content = (
    <div className="fixed bottom-24 left-0 right-0 flex justify-center pointer-events-none z-[99999]">
      <AnimatePresence mode="wait">
        <motion.div
          key={speakingAgentId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.2 } }}
          transition={{ duration: 0.3, ease: [0.21, 1, 0.36, 1] }}
          className="pointer-events-auto mx-4 max-w-2xl w-full group"
        >
          <div
            className={cn(
              'flex items-center gap-3 rounded-2xl px-4 py-2.5',
              'bg-transparent',
              'group-hover:bg-black/10 transition-colors duration-200',
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'w-7 h-7 rounded-full overflow-hidden ring-2 shrink-0',
                theme.ring,
              )}
            >
              <img
                src={speaker.avatar}
                alt={speaker.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Name + text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-slate-400" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {speaker.name}
                </span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                    theme.badge,
                  )}
                >
                  {speaker.role === 'teacher' ? '老师' : speaker.role === 'user' ? '你' : '学生'}
                </span>
                {/* Speaking dots */}
                <span className="flex items-center gap-0.5 ml-1">
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
                      className={cn('w-1 h-1 rounded-full', theme.dot)}
                    />
                  ))}
                </span>
              </div>
              <p className="text-base text-slate-400 leading-relaxed line-clamp-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {sourceText}
              </p>
            </div>

            {/* Close — visible on hover */}
            <button
              onClick={handleClose}
              className="shrink-0 p-1 rounded-full text-slate-400/30 group-hover:text-slate-800 group-hover:bg-slate-200/80 transition-colors"
              title="关闭字幕"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(content, container ?? document.body);
}
