'use client';

import { memo, useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export interface CoverItem {
  id: number;
  styleName: string;
  pngUrl: string | null;
  recommended: boolean;
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

/* Single cover card — memoized with 3D tilt on hover */
const CoverCard = memo(function CoverCard({
  cover,
  isSelected,
  onSelect,
  index,
}: {
  cover: CoverItem;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -10, y: x * 10 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <button
      onClick={onSelect}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col rounded-xl border text-left transition-all duration-300"
      style={{
        transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isSelected ? 1.02 : 1})`,
        borderColor: isSelected ? 'var(--celestial-dawn)' : 'transparent',
        boxShadow: isSelected
          ? '0 0 0 1px var(--celestial-dawn), 0 16px 40px -8px rgba(255,140,105,0.2)'
          : '0 1px 3px rgba(0,0,0,0.1)',
        animation: `fade-in-scale 0.4s cubic-bezier(0.22,1,0.36,1) ${index * 0.04}s both`,
        background: 'linear-gradient(180deg, rgba(11,16,33,0.8), rgba(19,24,50,0.9))',
      }}
    >
      {/* Cover preview */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-[var(--celestial-void)]">
        {cover.pngUrl ? (
          <img
            src={cover.pngUrl}
            alt={cover.styleName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--celestial-starlight)]/20 text-xs font-mono">
            渲染中...
          </div>
        )}

        {/* Recommended badge */}
        {cover.recommended && (
          <div
            className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold text-white shadow-lg"
            style={{
              background: 'linear-gradient(135deg, var(--celestial-dawn), rgba(255,140,105,0.8))',
              boxShadow: '0 2px 8px rgba(255,140,105,0.3)',
            }}
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            推荐
          </div>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div
            className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full shadow-lg"
            style={{ background: 'var(--celestial-dawn)' }}
          >
            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--celestial-void)]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[13px] font-bold truncate tracking-tight transition-colors ${
              isSelected ? 'text-[var(--celestial-starlight)]' : 'text-[var(--celestial-starlight)]/60'
            }`}
          >
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
        className="absolute inset-0 bg-[var(--celestial-void)]/70 backdrop-blur-lg"
        onClick={onClose}
        style={{ animation: 'cgFadeIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards' }}
      />

      {/* Modal */}
      <div
        className="relative z-10 flex w-full max-w-4xl max-h-[85vh] flex-col rounded-2xl overflow-hidden border border-[var(--celestial-haze)]/15"
        style={{
          animation: 'cgSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
          background: 'linear-gradient(180deg, rgba(11,16,33,0.97) 0%, rgba(19,24,50,0.95) 100%)',
          boxShadow: '0 24px 64px -16px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(245,230,200,0.05)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--celestial-haze)]/10">
          <div>
            <h2 className="text-base font-bold text-[var(--celestial-starlight)] tracking-tight">选择课件风格</h2>
            <p className="mt-0.5 text-[11px] text-[var(--celestial-starlight)]/30">
              {topic ? `AI 为"${topic}"设计了 ${covers.length} 套封面方案` : '请选择课件风格'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showRefresh && (
              <button
                onClick={onRefresh}
                className="group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--celestial-dawn)] hover:bg-[var(--celestial-dawn)]/[0.05] transition-all duration-200 hover:-translate-y-px"
              >
                <RefreshCw className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" />
                重新生成
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--celestial-starlight)]/30 hover:bg-[var(--celestial-starlight)]/[0.03] hover:text-[var(--celestial-starlight)]/60 transition-all duration-200"
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
          <CoverGrid covers={covers} onSelect={onSelect} />
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none !important; }
        .scrollbar-hide { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        @keyframes cgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cgSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
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
      {covers.map((cover, idx) => (
        <CoverCard
          key={cover.id}
          cover={cover}
          isSelected={selId === cover.id}
          onSelect={() => {
            setSelId(cover.id);
            onSelect(cover);
          }}
          index={idx}
        />
      ))}
    </div>
  );
}
