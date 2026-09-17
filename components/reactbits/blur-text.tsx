'use client';

import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

/**
 * BlurText — 复刻 React Bits 同名组件的核心手法：
 * 逐字从模糊中浮现（opacity 0→1 + blur 10px→0 + 轻微上移）。
 * 中文按「字符」逐个入场，英文单词内也按字符，空格用不换行空格占位。
 */
export function BlurText({
  text,
  className,
  charClassName,
  delay = 0,
  stagger = 0.04,
  duration = 0.5,
}: {
  text: string;
  className?: string;
  /** 每个字符上的额外类名（如渐变文字色） */
  charClassName?: string;
  /** 整段起始延迟（秒） */
  delay?: number;
  /** 相邻字符的时间差（秒） */
  stagger?: number;
  /** 单字符动画时长（秒） */
  duration?: number;
}) {
  return (
    <span className={cn('inline-block', className)} aria-label={text} role="text">
      {Array.from(text).map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          aria-hidden
          className={cn('inline-block will-change-[filter,transform,opacity]', charClassName)}
          initial={{ opacity: 0, filter: 'blur(10px)', y: 12 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{
            duration,
            delay: delay + index * stagger,
            ease: [0.2, 0.7, 0.3, 1],
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}
