/**
 * Content Sizing Types
 *
 * Defines capacity constraints for each slide template and
 * measurement utilities for text overflow detection.
 */

import type { TemplateIdV2 } from '../types';
import type { ThemeToken } from '../types';

/** Capacity constraints for a single template */
export interface TemplateCapacity {
  templateId: TemplateIdV2;
  maxChars: number;       // Total character budget for the slide (rough)
  maxBullets: number;     // Max bullet items
  maxBulletChars: number; // Max chars per bullet
  maxLines: number;       // Estimated max lines based on font + container
  maxItems: number;       // Max sub-items (steps, grid, timeline, etc.)
}

/** Strategy for handling content overflow */
export type OverflowStrategy = 'truncate' | 'scale' | 'split' | 'warn';

/** Result of fitting content against capacity */
export interface ContentFitResult {
  fits: boolean;
  overflows: OverflowItem[];
}

/** A single overflow violation */
export interface OverflowItem {
  field: string;          // e.g. 'bodyText', 'bullets[2]', 'steps'
  actual: number;         // Actual chars / lines / items
  limit: number;
  strategy: OverflowStrategy;
}

/** Options for fixing overflow */
export interface OverflowFixOptions {
  strategy: OverflowStrategy;
  theme: ThemeToken;
}

/** Result after applying overflow fix */
export interface OverflowFixResult {
  wasFixed: boolean;
  fixes: string[];
}
