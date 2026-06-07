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
  { type: 'big-number', label: '大数字', desc: '中央超大数字装饰' },
  { type: 'vertical-poem', label: '竖排诗', desc: '竖排文字，传统雅致' },
  { type: 'corner-drama', label: '四角', desc: '四角装饰，戏剧张力' },
  { type: 'frame-border', label: '边框', desc: '框架式布局，经典正式' },
  { type: 'gradient-wash', label: '渐变', desc: '渐变水洗，柔和流动' },
  { type: 'double-stripe', label: '双条纹', desc: '双色条纹，动感现代' },
  { type: 'image-zone', label: '图片区', desc: '图片主导，图文叠加' },
];

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
    case 'big-number':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="8" y="4" width="24" height="10" fill={accent} opacity="0.15" rx="2" />
          <rect x="4" y="16" width="32" height="3" fill={textOnDark} opacity="0.4" rx="1" />
        </svg>
      );
    case 'vertical-poem':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="0" y="0" width="40" height="1" fill={accent} opacity="0.5" />
          <rect x="0" y="23" width="40" height="1" fill={accent} opacity="0.5" />
          <rect x="32" y="4" width="6" height="6" fill={accent} opacity="0.2" />
          <rect x="28" y="6" width="2" height="3" fill={textOnDark} opacity="0.5" />
          <rect x="24" y="6" width="2" height="3" fill={textOnDark} opacity="0.5" />
        </svg>
      );
    case 'corner-drama':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="24" y="0" width="16" height="14" fill={accent} opacity="0.2" />
          <rect x="0" y="20" width="4" height="4" fill={accent} opacity="0.3" />
          <rect x="4" y="8" width="12" height="2" fill={textOnDark} opacity="0.5" />
        </svg>
      );
    case 'frame-border':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="3" y="2" width="34" height="20" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.5" />
          <rect x="4.5" y="3.5" width="31" height="17" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.3" />
          <rect x="16" y="9" width="8" height="2" fill={textOnDark} opacity="0.5" />
        </svg>
      );
    case 'gradient-wash':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="0" y="0" width="40" height="12" fill={accent} opacity="0.1" />
          <rect x="0" y="10" width="40" height="14" fill={accent} opacity="0.08" />
          <circle cx="12" cy="8" r="3" fill={accent} opacity="0.15" />
          <rect x="14" y="10" width="12" height="2" fill={textOnDark} opacity="0.5" />
        </svg>
      );
    case 'double-stripe':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="0" y="6" width="40" height="1" fill={accent} opacity="0.5" />
          <rect x="0" y="18" width="40" height="1" fill={accent} opacity="0.5" />
          <rect x="4" y="10" width="10" height="2" fill={textOnDark} opacity="0.5" />
        </svg>
      );
    case 'image-zone':
      return (
        <svg viewBox="0 0 40 24" className="w-full h-full">
          <rect width="40" height="24" fill={coverBg} />
          <rect x="24" y="3" width="14" height="16" fill={accent} opacity="0.2" stroke={accent} strokeWidth="0.5" />
          <line x1="26" y1="5" x2="36" y2="17" stroke={accent} strokeWidth="0.3" opacity="0.4" />
          <line x1="36" y1="5" x2="26" y2="17" stroke={accent} strokeWidth="0.3" opacity="0.4" />
          <rect x="4" y="8" width="10" height="2" fill={textOnDark} opacity="0.5" />
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
  const thumbColors = useMemo(() => {
    const firstPalette = Object.values(COLOR_PALETTES)[0];
    return {
      coverBg: firstPalette ? `#${firstPalette.coverBg}` : '#1E293B',
      accent: firstPalette ? `#${firstPalette.accent}` : '#3B82F6',
      textOnDark: firstPalette ? `#${firstPalette.textOnDark}` : '#FFFFFF',
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">布局结构</span>
      <div className="grid grid-cols-6 gap-2">
        {LAYOUT_META.map(({ type, label, desc }) => {
          const isSelected = selectedLayout === type;
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={`group relative flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                isSelected
                  ? 'bg-primary/5 dark:bg-primary/10'
                  : 'hover:bg-slate-50 dark:hover:bg-gray-800'
              }`}
              title={desc}
            >
              <div
                className={`w-full h-6 rounded-md overflow-hidden shadow-sm transition-all ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
              >
                <LayoutThumbnail type={type} colors={thumbColors} />
              </div>
              <span className={`text-[10px] font-semibold ${
                isSelected ? 'text-primary' : 'text-slate-500 dark:text-gray-500'
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
