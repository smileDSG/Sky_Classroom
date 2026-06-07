/**
 * Code block extraction strategy.
 *
 * Extracts JSON from markdown code blocks in AI responses.
 * Handles ```json, ```, and whitespace variations.
 */

import type { ExtractionStrategy } from './types';

export const codeBlockExtractor: ExtractionStrategy = {
  name: 'code-block-extractor',

  extract(rawResponse: string): string[] {
    const results: string[] = [];
    const regex = /```(?:json)?\s*([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rawResponse)) !== null) {
      const extracted = match[1].trim();
      if (extracted.startsWith('{') || extracted.startsWith('[')) {
        results.push(extracted);
      }
    }

    return results;
  },
};
