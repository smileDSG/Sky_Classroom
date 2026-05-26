/**
 * Content Sizing Module
 *
 * Provides template capacity definitions and text overflow detection
 * for the slide generation pipeline.
 */

export type {
  TemplateCapacity,
  OverflowStrategy,
  ContentFitResult,
  OverflowItem,
  OverflowFixOptions,
  OverflowFixResult,
} from './types';

export {
  TEMPLATE_CAPACITIES,
  getTemplateCapacity,
  validateCapacityRegistry,
} from './capacity-registry';

export {
  countChars,
  estimateLines,
  estimateContentFit,
  estimateBatchContentFit,
} from './text-measurer';

export { fixSlotOverflow } from './overflow-handler';
