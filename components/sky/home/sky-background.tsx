'use client';

// 静态天空背景：克制、安静。不放大面积彩色渐变，不放会飘的"极光"、不点火星闪烁。
// 首屏的注意力属于输入框和内容，背景越安静，越不像"AI 签名图"。
// 只保留：一层极浅的品牌渐变 + 一道静止的顶部天光 + 顶部发丝高光。零动画。
export function SkyBackground({ simpleMode = false }: { simpleMode?: boolean }) {
  if (simpleMode) return null;
  return (
    <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* 基础渐变：明暗两态，几乎看不出色差，只是给纯底一点温度 */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" />

      {/* 静止的顶部天光：单一的柔和品牌高光，慢不慢都不动，只是打亮上方 */}
      <div className="absolute left-1/2 top-0 h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-400/[0.05]" />

      {/* 顶部发丝高光，把导航与内容区轻轻托起 */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/70 to-transparent dark:from-white/[0.03]" />
    </div>
  );
}