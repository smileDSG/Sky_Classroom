'use client';

import { LayoutGrid } from 'lucide-react';
import { AvatarSelector } from './avatar-selector';
import { AVATAR_CONFIGS } from '@/lib/slides/avatar-config';
import type { AvatarConfig } from '@/lib/slides/types';

interface SlidesSidebarProps {
  open: boolean;
  previewImages: string[] | null;
  activeIndex: number;
  totalPages: number;
  selectedAvatarId: string;
  onSelectAvatar: (id: string) => void;
  onSelectSlide: (index: number) => void;
}

export function SlidesSidebar({
  open,
  previewImages,
  activeIndex,
  totalPages,
  selectedAvatarId,
  onSelectAvatar,
  onSelectSlide,
}: SlidesSidebarProps) {
  return (
    <aside
      className={`flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-300 ${
        open ? 'w-60' : 'w-0 border-r-0'
      }`}
    >
      {/* Avatar selector */}
      <div
        className="flex-shrink-0 overflow-y-auto px-3 pt-3"
        style={{ maxHeight: '35%', overscrollBehavior: 'contain' }}
      >
        <AvatarSelector
          avatars={AVATAR_CONFIGS}
          selectedId={selectedAvatarId}
          onSelect={onSelectAvatar}
        />
      </div>

      <div className="mx-3 h-px flex-shrink-0 bg-slate-100 dark:bg-slate-800" />

      {/* Thumbnails */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            <LayoutGrid className="h-3.5 w-3.5" />
            幻灯片
          </span>
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {totalPages}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {previewImages?.map((img, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={i}
                onClick={() => onSelectSlide(i)}
                className={`group relative flex items-center gap-2.5 rounded-xl p-1.5 text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/[0.06] dark:bg-primary/10 ring-1 ring-primary/20 shadow-sm'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm'
                }`}
              >
                {/* Active indicator — glowing bar */}
                {isActive && (
                  <div
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #722ed1, #a855f7)',
                      boxShadow: '0 0 8px rgba(114,46,209,0.5)',
                    }}
                  />
                )}

                <div className="relative flex-shrink-0">
                  <img
                    src={img}
                    alt={`Thumb ${i + 1}`}
                    className={`h-12 w-20 rounded-lg object-cover transition-all duration-200 ${
                      isActive ? 'ring-2 ring-primary/30' : 'group-hover:scale-[1.03]'
                    }`}
                    draggable={false}
                  />
                  <span
                    className={`absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold transition-colors ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-400 ring-1 ring-slate-200 dark:ring-slate-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col">
                  <span
                    className={`text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {i === 0
                      ? '封面'
                      : i === (previewImages?.length ?? 0) - 1
                        ? '封底'
                        : `第 ${i + 1} 页`}
                  </span>
                  {isActive && (
                    <span className="text-[10px] text-primary font-medium">当前</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
