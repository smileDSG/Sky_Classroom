'use client';

import { PPTX_THEMES } from '@/lib/slides/pptx-themes';
import type { PptxThemeId } from '@/lib/slides/pptx-themes';

export interface ThemePickerProps {
  selected: PptxThemeId;
  onSelect: (id: PptxThemeId) => void;
}

const DOT_COLORS: Record<PptxThemeId, string> = {
  'sky-blue': '#5b9bd5',
  minimal: '#e5e5e5',
  academic: '#C41E3A',
  'tech-dark': '#475569',
  'nature-fresh': '#22c55e',
  'macaron-pink': '#ee82b2',
};

/** Themes that use real PPTX templates */
const TEMPLATE_THEMES: PptxThemeId[] = ['sky-blue', 'minimal', 'academic', 'tech-dark', 'nature-fresh', 'macaron-pink'];

const THEME_LIST = Object.values(PPTX_THEMES);

export function ThemePicker({ selected, onSelect }: ThemePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        导出主题
      </span>
      <div className="flex gap-2">
        {THEME_LIST.map((theme) => {
          const active = theme.id === selected;
          return (
            <button
              key={theme.id}
              onClick={() => onSelect(theme.id)}
              title={theme.description}
              className={`relative flex flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition-all duration-300 ${
                active
                  ? 'bg-gradient-to-b from-blue-50 to-indigo-50/50 ring-1 ring-blue-200/60 shadow-sm shadow-blue-100/50'
                  : 'hover:bg-slate-50/80 hover:shadow-sm'
              }`}
            >
              {TEMPLATE_THEMES.includes(theme.id) && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-white shadow-sm">
                  ✦
                </span>
              )}
              <span
                className={`h-6 w-6 rounded-full border shadow-sm transition-all duration-300 ${
                  active ? 'ring-2 ring-blue-300/50 ring-offset-2 ring-offset-white scale-110' : ''
                }`}
                style={{
                  background: DOT_COLORS[theme.id],
                  borderColor: active ? 'transparent' : 'rgba(0,0,0,0.08)',
                }}
              />
              <span className={`text-[11px] font-bold ${active ? 'text-blue-700' : 'text-slate-500'}`}>
                {theme.name}
              </span>
            </button>
          );
        })}
      </div>
      {TEMPLATE_THEMES.includes(selected) && (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
          <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span>此主题使用真实 PPTX 模板导出，保留原始视觉效果</span>
        </div>
      )}
    </div>
  );
}
