'use client';

import { COLOR_PALETTES, CURATED_PALETTE_IDS } from '@/lib/slides/agent/design-dna';

interface ColorPickerProps {
  selectedPaletteId: string;
  onSelect: (paletteId: string) => void;
}

const PALETTE_META: Record<string, { label: string; desc: string }> = {
  'modern-academic': { label: '现代学术', desc: '权威克制' },
  'midnight-executive': { label: '商务蓝', desc: '专业稳重' },
  'forest-moss': { label: '森林绿', desc: '自然清新' },
  'coral-energy': { label: '珊瑚橙', desc: '活力热情' },
  'warm-terracotta': { label: '陶土红', desc: '温暖人文' },
  'ocean-gradient': { label: '海洋蓝', desc: '科技冷静' },
  'charcoal-minimal': { label: '炭灰黑', desc: '极简现代' },
  'teal-trust': { label: '青绿', desc: '可信稳重' },
  'berry-cream': { label: '浆果紫', desc: '优雅柔和' },
  'sage-calm': { label: '鼠尾草', desc: '平静治愈' },
  'cherry-bold': { label: '樱桃红', desc: '醒目大胆' },
  'classical-chinese': { label: '中式古典', desc: '传统雅致' },
  'tech-dark-cn': { label: '科技深蓝', desc: '深邃科技' },
};

export function ColorPicker({ selectedPaletteId, onSelect }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <svg
          className="h-3.5 w-3.5 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
        <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
          配色方案
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {Object.entries(COLOR_PALETTES)
          .filter(([id]) => CURATED_PALETTE_IDS.includes(id))
          .map(([id, palette]) => {
          const meta = PALETTE_META[id] || { label: id, desc: '' };
          const isSelected = selectedPaletteId === id;
          const coverBg = palette.coverBg.startsWith('#') ? palette.coverBg : `#${palette.coverBg}`;
          const accent = palette.accent.startsWith('#') ? palette.accent : `#${palette.accent}`;
          const contentBg = palette.contentBg.startsWith('#')
            ? palette.contentBg
            : `#${palette.contentBg}`;

          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`group relative flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors ${
                isSelected
                  ? 'bg-slate-50 dark:bg-gray-800'
                  : 'hover:bg-slate-50 dark:hover:bg-gray-800'
              }`}
              title={meta.desc}
            >
              <div className="relative">
                <div
                  className="h-8 w-10 rounded-md transition-transform"
                  style={{
                    backgroundColor: coverBg,
                    boxShadow: isSelected
                      ? `0 0 0 2px white, 0 0 0 3px ${accent}`
                      : `inset 0 0 0 1px rgba(0,0,0,0.08)`,
                  }}
                >
                  <div
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-tl-sm rounded-br-md"
                    style={{ backgroundColor: accent }}
                  />
                  <div
                    className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full ring-1 ring-white/40"
                    style={{ backgroundColor: contentBg }}
                  />
                </div>
                {isSelected && (
                  <div
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900"
                    style={{ backgroundColor: accent }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-semibold truncate w-full text-center ${
                  isSelected
                    ? 'text-slate-700 dark:text-gray-200'
                    : 'text-slate-500 dark:text-gray-500'
                }`}
              >
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
