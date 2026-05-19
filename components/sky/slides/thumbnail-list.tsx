'use client';

import type { Slide } from '@/lib/types/slides';

export interface ThumbnailListProps {
  slides: Slide[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const TYPE_ICONS: Record<string, string> = {
  cover: '✦',
  content: '▸',
  end: '◇',
};

const HTML_RE = /<[^>]*>/g;

function extractTitle(slide: Slide): string {
  for (const el of slide.elements) {
    if (el.type === 'text') {
      const textEl = el as { content?: string };
      const plain = textEl.content?.replace(HTML_RE, '').trim();
      if (plain) return plain.length > 16 ? plain.slice(0, 16) + '…' : plain;
    }
  }
  return '';
}

export function ThumbnailList({ slides, activeIndex, onSelect }: ThumbnailListProps) {
  if (slides.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          幻灯片
        </span>
        <span className="text-[10px] tabular-nums text-slate-400">
          {slides.length}
        </span>
      </div>
      <div className="scrollbar-hide -mx-1 flex max-h-[320px] flex-col gap-1 overflow-y-auto pr-0.5">
        {slides.map((slide, i) => {
          const title = extractTitle(slide);
          const icon = TYPE_ICONS[slide.type || ''] || '·';
          const active = i === activeIndex;
          return (
            <button
              key={slide.id}
              onClick={() => onSelect(i)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-200 ${
                active
                  ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-200/50'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                }`}
              >
                {i + 1}
              </span>
              <span className="truncate text-xs">
                <span className="mr-1 opacity-50">{icon}</span>
                {title || `${i + 1}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
