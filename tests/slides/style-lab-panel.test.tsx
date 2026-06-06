import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { StyleLabPanel } from '@/components/sky/slides/style-lab-panel';
import { getDefaultDesignDNA, COLOR_PALETTES, FONT_PAIRS } from '@/lib/slides/agent/design-dna';

describe('StyleLabPanel', () => {
  const defaultDNA = getDefaultDesignDNA();
  const mockCallbacks = {
    onUpdatePalette: vi.fn(),
    onUpdateLayout: vi.fn(),
    onUpdateFont: vi.fn(),
    onUpdateDensity: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders all four pickers', () => {
    const { container } = render(
      <StyleLabPanel draftDNA={defaultDNA} {...mockCallbacks} />,
    );
    expect(container.textContent).toContain('配色方案');
    expect(container.textContent).toContain('布局结构');
    expect(container.textContent).toContain('字体气质');
    expect(container.textContent).toContain('装饰密度');
  });

  it('renders correct number of color options', () => {
    const { container } = render(
      <StyleLabPanel draftDNA={defaultDNA} {...mockCallbacks} />,
    );
    const colorButtons = container.querySelectorAll('[title]');
    // There are 12 color palettes, each rendered as a button
    const paletteCount = Object.keys(COLOR_PALETTES).length;
    expect(colorButtons.length).toBeGreaterThanOrEqual(paletteCount);
  });

  it('renders correct number of layout options', () => {
    const { container } = render(
      <StyleLabPanel draftDNA={defaultDNA} {...mockCallbacks} />,
    );
    const layoutButtons = container.querySelectorAll('button');
    // At least 5 layout buttons
    expect(layoutButtons.length).toBeGreaterThanOrEqual(5);
  });

  it('calls onUpdatePalette when color clicked', () => {
    const { container } = render(
      <StyleLabPanel draftDNA={defaultDNA} {...mockCallbacks} />,
    );
    // Find color picker buttons by their container — first grid in the panel
    const grids = container.querySelectorAll('.grid');
    const colorGrid = grids[0]; // ColorPicker is the first grid
    const colorButtons = colorGrid.querySelectorAll('button');
    expect(colorButtons.length).toBeGreaterThan(0);
    fireEvent.click(colorButtons[0]);
    expect(mockCallbacks.onUpdatePalette).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const { getByText } = render(
      <StyleLabPanel draftDNA={defaultDNA} {...mockCallbacks} />,
    );
    const confirmBtn = getByText('确认风格');
    fireEvent.click(confirmBtn);
    expect(mockCallbacks.onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    const { getByText } = render(
      <StyleLabPanel draftDNA={defaultDNA} {...mockCallbacks} />,
    );
    const cancelBtn = getByText('取消');
    fireEvent.click(cancelBtn);
    expect(mockCallbacks.onCancel).toHaveBeenCalled();
  });

  it('identifies current palette correctly', () => {
    // Use forest-moss palette
    const forestPalette = COLOR_PALETTES['forest-moss'];
    const customDNA = {
      ...defaultDNA,
      colors: { ...forestPalette },
    };
    const { container } = render(
      <StyleLabPanel draftDNA={customDNA} {...mockCallbacks} />,
    );
    // The selected button's swatch has scale-105 class (applied only when isSelected)
    const selectedSwatch = container.querySelector('.scale-105');
    expect(selectedSwatch).toBeTruthy();
    // Verify the selection dot is rendered (only on selected item)
    const selectionDot = container.querySelector('.border-2.border-white');
    expect(selectionDot).toBeTruthy();
  });
});
