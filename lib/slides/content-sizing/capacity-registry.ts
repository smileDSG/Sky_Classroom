/**
 * Template Capacity Registry
 *
 * Defines content capacity constraints for all 37 slide templates.
 * Values are derived from actual template layout dimensions:
 *   - Canvas: 1000 × 562.5
 *   - pageMargin: 60, contentMaxWidth: 880
 *   - Body area: ~880×380 (y=140, height=380)
 *   - Title area: ~880×60 (y=50, height=60)
 *
 * Character estimates use ~0.85×fontSize avg char width for mixed CJK/Latin.
 * Line estimates use 1.5 line-height.
 */

import type { TemplateCapacity } from './types';
import type { TemplateIdV2 } from '../types';

export const TEMPLATE_CAPACITIES: Record<TemplateIdV2, TemplateCapacity> = {
  // ── Cover Templates ──
  'cover-classic': {
    templateId: 'cover-classic',
    maxChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 4,
    maxItems: 0,
  },
  'cover-modern': {
    templateId: 'cover-modern',
    maxChars: 95,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 5,
    maxItems: 0,
  },
  'cover-bold': {
    templateId: 'cover-bold',
    maxChars: 120,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 5,
    maxItems: 0,
  },
  'cover-full-image': {
    templateId: 'cover-full-image',
    maxChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 4,
    maxItems: 0,
  },
  'cover-gradient': {
    templateId: 'cover-gradient',
    maxChars: 95,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 5,
    maxItems: 0,
  },

  // ── Content Templates ──
  'content-title-body': {
    templateId: 'content-title-body',
    maxChars: 350,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 14,
    maxItems: 0,
  },
  'content-two-col': {
    templateId: 'content-two-col',
    maxChars: 500,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 16,
    maxItems: 0,
  },
  'content-bullets': {
    templateId: 'content-bullets',
    maxChars: 400,
    maxBullets: 6,
    maxBulletChars: 80,
    maxLines: 12,
    maxItems: 6,
  },
  'content-formula': {
    templateId: 'content-formula',
    maxChars: 200,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 6,
    maxItems: 0,
  },
  'content-steps': {
    templateId: 'content-steps',
    maxChars: 300,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 4,
  },
  'content-quote': {
    templateId: 'content-quote',
    maxChars: 120,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 4,
    maxItems: 0,
  },
  'content-grid2x2': {
    templateId: 'content-grid2x2',
    maxChars: 400,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 4,
  },
  'content-image': {
    templateId: 'content-image',
    maxChars: 200,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 0,
  },
  'content-table': {
    templateId: 'content-table',
    maxChars: 400,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 0, // Table capacity is row/col based; handled separately
  },
  'content-full-image': {
    templateId: 'content-full-image',
    maxChars: 150,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 5,
    maxItems: 0,
  },
  'content-timeline': {
    templateId: 'content-timeline',
    maxChars: 300,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 5,
  },
  'content-pros-cons': {
    templateId: 'content-pros-cons',
    maxChars: 500,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 16,
    maxItems: 0,
  },
  'content-code': {
    templateId: 'content-code',
    maxChars: 400,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 12,
    maxItems: 0,
  },
  'content-big-idea': {
    templateId: 'content-big-idea',
    maxChars: 250,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 0,
  },
  'content-stats': {
    templateId: 'content-stats',
    maxChars: 300,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 4,
  },
  'content-highlight': {
    templateId: 'content-highlight',
    maxChars: 250,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 0,
  },
  'content-diagram': {
    templateId: 'content-diagram',
    maxChars: 250,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 5,
  },
  'content-bar-chart': {
    templateId: 'content-bar-chart',
    maxChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 3,
    maxItems: 0,
  },
  'content-pie-chart': {
    templateId: 'content-pie-chart',
    maxChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 3,
    maxItems: 0,
  },
  'content-line-chart': {
    templateId: 'content-line-chart',
    maxChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 3,
    maxItems: 0,
  },
  'content-gradient-cards': {
    templateId: 'content-gradient-cards',
    maxChars: 400,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 4,
  },
  'content-macaron-bullets': {
    templateId: 'content-macaron-bullets',
    maxChars: 400,
    maxBullets: 6,
    maxBulletChars: 80,
    maxLines: 12,
    maxItems: 6,
  },
  'content-infographic-3': {
    templateId: 'content-infographic-3',
    maxChars: 300,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 3,
  },
  'content-process-h': {
    templateId: 'content-process-h',
    maxChars: 300,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 4,
  },
  'content-pyramid': {
    templateId: 'content-pyramid',
    maxChars: 200,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 6,
    maxItems: 3,
  },
  'content-venn': {
    templateId: 'content-venn',
    maxChars: 200,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 0,
  },
  'content-split-highlight': {
    templateId: 'content-split-highlight',
    maxChars: 250,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 10,
    maxItems: 0,
  },
  'content-toc': {
    templateId: 'content-toc',
    maxChars: 300,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 6,
  },
  'content-objectives': {
    templateId: 'content-objectives',
    maxChars: 250,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 5,
  },
  'content-section': {
    templateId: 'content-section',
    maxChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 3,
    maxItems: 0,
  },
  'content-quiz': {
    templateId: 'content-quiz',
    maxChars: 400,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 12,
    maxItems: 4,
  },

  // ── End Templates ──
  'end-summary': {
    templateId: 'end-summary',
    maxChars: 300,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 8,
    maxItems: 6,
  },
  'end-thanks': {
    templateId: 'end-thanks',
    maxChars: 50,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 2,
    maxItems: 0,
  },
  'end-qa': {
    templateId: 'end-qa',
    maxChars: 50,
    maxBullets: 0,
    maxBulletChars: 0,
    maxLines: 2,
    maxItems: 0,
  },
};

/** Get capacity for a specific template */
export function getTemplateCapacity(templateId: TemplateIdV2): TemplateCapacity | undefined {
  return TEMPLATE_CAPACITIES[templateId];
}

/** Check if every registered template has a capacity definition */
export function validateCapacityRegistry(templateIds: TemplateIdV2[]): {
  complete: boolean;
  missing: TemplateIdV2[];
} {
  const missing = templateIds.filter((id) => !TEMPLATE_CAPACITIES[id]);
  return { complete: missing.length === 0, missing };
}
