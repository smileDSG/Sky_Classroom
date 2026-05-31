'use client';

import type { DesignDNA } from '@/lib/slides/agent/design-dna';
import { COLOR_PALETTES, FONT_PAIRS } from '@/lib/slides/agent/design-dna';
import type { Density } from '@/lib/slides/hooks/use-cover-draft';
import { ColorPicker } from './style-pickers/color-picker';
import { LayoutPicker } from './style-pickers/layout-picker';
import { FontPicker } from './style-pickers/font-picker';
import { DensityPicker } from './style-pickers/density-picker';

interface StyleLabPanelProps {
  draftDNA: DesignDNA;
  onUpdatePalette: (paletteId: string) => void;
  onUpdateLayout: (layoutType: DesignDNA['layoutType']) => void;
  onUpdateFont: (fontId: string) => void;
  onUpdateDensity: (density: Density) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Find palette ID by matching all color values */
function findPaletteId(colors: DesignDNA['colors']): string {
  for (const [id, palette] of Object.entries(COLOR_PALETTES)) {
    const match = (
      palette.coverBg.toUpperCase() === colors.coverBg.toUpperCase() &&
      palette.contentBg.toUpperCase() === colors.contentBg.toUpperCase() &&
      palette.accent.toUpperCase() === colors.accent.toUpperCase()
    );
    if (match) return id;
  }
  return 'midnight-executive';
}

/** Find font ID by matching en font name */
function findFontId(fonts: DesignDNA['fonts']): string {
  for (const [id, pair] of Object.entries(FONT_PAIRS)) {
    if (pair.en === fonts.en) return id;
  }
  return 'georgia-calibri';
}

export function StyleLabPanel({
  draftDNA,
  onUpdatePalette,
  onUpdateLayout,
  onUpdateFont,
  onUpdateDensity,
  onConfirm,
  onCancel,
}: StyleLabPanelProps) {
  const currentPaletteId = findPaletteId(draftDNA.colors);
  const currentFontId = findFontId(draftDNA.fonts);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center animate-slide-up">
      {/* Floating panel */}
      <div className="mx-4 mb-5 w-full max-w-3xl rounded-2xl bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100/60 dark:border-gray-700/60 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-gray-800/30">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 shadow-sm shadow-sky-500/20">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-gray-300 tracking-wide">风格实验室</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all active:scale-95"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:shadow-md hover:shadow-sky-500/20 transition-all active:scale-95"
            >
              确认风格
            </button>
          </div>
        </div>

        {/* Pickers */}
        <div className="grid grid-cols-2 gap-5 p-5">
          <ColorPicker selectedPaletteId={currentPaletteId} onSelect={onUpdatePalette} />
          <LayoutPicker selectedLayout={draftDNA.layoutType || 'hero-left'} onSelect={onUpdateLayout} />
          <FontPicker selectedFontId={currentFontId} onSelect={onUpdateFont} />
          <DensityPicker selectedDensity={draftDNA.decoration.density} onSelect={onUpdateDensity} />
        </div>
      </div>

    </div>
  );
}
