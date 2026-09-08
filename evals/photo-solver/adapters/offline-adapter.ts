import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  adapterResultSchema,
  photoSolverDocumentSchema,
  type AdapterResult,
  type PhotoSolverCase,
  type PhotoSolverDocument,
} from '../types';
import type { PhotoSolverAdapter } from './types';

async function loadDocuments(file: string): Promise<Map<string, PhotoSolverDocument>> {
  const text = await readFile(file, 'utf8');
  const map = new Map<string, PhotoSolverDocument>();
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const parsed = photoSolverDocumentSchema.parse(JSON.parse(line));
    if (map.has(parsed.id)) throw new Error(`duplicate document id "${parsed.id}"`);
    map.set(parsed.id, parsed);
  }
  return map;
}

export class OfflineAdapter implements PhotoSolverAdapter {
  constructor(
    private readonly documentPath = path.resolve('evals/photo-solver/dataset/documents.jsonl'),
  ) {}

  async run(testCase: PhotoSolverCase): Promise<AdapterResult> {
    const docs = await loadDocuments(this.documentPath);
    for (const id of testCase.goldDocumentIds) {
      if (!docs.has(id)) throw new Error(`missing document "${id}"`);
    }
    const retrievedDocuments = testCase.goldDocumentIds.map((id, index) => {
      const doc = docs.get(id);
      return { id, content: doc?.content, score: 1 - index * 0.01 };
    });
    return adapterResultSchema.parse({
      recognition: testCase.offlineRecognition,
      retrievedDocuments,
      answer: testCase.shouldReject ? undefined : testCase.standardAnswer,
      evidence: testCase.requiredEvidence,
      timing: { recognitionMs: 0, retrievalMs: 0, generationMs: 0, totalMs: 0 },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, currency: 'USD' },
      skipped: false,
    });
  }
}
