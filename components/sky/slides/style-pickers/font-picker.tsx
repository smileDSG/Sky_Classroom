'use client';

import { FONT_PAIRS } from '@/lib/slides/agent/design-dna';

interface FontPickerProps {
  selectedFontId: string;
  onSelect: (fontId: string) => void;
}

interface FontMeta {
  label: string;
  desc: string;
  cnPreview: string;
  enPreview: string;
  sample: string;
}

const FONT_META: Record<string, FontMeta> = {
  'noto-sans': {
    label: '思源黑体',
    desc: '思源黑体，现代学术',
    cnPreview: '学',
    enPreview: 'Aa',
    sample: '思源黑体 · 现代学术',
  },
  'georgia-calibri': {
    label: '经典宋体',
    desc: '宋体衬线，典雅古典',
    cnPreview: '宋',
    enPreview: 'Aa',
    sample: '宋体衬线 · 古典雅致',
  },
  'arial-black-arial': {
    label: '粗黑现代',
    desc: '黑体无衬，稳重现代',
    cnPreview: '黑',
    enPreview: 'Aa',
    sample: '黑体无衬 · 现代稳重',
  },
  'calibri-light': {
    label: '清晰无衬',
    desc: '苹方轻量，清晰通透',
    cnPreview: '清',
    enPreview: 'Aa',
    sample: '苹方轻量 · 清晰通透',
  },
  'cambria-calibri': {
    label: '学术衬线',
    desc: '仿宋衬线，书卷学术',
    cnPreview: '仿',
    enPreview: 'Aa',
    sample: '仿宋衬线 · 书卷学术',
  },
  'impact-arial': {
    label: '冲击力',
    desc: '黑体粗重，醒目有力',
    cnPreview: '力',
    enPreview: 'Aa',
    sample: '黑体粗重 · 醒目有力',
  },
};

export function FontPicker({ selectedFontId, onSelect }: FontPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
        字体气质
      </span>
      <div className="grid grid-cols-5 gap-1.5">
        {Object.entries(FONT_PAIRS).map(([id, font]) => {
          const meta = FONT_META[id];
          const isSelected = selectedFontId === id;
          const cnStack = font.headingStack || font.heading;
          const enStack = font.en;

          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`group relative flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-colors ${
                isSelected
                  ? 'bg-primary/5 dark:bg-primary/10'
                  : 'hover:bg-slate-50 dark:hover:bg-gray-800'
              }`}
              title={meta?.desc}
            >
              <div className="relative flex items-baseline gap-0.5 h-7">
                <span
                  className={`text-xl font-bold leading-none ${
                    isSelected ? 'text-primary' : 'text-slate-700 dark:text-gray-300'
                  }`}
                  style={{ fontFamily: cnStack }}
                >
                  {meta?.cnPreview ?? '字'}
                </span>
                <span
                  className={`text-[10px] font-bold leading-none ${
                    isSelected ? 'text-primary/70' : 'text-slate-400/70 dark:text-gray-500/70'
                  }`}
                  style={{ fontFamily: enStack }}
                >
                  {meta?.enPreview ?? 'Aa'}
                </span>
              </div>

              <span
                className={`text-[10px] font-semibold ${
                  isSelected ? 'text-primary' : 'text-slate-500 dark:text-gray-500'
                }`}
              >
                {meta?.label ?? id}
              </span>

              {isSelected && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
