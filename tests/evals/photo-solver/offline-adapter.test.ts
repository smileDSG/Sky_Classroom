import path from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { loadPhotoSolverCases } from '../../../evals/photo-solver/dataset-loader';
import { OfflineAdapter } from '../../../evals/photo-solver/adapters/offline-adapter';
import { adapterResultSchema } from '../../../evals/photo-solver/types';

const casesPath = path.resolve('evals/photo-solver/dataset/cases.jsonl');

describe('OfflineAdapter', () => {
  it('returns deterministic schema-valid results and does not require images', async () => {
    const cases = await loadPhotoSolverCases(casesPath);
    const adapter = new OfflineAdapter();
    const first = await adapter.run(cases[0]);
    const second = await adapter.run(cases[0]);
    expect(first).toEqual(second);
    expect(() => adapterResultSchema.parse(first)).not.toThrow();
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

  it('has the required fixture distribution', async () => {
    const cases = await loadPhotoSolverCases(casesPath);
    expect(cases).toHaveLength(20);
    expect(cases.filter((item) => item.mode === 'synthetic')).toHaveLength(10);
    expect(cases.filter((item) => item.mode === 'real')).toHaveLength(10);
    expect(cases.filter((item) => item.stage === '初中')).toHaveLength(6);
    expect(cases.filter((item) => item.stage === '高中')).toHaveLength(8);
    expect(cases.filter((item) => item.stage === '大学')).toHaveLength(6);
    expect(cases.filter((item) => item.subject === '理科')).toHaveLength(14);
    expect(cases.filter((item) => item.subject === '文科')).toHaveLength(6);
  });

  it('handles a missing real image and rejected cases deterministically', async () => {
    const cases = await loadPhotoSolverCases(casesPath);
    const realCase = cases.find((item) => item.mode === 'real');
    const rejected = cases.find((item) => item.shouldReject);
    const adapter = new OfflineAdapter();
    expect(realCase?.imagePath).toBeTruthy();
    expect((await adapter.run({ ...realCase!, imagePath: 'images/definitely-missing.png' })).skipped).toBe(false);
    expect((await adapter.run(rejected!)).answer).toBeUndefined();
  });

  it('rejects duplicate documents and missing gold documents', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'photo-docs-'));
    const file = path.join(dir, 'documents.jsonl');
    await writeFile(file, '{"id":"x","content":"one"}\n{"id":"x","content":"two"}\n', 'utf8');
    const adapter = new OfflineAdapter(file);
    const cases = await loadPhotoSolverCases(casesPath);
    await expect(adapter.run(cases[0])).rejects.toThrow(/duplicate/);
    const validFile = path.resolve('evals/photo-solver/dataset/documents.jsonl');
    await expect(new OfflineAdapter(validFile).run({ ...cases[0], goldDocumentIds: ['missing'] })).rejects.toThrow(/missing/);
  });
});
