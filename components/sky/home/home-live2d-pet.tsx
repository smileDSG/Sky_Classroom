'use client';

// 主页陪伴宠物 —— Live2D 版本(替代被否的 SVG 小猫)。
// 主题联动: 亮色界面用白猫(Tororo), 暗色界面用黑猫(Hijiki)。
// 受 oml2d 限制, 宠物只能停靠在窗口右下角(无法塞进输入框盒内),
// 挂载点由 Live2DPet 内部交给 document.body, 本组件自己不占布局。
// 提供开/关开关: 右下角一个可折叠的小圆钮, 控制宠物显隐。
// 单文件、可回滚: 想要回退, 删掉主页那行挂载即可。

import { useState } from 'react';
import { useTheme } from '@/lib/hooks/use-theme';
import { Live2DPet } from '@/components/sky/pet/live2d-pet';

const CATS = {
  // 亮色 → 白猫 Tororo(本地自托管)
  light: { name: '白猫 · Tororo', path: '/live2d/tororo/tororo.model.json' },
  // 暗色 → 黑猫 Hijiki(本地自托管)
  dark: { name: '黑猫 · Hijiki', path: '/live2d/hijiki/hijiki.model.json' },
};

export function HomeLive2DPet() {
  const { resolvedTheme } = useTheme();
  const [enabled, setEnabled] = useState(true);
  const [scale, setScale] = useState(1);
  const cat = resolvedTheme === 'dark' ? CATS.dark : CATS.light;
  const MIN_SCALE = 0.3;
  const MAX_SCALE = 1.6;

  // 放大/缩小的通用小按钮样式
  const zoomBtn =
    'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 bg-white/90 border-slate-200 text-slate-600 dark:bg-slate-700/90 dark:border-slate-600 dark:text-slate-200';

  // 放大/缩小的数值限制。窗口自适应(放大到顶住窗口边缘就自动停)由 Live2DPet 内部
  // 用「锚定舞台右下角」的方式处理, 这里只做 MIN/MAX 兜底。
  const zoomTo = (target: number): number =>
    Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(target * 10) / 10));

  return (
    <>
      <Live2DPet modelPath={cat.path} modelName={cat.name} visible={enabled} draggable scale={scale} />

      {/* 缩放按键组: 右下角, 排在开关钮上方 */}
      <div className="fixed z-[9997] flex flex-col items-center gap-1.5" style={{ right: 20, bottom: 76 }}>
        <button
          type="button"
          aria-label="放大宠物"
          title="放大宠物"
          onClick={() => setScale((s) => zoomTo(s + 0.2))}
          className={zoomBtn}
        >
          +
        </button>
        <button
          type="button"
          aria-label="缩小宠物"
          title="缩小宠物"
          onClick={() => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.2) * 10) / 10))}
          className={zoomBtn}
        >
          −
        </button>
      </div>

      {/* 陪伴开关: 右下角固定小圆钮, 独立于宠物, 随时可打开/收起 */}
      <button
        type="button"
        aria-label={enabled ? '关闭陪伴宠物' : '打开陪伴宠物'}
        title={enabled ? '关闭陪伴宠物' : '打开陪伴宠物'}
        onClick={() => setEnabled((v) => !v)}
        className={
          'fixed z-[9998] flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105 active:scale-95 ' +
          (enabled
            ? 'bg-sky-500/90 border-sky-300 text-white'
            : 'bg-slate-200/80 border-slate-300 text-slate-500 dark:bg-slate-700/80 dark:border-slate-600 dark:text-slate-300')
        }
        style={{ right: 18, bottom: 18 }}
      >
        {enabled ? (
          /* 开 → 显示猫脸, 表示当前开着 */
          <svg width="18" height="18" viewBox="0 0 46 42" fill="none" aria-hidden="true">
            <circle cx="24" cy="16" r="10" fill="currentColor" />
            <circle cx="20.5" cy="15" r="2" fill="#fff" opacity="0.9" />
            <circle cx="27.5" cy="15" r="2" fill="#fff" opacity="0.9" />
            <path d="M20 20 q4 2 8 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          /* 关 → 斜杠圆圈, 表示已收起 */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M5 5l14 14" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </>
  );
}