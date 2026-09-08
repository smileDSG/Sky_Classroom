'use client';

import type { DesignDNA } from '@/lib/slides/agent/design-dna';
import type { Density } from '@/lib/slides/hooks/use-cover-draft';
import { ColorPicker } from './style-pickers/color-picker';
import { LayoutPicker } from './style-pickers/layout-picker';
import { FontPicker } from './style-pickers/font-picker';
import { DensityPicker } from './style-pickers/density-picker';
import { COLOR_PALETTES, FONT_PAIRS } from '@/lib/slides/agent/design-dna';

interface StyleLabPanelProps {
  draftDNA: DesignDNA;
  onUpdatePalette: (paletteId: string) => void;
  onUpdateLayout: (layoutType: DesignDNA['layoutType']) => void;
  onUpdateFont: (fontId: string) => void;
  onUpdateDensity: (density: Density) => void;
}

function findPaletteId(colors: DesignDNA['colors']): string {
  for (const [id, palette] of Object.entries(COLOR_PALETTES)) {
    const match =
      palette.coverBg.toUpperCase() === colors.coverBg.toUpperCase() &&
      palette.contentBg.toUpperCase() === colors.contentBg.toUpperCase() &&
      palette.accent.toUpperCase() === colors.accent.toUpperCase();
    if (match) return id;
  }
  return 'midnight-executive';
}

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
}: StyleLabPanelProps) {
  const currentPaletteId = findPaletteId(draftDNA.colors);
  const currentFontId = findFontId(draftDNA.fonts);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-5">
        <ColorPicker selectedPaletteId={currentPaletteId} onSelect={onUpdatePalette} />
        <LayoutPicker
          selectedLayout={draftDNA.layoutType || 'hero-left'}
          onSelect={onUpdateLayout}
        />
        <FontPicker selectedFontId={currentFontId} onSelect={onUpdateFont} />
        <DensityPicker selectedDensity={draftDNA.decoration.density} onSelect={onUpdateDensity} />
      </div>
    </div>
  );
}
