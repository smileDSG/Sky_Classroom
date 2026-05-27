'use client';

import { memo, useState, useEffect } from 'react';

export interface CoverItem {
  id: number;
  styleName: string;
  pngUrl: string | null;
  recommended: boolean;
  replaced: boolean;
  designParams?: unknown;
}

interface CoverGalleryProps {
  open: boolean;
  topic: string;
  covers: CoverItem[];
  showRefresh: boolean;
  onSelect: (cover: CoverItem) => void;
  onRefresh: () => void;
  onClose: () => void;
}

/* Single cover card — memoized */
const CoverCard = memo(function CoverCard({
  cover,
  isSelected,
  onSelect,
}: {
  cover: CoverItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col rounded-xl border text-left transition-all duration-200 ${
        isSelected
          ? 'border-sky-400 dark:border-sky-500 shadow-lg shadow-sky-500/20 scale-[1.02]'
          : 'border-transparent hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-md'
      }`}
    >
      {/* Cover preview */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-gray-800">
        {cover.pngUrl ? (
          <img
            src={cover.pngUrl}
            alt={cover.styleName}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-gray-500 text-xs">
            渲染中...
          </div>
        )}

        {/* Recommended badge */}
        {cover.recommended && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            推荐
          </div>
        )}

        {/* Replaced indicator (fallback) */}
        {cover.replaced && (
          <div className="absolute top-2 right-2 rounded-md bg-amber-500/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
            降级
          </div>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 shadow-md">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[13px] font-bold truncate tracking-tight ${isSelected ? 'text-slate-800 dark:text-gray-100' : 'text-slate-700 dark:text-gray-300'}`}>
            {cover.styleName}
          </span>
        </div>
      </div>
    </button>
  );
});

/* ─── Main Component ─── */
export function CoverGallery({ open, topic, covers, showRefresh, onSelect, onRefresh, onClose }: CoverGalleryProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
        onClick={onClose}
        style={{ animation: 'cgFadeIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards' }}
      />

      {/* Modal */}
      <div
        className="relative z-10 flex w-full max-w-4xl max-h-[85vh] flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl shadow-slate-900/20 overflow-hidden"
        style={{ animation: 'cgSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/80 dark:border-gray-700/80 bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-gray-100 tracking-tight">选择课件风格</h2>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-gray-500">
              {topic ? `AI 为"${topic}"设计了 ${covers.length} 套封面方案` : '请选择课件风格'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showRefresh && (
              <button
                onClick={onRefresh}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all duration-200"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重新生成推荐模板
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-200 transition-all duration-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Grid */}
        <div
          className="flex-1 overflow-y-auto p-5 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Use local selected state */}
          <CoverGrid covers={covers} onSelect={onSelect} />
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none !important; }
        .scrollbar-hide { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        @keyframes cgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cgSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}

/* Inner grid with local selection state */
function CoverGrid({
  covers,
  onSelect,
}: {
  covers: CoverItem[];
  onSelect: (cover: CoverItem) => void;
}) {
  const recId = covers.find((c) => c.recommended)?.id || covers[0]?.id || null;
  const [selId, setSelId] = useState<number | null>(recId);

  useEffect(() => {
    const newRec = covers.find((c) => c.recommended)?.id || covers[0]?.id || null;
    setSelId(newRec);
  }, [covers]);

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {covers.map((cover) => (
        <CoverCard
          key={cover.id}
          cover={cover}
          isSelected={selId === cover.id}
          onSelect={() => {
            setSelId(cover.id);
            onSelect(cover);
          }}
        />
      ))}
    </div>
  );
}
