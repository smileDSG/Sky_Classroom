import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCoverDraft } from '@/lib/slides/hooks/use-cover-draft';
import {
  getDefaultDesignDNA,
  COLOR_PALETTES,
  FONT_PAIRS,
  PALETTE_STYLE_INFO,
} from '@/lib/slides/agent/design-dna';

describe('useCoverDraft', () => {
  const defaultDNA = getDefaultDesignDNA();

  it('initial state is empty', () => {
    const { result } = renderHook(() => useCoverDraft());
    expect(result.current.suggestedCover).toBeNull();
    expect(result.current.draftDNA).toBeNull();
    expect(result.current.isSuggesting).toBe(false);
  });

  it('startSuggesting resets state and sets isSuggesting', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.startSuggesting();
    });
    expect(result.current.isSuggesting).toBe(true);
    expect(result.current.suggestedCover).toBeNull();
    expect(result.current.draftDNA).toBeNull();
  });

  it('applySuggestion sets suggestedCover and draftDNA', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });
    expect(result.current.suggestedCover).toEqual({
      pngUrl: 'http://test.png',
      designDNA: defaultDNA,
    });
    expect(result.current.draftDNA).toEqual(defaultDNA);
    expect(result.current.isSuggesting).toBe(false);
  });

  it('updatePalette changes colors', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });

    const forestPalette = COLOR_PALETTES['forest-moss'];
    act(() => {
      result.current.updatePalette('forest-moss');
    });

    expect(result.current.draftDNA?.colors.coverBg).toBe(forestPalette.coverBg);
    expect(result.current.draftDNA?.colors.accent).toBe(forestPalette.accent);
    // Other fields should remain unchanged
    expect(result.current.draftDNA?.layoutType).toBe(defaultDNA.layoutType);
  });

  it('updateLayout changes layoutType and updates motif/components', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });

    act(() => {
      result.current.updateLayout('minimal-type');
    });

    expect(result.current.draftDNA?.layoutType).toBe('minimal-type');
    // Motif should update based on layout
    expect(result.current.draftDNA?.decoration.motif).toBe('ink-wash');
  });

  it('updateFont changes fonts', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });

    const impactFont = FONT_PAIRS['impact-arial'];
    act(() => {
      result.current.updateFont('impact-arial');
    });

    expect(result.current.draftDNA?.fonts.en).toBe(impactFont.en);
    expect(result.current.draftDNA?.fonts.headingSize).toBe(impactFont.headingSize);
  });

  it('updateDensity changes decoration density', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });

    act(() => {
      result.current.updateDensity('rich');
    });

    expect(result.current.draftDNA?.decoration.density).toBe('rich');
  });

  it('confirm returns a copy of draftDNA', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });

    let confirmedDNA = null as typeof result.current.draftDNA;
    act(() => {
      confirmedDNA = result.current.confirm();
    });

    expect(confirmedDNA).toEqual(defaultDNA);
    // Should be a new object, not the same reference
    expect(confirmedDNA).not.toBe(result.current.draftDNA);
  });

  it('confirm returns null when draftDNA is null', () => {
    const { result } = renderHook(() => useCoverDraft());
    let confirmedDNA = null as typeof result.current.draftDNA;
    act(() => {
      confirmedDNA = result.current.confirm();
    });
    expect(confirmedDNA).toBeNull();
  });

  it('reset clears all state', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });
    expect(result.current.draftDNA).toBeTruthy();

    act(() => {
      result.current.reset();
    });
    expect(result.current.suggestedCover).toBeNull();
    expect(result.current.draftDNA).toBeNull();
    expect(result.current.isSuggesting).toBe(false);
  });

  it('multiple updates accumulate correctly', () => {
    const { result } = renderHook(() => useCoverDraft());
    act(() => {
      result.current.applySuggestion('http://test.png', defaultDNA);
    });

    act(() => {
      result.current.updatePalette('forest-moss');
      result.current.updateLayout('split-panel');
      result.current.updateDensity('sparse');
    });

    expect(result.current.draftDNA?.colors.coverBg).toBe(COLOR_PALETTES['forest-moss'].coverBg);
    expect(result.current.draftDNA?.layoutType).toBe('split-panel');
    expect(result.current.draftDNA?.decoration.density).toBe('sparse');
    // Palette change syncs styleName, mood, bestFor from PALETTE_STYLE_INFO
    expect(result.current.draftDNA?.styleName).toBe(PALETTE_STYLE_INFO['forest-moss'].styleName);
  });
});
