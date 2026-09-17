'use client';

import { cn } from '@/lib/utils';

/**
 * ShinyText — 复刻 React Bits 同名组件的核心手法：
 * 背景渐变裁剪到文字上（background-clip: text），用 background-position
 * 循环位移制造一道流光扫过的效果。动画关键帧在 globals.css 的 .shiny-text。
 */
export function ShinyText({
  children,
  className,
  disabled = false,
  speed = 3,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** 一轮扫光时长（秒） */
  speed?: number;
}) {
  return (
    <span
      className={cn('shiny-text', className)}
      style={{
        animationDuration: `${speed}s`,
        animationPlayState: disabled ? 'paused' : undefined,
      }}
    >
      {children}
    </span>
  );
}
