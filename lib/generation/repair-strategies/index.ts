/**
 * Default extraction and repair strategies.
 *
 * Order is significant:
 * 1. Extraction: code-block → json-window
 * 2. Repair: quoted-property → latex → invalid-escape → truncated → control-char → jsonrepair
 */

export type { RepairStrategy, ExtractionStrategy, RepairContext, RepairResult } from './types';

export { codeBlockExtractor } from './code-block-extractor';
export { jsonWindowExtractor } from './json-window-extractor';
export { quotedPropertyFixer } from './quoted-property-fixer';
export { latexEscapeFixer } from './latex-escape-fixer';
export { invalidEscapeFixer } from './invalid-escape-fixer';
export { truncatedJsonFixer } from './truncated-json-fixer';
export { controlCharFixer } from './control-char-fixer';
export { jsonrepairFixer } from './jsonrepair-fixer';

import type { ExtractionStrategy, RepairStrategy } from './types';
import { codeBlockExtractor } from './code-block-extractor';
import { jsonWindowExtractor } from './json-window-extractor';
import { quotedPropertyFixer } from './quoted-property-fixer';
import { latexEscapeFixer } from './latex-escape-fixer';
import { invalidEscapeFixer } from './invalid-escape-fixer';
import { truncatedJsonFixer } from './truncated-json-fixer';
import { controlCharFixer } from './control-char-fixer';
import { jsonrepairFixer } from './jsonrepair-fixer';

export const DEFAULT_EXTRACTION_STRATEGIES: ExtractionStrategy[] = [
  codeBlockExtractor,
  jsonWindowExtractor,
];

export const DEFAULT_REPAIR_STRATEGIES: RepairStrategy[] = [
  quotedPropertyFixer,
  latexEscapeFixer,
  invalidEscapeFixer,
  truncatedJsonFixer,
  controlCharFixer,
  jsonrepairFixer,
];
