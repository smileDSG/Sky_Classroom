/**
 * Cover Layout Components — SVG-based cover layout registry.
 *
 * Each layout receives { dna, title, subtitle } and renders an SVG cover
 * using the same inch-based coordinate system as pptxgenjs.
 */

export { HeroLeftCover } from './hero-left';
export { HeroCenteredCover } from './hero-centered';
export { SplitPanelCover } from './split-panel';
export { MinimalTypeCover } from './minimal-type';
export { BoldAccentCover } from './bold-accent';

import type { DesignDNA, LayoutType } from '@/lib/slides/agent/design-dna';
import type { LayoutComponentProps } from '../cover-svg-renderer';
import { HeroLeftCover } from './hero-left';
import { HeroCenteredCover } from './hero-centered';
import { SplitPanelCover } from './split-panel';
import { MinimalTypeCover } from './minimal-type';
import { BoldAccentCover } from './bold-accent';

/** Layout registry: layoutType → SVG component */
export const LAYOUT_COMPONENTS: Record<string, React.FC<LayoutComponentProps>> = {
  'hero-left': HeroLeftCover,
  'hero-centered': HeroCenteredCover,
  'split-panel': SplitPanelCover,
  'minimal-type': MinimalTypeCover,
  'bold-accent': BoldAccentCover,
};
