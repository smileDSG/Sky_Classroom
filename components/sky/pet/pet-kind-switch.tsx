'use client';

// 陪伴宠物切换条(主题猫 / VRM 人物), 重新设计版 —— 一段式玻璃胶囊 + 渐变选中态。
// 渲染在宠物「脚底下」: 嵌在各宠物舞台内部(VrmPet 直接渲染, Live2DPet 用 portal 挂进
// oml2d 舞台), 所以宠物被拖动时切换条跟着走, 不再悬在角色身上。
// data-pet-ui 是给各舞台拖拽/点击委托的标记 —— 按到切换条上的指针事件一律不算
// 「拖动宠物」或「点击宠物」, 避免点按钮时猫/人被挪走或误开小镜课堂。

import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

const ICON_CAT = (
  <svg width="14" height="14" viewBox="0 0 46 42" fill="currentColor" aria-hidden="true">
    <circle cx="15" cy="24" r="6" />
    <circle cx="31" cy="24" r="6" />
    <path d="M18 6 q-12 -4 -14 8 q-2 6 6 8 l4 -8 q14 -8 22 -10 q-6 2 -10 8 z" opacity="0.9" />
    <path d="M28 6 q12 -4 14 8 q2 6 -6 8 l-4 -8 q-14 -8 -22 -10 q6 2 10 8 z" opacity="0.9" />
  </svg>
);

const ICON_HUMAN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="6.5" r="3.5" />
    <path d="M12 11c-4 0-6 3-6 7v1h12v-1c0-4-2-7-6-7z" />
  </svg>
);

export function PetKindSwitch({ className = '' }: { className?: string }) {
  const kind = useSkyClassroomStore((s) => s.petKind);
  const setKind = useSkyClassroomStore((s) => s.setPetKind);
  const isVrm = kind === 'vrm';

  return (
    <div
      data-pet-ui
      role="group"
      aria-label="选择陪伴宠物"
      className={
        'flex items-center gap-0.5 rounded-full border p-0.5 shadow-md backdrop-blur-md select-none ' +
        'border-slate-200/70 bg-white/75 dark:border-slate-500/25 dark:bg-slate-900/65 ' +
        className
      }
    >
      <button
        type="button"
        aria-pressed={!isVrm}
        title="使用主题猫"
        onClick={() => setKind('theme')}
        className={
          'flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[11px] font-medium leading-none transition-all duration-200 active:scale-95 ' +
          (!isVrm
            ? 'bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-[0_2px_10px_rgba(56,132,255,0.35)]'
            : 'text-slate-500 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-300/10 dark:hover:text-slate-200')
        }
      >
        {ICON_CAT}猫
      </button>
      <button
        type="button"
        aria-pressed={isVrm}
        title="使用人物"
        onClick={() => setKind('vrm')}
        className={
          'flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[11px] font-medium leading-none transition-all duration-200 active:scale-95 ' +
          (isVrm
            ? 'bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-[0_2px_10px_rgba(56,132,255,0.35)]'
            : 'text-slate-500 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-300/10 dark:hover:text-slate-200')
        }
      >
        {ICON_HUMAN}人
      </button>
    </div>
  );
}
