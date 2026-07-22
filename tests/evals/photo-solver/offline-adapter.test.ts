import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadPhotoSolverCases } from '../../../evals/photo-solver/dataset-loader';
import { OfflineAdapter } from '../../../evals/photo-solver/adapters/offline-adapter';

const casesPath = path.resolve('evals/photo-solver/dataset/cases.jsonl');

describe('OfflineAdapter', () => {
  it('returns deterministic schema-valid results and does not require images', async () => {
    const cases = await loadPhotoSolverCases(casesPath);
    const adapter = new OfflineAdapter();
    const first = await adapter.run(cases[0]);
    const second = await adapter.run(cases[0]);
    expect(first).toEqual(second);
    expect(first.timing).toEqual({ recognitionMs: 0, retrievalMs: 0, generationMs: 0, totalMs: 0 });
    expect(first.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, currency: 'USD' });
    expect(first.retrievedDocuments.map((doc) => doc.id)).toEqual(cases[0].goldDocumentIds);
  });

  it('covers every robustness tag in the fixture dataset', async () => {
    const cases = await loadPhotoSolverCases(casesPath);
    for (const tag of ['normal', 'noisy', 'no-answer', 'counterfactual', 'multi-document']) {
      expect(cases.some((item) => item.tags.includes(tag))).toBe(true);
    }
  });
});
