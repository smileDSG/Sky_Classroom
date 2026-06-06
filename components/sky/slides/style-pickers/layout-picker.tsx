'use client';

import { useMemo } from 'react';
import type { LayoutType } from '@/lib/slides/agent/design-dna';
import { COLOR_PALETTES } from '@/lib/slides/agent/design-dna';

interface LayoutPickerProps {
  selectedLayout: LayoutType;
  onSelect: (layout: LayoutType) => void;
}

const LAYOUT_META: { type: LayoutType; label: string; desc: string }[] = [
  { type: 'hero-left', label: '左对齐', desc: '文本左置，右侧装饰' },
  { type: 'hero-centered', label: '居中', desc: '标题居中，装饰散落' },
  { type: 'split-panel', label: '分割', desc: '左右分屏，对比鲜明' },
  { type: 'minimal-type', label: '极简', desc: '纯排版，留白充分' },
  { type: 'bold-accent', label: '色带', desc: '顶部粗色带，视觉冲击' },
];

/** Minimal SVG thumbnail for each layout type */
function LayoutThumbnail({ type, colors }: { type: LayoutType; colors: { coverBg: string; accent: string; textOnDark: string } }) {
  const { coverBg, accent, textOnDark } = colors;

  switch (type) {
    case 'hero-left':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="28" width="12" height="24" fill={accent} opacity="0.3" />
          <rect x="4" y="8" width="12" height="2" fill={textOnDark} opacity="0.6" />
          <rect x="4" y="12" width="8" height="1.5" fill={textOnDark} opacity="0.4" />
        </svg>
      );
    case 'hero-centered':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="12" y="8" width="16" height="2" fill={textOnDark} opacity="0.6" />
          <rect x="14" y="12" width="12" height="1.5" fill={textOnDark} opacity="0.4" />
        </svg>
      );
    case 'split-panel':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect width="18" height="24" fill={coverBg} opacity="0.7" />
          <rect x="18" width="1" height="24" fill={accent} />
        </svg>
      );
    case 'minimal-type':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="10" y="8" width="20" height="2" fill={textOnDark} opacity="0.6" />
          <line x1="16" y1="13" x2="24" y2="13" stroke={accent} strokeWidth="0.5" />
        </svg>
      );
    case 'bold-accent':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect width="40" height="4" fill={accent} opacity="0.5" />
          <rect x="4" y="10" width="12" height="2" fill={textOnDark} opacity="0.6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
        </svg>
      );
  }
}

export function LayoutPicker({ selectedLayout, onSelect }: LayoutPickerProps) {
  // Derive accent colors from current palette for live thumbnail theming
  const thumbColors = useMemo(() => {
    const firstPalette = Object.values(COLOR_PALETTES)[0];
    return {
      coverBg: firstPalette ? `#${firstPalette.coverBg}` : '#1E293B',
      accent: firstPalette ? `#${firstPalette.accent}` : '#3B82F6',
      textOnDark: firstPalette ? `#${firstPalette.textOnDark}` : '#FFFFFF',
    };
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">布局结构</span>
      <div className="flex gap-2">
        {LAYOUT_META.map(({ type, label, desc }) => {
          const isSelected = selectedLayout === type;
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-2 w-[4.5rem] transition-all duration-200 ${
                isSelected
                  ? 'bg-sky-50/80 dark:bg-sky-900/20'
                  : 'hover:bg-slate-50 dark:hover:bg-gray-800'
              }`}
              title={desc}
            >
              <div
                className={`w-10 h-6 rounded-lg overflow-hidden shadow-sm transition-all duration-300 ${
                  isSelected ? 'ring-2 ring-sky-400 scale-105 shadow-md' : 'group-hover:scale-105 group-hover:shadow-md'
                }`}
              >
                <LayoutThumbnail type={type} colors={thumbColors} />
              </div>
              <span className={`text-[9px] font-semibold ${
                isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-gray-500'
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
