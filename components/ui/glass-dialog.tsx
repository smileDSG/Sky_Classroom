'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface GlassDialogProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  position?: 'bottom-center' | 'bottom-right' | 'left-float' | 'right-float';
  size?: 'small' | 'medium' | 'large';
  speaker?: {
    name: string;
    avatar: string;
    role: 'teacher' | 'student' | 'user';
  } | null;
  isLoading?: boolean;
  className?: string;
}

export function GlassDialog({
  children,
  isOpen,
  onClose,
  position = 'bottom-center',
  size = 'medium',
  speaker,
  isLoading,
  className,
}: GlassDialogProps) {
  const positionStyles = {
    'bottom-center': 'bottom-8 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-8 right-8',
    'left-float': 'left-8 top-1/2 -translate-y-1/2',
    'right-float': 'right-8 top-1/2 -translate-y-1/2',
  };

  const sizeStyles = {
    small: 'max-w-xs',
    medium: 'max-w-md',
    large: 'max-w-lg',
  };

  const roleColors = {
    teacher: 'from-violet-500/30 to-fuchsia-500/30 border-violet-400/30',
    student: 'from-sky-500/30 to-cyan-500/30 border-sky-400/30',
    user: 'from-emerald-500/30 to-teal-500/30 border-emerald-400/30',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.21, 1, 0.36, 1] }}
          className={cn(
            'fixed z-50',
            positionStyles[position],
            sizeStyles[size],
            className
          )}
        >
          <div
            className={cn(
              'relative rounded-3xl overflow-hidden',
              'bg-slate-900/60 backdrop-blur-2xl',
              'border border-white/10',
              'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
              'before:absolute before:inset-0 before:rounded-3xl',
              'before:bg-gradient-to-br',
              speaker ? roleColors[speaker.role] : 'from-white/5 to-white/10',
              'before:opacity-50'
            )}
          >
            {/* Inner glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-white/[0.03] to-transparent pointer-events-none" />

            {/* Speaker header */}
            {speaker && (
              <div className="relative flex items-center gap-3 px-5 pt-4 pb-2">
                <div className="relative">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full overflow-hidden',
                      'ring-2 ring-white/20',
                      speaker.role === 'teacher' && 'ring-violet-400/50',
                      speaker.role === 'student' && 'ring-sky-400/50',
                      speaker.role === 'user' && 'ring-emerald-400/50'
                    )}
                  >
                    <img
                      src={speaker.avatar}
                      alt={speaker.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {isLoading && (
                    <div className="absolute -inset-1 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  )}
                </div>
                <span className="text-sm font-medium text-slate-200">
                  {speaker.name}
                </span>
                {isLoading && (
                  <div className="flex gap-1 ml-auto">
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-white/60"
                    />
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-white/60"
                    />
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
                      className="w-1.5 h-1.5 rounded-full bg-white/60"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="relative px-5 pb-4 text-slate-100 text-[15px] leading-relaxed">
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Floating speech bubble variant for inline use
interface SpeechBubbleProps {
  text: string;
  speaker?: {
    name: string;
    avatar: string;
    role: 'teacher' | 'student' | 'user';
  };
  isVisible: boolean;
  className?: string;
}

export function SpeechBubble({
  text,
  speaker,
  isVisible,
  className,
}: SpeechBubbleProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.21, 1, 0.36, 1] }}
      className={cn(
        'relative rounded-2xl overflow-hidden',
        'bg-slate-800/70 backdrop-blur-xl',
        'border border-white/10',
        'shadow-[0_4px_24px_-6px_rgba(0,0,0,0.4)]',
        className
      )}
    >
      {/* Gradient accent */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-px',
          speaker?.role === 'teacher' && 'bg-gradient-to-r from-transparent via-violet-400/60 to-transparent',
          speaker?.role === 'student' && 'bg-gradient-to-r from-transparent via-sky-400/60 to-transparent',
          speaker?.role === 'user' && 'bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent',
          !speaker && 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
        )}
      />

      {speaker && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <img
            src={speaker.avatar}
            alt={speaker.name}
            className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20"
          />
          <span className="text-xs font-medium text-slate-400">{speaker.name}</span>
        </div>
      )}

      <div className="px-4 py-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </motion.div>
  );
}

// Typing text effect for dialogs
interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function TypewriterText({
  text,
  speed = 30,
  onComplete,
  className,
}: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete]);

  useEffect(() => {
    setDisplayText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-4 bg-white/60 ml-0.5 align-middle"
      />
    </span>
  );
}
