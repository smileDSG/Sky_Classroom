'use client';

import { cn } from '@/lib/utils';

/**
 * 手绘线稿小涂鸦 + 纸张纹理。
 * 统一给 /sky 学习区添一层"有人味"的视觉签名，替代素白卡片 / 抽象渐变的 AI 味。
 * 全部是 stroke-based 线稿，继承 currentColor，深色模式自动适配。
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 太阳（略带手绘抖动） */
export function SunDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
      style={stroke}
    >
      <circle cx="24" cy="22" r="8" />
      <path d="M24 8v-3M24 41v-3M8 22H5M43 22h-3M13 11l-2-2M37 35l-2-2M35 11l2-2M11 35l2-2" />
    </svg>
  );
}

/** 云朵 */
export function CloudDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={cn('h-5 w-5', className)} aria-hidden="true" style={stroke}>
      <path d="M12 26a6 6 0 0 1-.8-11.9 9 9 0 0 1 17.9 1A5.5 5.5 0 0 1 30 26Z" />
    </svg>
  );
}

/** 铅笔 */
export function PencilDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-5 w-5', className)} aria-hidden="true" style={stroke}>
      <path d="M14 34 6 42l2 2 8-8" />
      <path d="m40 12-4-4L18 26l-2 10 10-2z" />
      <path d="M36 8l4 4" />
    </svg>
  );
}

/** 教科书（学习路径 / 复习） */
export function BookDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" className={cn('h-5 w-5', className)} aria-hidden="true" style={stroke}>
      <path d="M8 34c8-4 16-4 24 0" />
      <path d="M16 6v28M32 6v28" />
      <path d="M8 6h24v28H8zM32 6h8v28h-8" />
      <path d="M14 12h16M14 18h16" opacity="0.55" />
    </svg>
  );
}

/** 小山 + 太阳，学习路径的终点意象 */
export function MountainDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={cn('h-5 w-5', className)} aria-hidden="true" style={stroke}>
      <path d="M6 38 24 14l10 14 7-8 17 18H6Z" />
      <path d="M50 6a8 8 0 0 1 8 8" opacity="0.7" />
    </svg>
  );
}

/** 火箭（进步 / 打卡） */
export function RocketDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-5 w-5', className)} aria-hidden="true" style={stroke}>
      <path d="M24 6c8 4 10 12 8 20-2 5-4 8-8 8s-6-3-8-8c-2-8 0-16 8-20Z" />
      <path d="M20 18a4 4 0 0 0 8 0" />
      <path d="M26 38 22 46M28 40l6 6" />
      <circle cx="24" cy="20" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 方格纸纹理：垫在卡片 / 头部后，唤起"草稿纸 / 练习本"的实感 */
export function GraphPaperBg({
  className,
  line = 'sky',
  opacity = 0.12,
}: {
  className?: string;
  line?: 'sky' | 'slate';
  opacity?: number;
}) {
  const color = line === 'sky' ? '4A90D9' : '64748b';
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M24 0H0V24' fill='none' stroke='%23${color}' stroke-opacity='${opacity}'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

/** 圆点纸纹理（更轻） */
export function DotGridBg({
  className,
  color = 'rgba(74,144,217,0.16)',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `radial-gradient(${color} 1.2px, transparent 0)`,
        backgroundSize: '18px 18px',
      }}
    />
  );
}