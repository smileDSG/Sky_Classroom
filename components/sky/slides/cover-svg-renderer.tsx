/**
 * CoverSVGRenderer — renders a DesignDNA into a live SVG cover preview.
 *
 * Uses the same inch-based coordinate system as pptxgenjs:
 *   viewBox="0 0 13.33 7.5" (LAYOUT_WIDE)
 *
 * Font sizes are converted from pt to inches: svgFontSize = pt / 72
 * This ensures visual fidelity between SVG preview and final PPTX.
 */
'use client';

import type { DesignDNA, LayoutType } from '@/lib/slides/agent/design-dna';
import { LAYOUT_COMPONENTS } from './cover-layouts';

export interface CoverSVGRendererProps {
  designDNA: DesignDNA;
  title: string;
  subtitle: string;
  className?: string;
}

/** Convert pptxgenjs pt to SVG inches (1pt = 1/72 inch) */
export function ptToInch(pt: number): number {
  return pt / 72;
}

export interface LayoutComponentProps {
  dna: DesignDNA;
  title: string;
  subtitle: string;
}

export default function CoverSVGRenderer({
  designDNA,
  title,
  subtitle,
  className = '',
}: CoverSVGRendererProps) {
  const layoutType = (designDNA.layoutType as LayoutType) || 'hero-left';
  const LayoutComponent = LAYOUT_COMPONENTS[layoutType] || LAYOUT_COMPONENTS['hero-left'];

  return (
    <svg
      viewBox="0 0 13.33 7.5"
      className={`w-full h-full ${className}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <LayoutComponent dna={designDNA} title={title} subtitle={subtitle} />
    </svg>
  );
}
