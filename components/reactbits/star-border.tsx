'use client';

import { cn } from '@/lib/utils';

/**
 * StarBorder — 复刻 React Bits 同名组件的核心手法：
 * 外层按钮 overflow-hidden + 1px 内边距，内部放一个放大约 4 倍的
 * conic-gradient 光弧层绕中心旋转，只剩 1px 边缘露光 → 星光描边。
 * 关键帧 star-spin 在 globals.css。
 */
export function StarBorder({
  children,
  className,
  innerClassName,
  beamColor = '#7dd3fc',
  speed = 3,
  ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  /** 内容层的类名（内层需要自己带圆角与背景） */
  innerClassName?: string;
  /** 光弧颜色（主色） */
  beamColor?: string;
  /** 一轮旋转时长（秒） */
  speed?: number;
}) {
  return (
    <button {...buttonProps} className={cn('relative overflow-hidden rounded-xl p-px', className)}>
      <div
        aria-hidden
        className="star-border-beam pointer-events-none"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg 320deg, ${beamColor}33 335deg, ${beamColor} 348deg, transparent 360deg)`,
          animationDuration: `${speed}s`,
        }}
      />
      <span className={cn('relative block h-full w-full rounded-[11px]', innerClassName)}>
        {children}
      </span>
    </button>
  );
}
