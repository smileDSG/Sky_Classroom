'use client';

import type { PptxThemeId } from '@/lib/slides/types';
import { getTheme } from '@/lib/slides/pptx-themes';

export interface ThemePreviewCardProps {
  themeId: PptxThemeId;
  selected: boolean;
  onSelect: (id: PptxThemeId) => void;
}

export function ThemePreviewCard({ themeId, selected, onSelect }: ThemePreviewCardProps) {
  const theme = getTheme(themeId);

  return (
    <button
      onClick={() => onSelect(themeId)}
      className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-300 ${
        selected
          ? 'border-blue-400/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 ring-1 ring-blue-200/60 shadow-sm shadow-blue-100/50'
          : 'border-slate-200/60 bg-white/60 hover:border-slate-300/80 hover:bg-white hover:shadow-md hover:shadow-slate-100/50 hover:-translate-y-0.5'
      }`}
    >
      {/* Color swatch with gradient */}
      <div
        className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-black/5 shadow-sm"
        style={{
          background: theme.coverBgGradient
            ? `linear-gradient(${theme.coverBgGradient.angle}deg, ${theme.coverBgGradient.from}, ${theme.coverBgGradient.to})`
            : theme.coverBg,
        }}
      >
        {/* Mini accent stripe */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1.5"
          style={{ background: theme.accent }}
        />
      </div>

      {/* Theme name */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`truncate text-[12px] font-bold ${selected ? 'text-blue-700' : 'text-slate-700'}`}
        >
          {theme.name}
        </span>
        <span className="truncate text-[10px] text-slate-400">{theme.description}</span>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow-md shadow-blue-200/50">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
