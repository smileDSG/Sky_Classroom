/**
 * useCoverDraft — manages the user's draft DesignDNA during style customization.
 *
 * Provides immutable updates for palette, layout, font, and density.
 * All updates produce a new DesignDNA object, triggering React re-renders
 * and SVG cover re-renders in real time.
 */
'use client';

import { useState, useCallback } from 'react';
import type { DesignDNA, LayoutType } from '@/lib/slides/agent/design-dna';
import {
  COLOR_PALETTES,
  FONT_PAIRS,
  ALLOWED_MOTIFS,
  PALETTE_STYLE_INFO,
} from '@/lib/slides/agent/design-dna';

export type Density = 'sparse' | 'moderate' | 'rich';

export interface CoverDraftState {
  suggestedCover: { pngUrl: string; designDNA: DesignDNA } | null;
  draftDNA: DesignDNA | null;
  isSuggesting: boolean;
}

export interface CoverDraftActions {
  startSuggesting: () => void;
  applySuggestion: (pngUrl: string, designDNA: DesignDNA) => void;
  updatePalette: (paletteId: string) => void;
  updateLayout: (layoutType: LayoutType) => void;
  updateFont: (fontId: string) => void;
  updateDensity: (density: Density) => void;
  confirm: () => DesignDNA | null;
  reset: () => void;
}

function getMotifForLayout(layoutType: LayoutType): string {
  const layoutToMotif: Record<string, string> = {
    'hero-left': 'geometric-lines',
    'hero-centered': 'organic-circles',
    'split-panel': 'geometric-lines',
    'minimal-type': 'ink-wash',
    'bold-accent': 'geometric-lines',
  };
  return layoutToMotif[layoutType] || 'geometric-lines';
}

function updateComponents(dna: DesignDNA, motif: string): DesignDNA['components'] {
  const safeMotif = ALLOWED_MOTIFS.includes(motif as typeof ALLOWED_MOTIFS[number])
    ? motif : 'geometric-lines';

  return {
    cardStyle: safeMotif === 'chinese-seal' ? 'accent-left-bar' :
               safeMotif === 'ink-wash' ? 'shadow-only' :
               'accent-left-bar',
    bulletStyle: safeMotif === 'chinese-seal' || safeMotif === 'ink-wash' ? 'chinese-brush' : 'dot',
    pageNumberStyle: safeMotif === 'chinese-seal' ? 'circle-number' : 'number-slash-total',
  };
}

export function useCoverDraft(): CoverDraftState & CoverDraftActions {
  const [suggestedCover, setSuggestedCover] = useState<{ pngUrl: string; designDNA: DesignDNA } | null>(null);
  const [draftDNA, setDraftDNA] = useState<DesignDNA | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const startSuggesting = useCallback(() => {
    setIsSuggesting(true);
    setSuggestedCover(null);
    setDraftDNA(null);
  }, []);

  const applySuggestion = useCallback((pngUrl: string, designDNA: DesignDNA) => {
    setSuggestedCover({ pngUrl, designDNA });
    setDraftDNA({ ...designDNA });
    setIsSuggesting(false);
  }, []);

  const updatePalette = useCallback((paletteId: string) => {
    setDraftDNA((prev) => {
      if (!prev) return null;
      const palette = COLOR_PALETTES[paletteId] ?? COLOR_PALETTES['midnight-executive'];
      const styleInfo = PALETTE_STYLE_INFO[paletteId] ?? PALETTE_STYLE_INFO['midnight-executive'];
      return {
        ...prev,
        colors: { ...palette },
        styleName: styleInfo.styleName,
        mood: styleInfo.mood,
        bestFor: [...styleInfo.bestFor],
      };
    });
  }, []);

  const updateLayout = useCallback((layoutType: LayoutType | undefined) => {
    if (!layoutType) return;
    setDraftDNA((prev) => {
      if (!prev) return null;
      const motif = getMotifForLayout(layoutType);
      const components = updateComponents(prev, motif);
      return {
        ...prev,
        layoutType,
        decoration: { ...prev.decoration, motif: motif as DesignDNA['decoration']['motif'] },
        components,
      };
    });
  }, []);

  const updateFont = useCallback((fontId: string) => {
    setDraftDNA((prev) => {
      if (!prev) return null;
      const fonts = FONT_PAIRS[fontId] ?? FONT_PAIRS['georgia-calibri'];
      return { ...prev, fonts: { ...fonts } };
    });
  }, []);

  const updateDensity = useCallback((density: Density) => {
    setDraftDNA((prev) => {
      if (!prev) return null;
      return { ...prev, decoration: { ...prev.decoration, density } };
    });
  }, []);

  const confirm = useCallback((): DesignDNA | null => {
    return draftDNA ? { ...draftDNA } : null;
  }, [draftDNA]);

  const reset = useCallback(() => {
    setSuggestedCover(null);
    setDraftDNA(null);
    setIsSuggesting(false);
  }, []);

  return {
    suggestedCover,
    draftDNA,
    isSuggesting,
    startSuggesting,
    applySuggestion,
    updatePalette,
    updateLayout,
    updateFont,
    updateDensity,
    confirm,
    reset,
  };
}
