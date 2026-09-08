import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock kb-dao before importing kb-manager ──

const mockChunks = new Map<string, any>();

vi.mock('@/lib/knowledge-base/kb-dao', () => ({
  ensureTable: vi.fn().mockResolvedValue(undefined),
  upsertChunks: vi.fn().mockImplementation(async (chunks: any[]) => {
    for (const c of chunks) mockChunks.set(c.id, c);
  }),
  upsertChunk: vi.fn().mockImplementation(async (c: any) => {
    mockChunks.set(c.id, c);
  }),
  getChunksByType: vi.fn().mockImplementation(async (kbType: string) => {
    return [...mockChunks.values()].filter((c) => c.kbType === kbType);
  }),
  getChunksBySource: vi.fn().mockImplementation(async (_kbType: string, sourceId: string) => {
    return [...mockChunks.values()].filter((c) => c.sourceId === sourceId);
  }),
  deleteDocument: vi.fn().mockImplementation(async (docId: string) => {
    for (const [id, c] of mockChunks) {
      if (c.docId === docId) mockChunks.delete(id);
    }
  }),
  deleteByType: vi.fn().mockImplementation(async (kbType: string) => {
    for (const [id, c] of mockChunks) {
      if (c.kbType === kbType) mockChunks.delete(id);
    }
  }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
  verifyBySource: vi.fn().mockImplementation(async (sourceId: string) => {
    for (const c of mockChunks.values()) {
      if (c.sourceId === sourceId) c.verified = true;
    }
  }),
  getStats: vi.fn().mockImplementation(async () => {
    const byType: Record<string, { chunks: number; documents: number }> = {};
    for (const c of mockChunks.values()) {
      if (!byType[c.kbType]) byType[c.kbType] = { chunks: 0, documents: 0 };
      byType[c.kbType].chunks++;
    }
    // Count unique docIds per type
    for (const kbType of Object.keys(byType)) {
      const docIds = new Set(
        [...mockChunks.values()].filter((c) => c.kbType === kbType).map((c) => c.docId),
      );
      byType[kbType].documents = docIds.size;
    }
    return {
      totalChunks: mockChunks.size,
      totalDocuments: new Set([...mockChunks.values()].map((c) => c.docId)).size,
      byType,
    };
  }),
  sourceExists: vi.fn().mockImplementation(async (sourceId: string) => {
    return [...mockChunks.values()].some((c) => c.sourceId === sourceId);
  }),
}));

// Mock document-chunker to return predictable chunks
vi.mock('@/lib/agents/rag/document-chunker', () => ({
  chunkDocument: vi.fn().mockImplementation((docId: string, docTitle: string, text: string) => {
    // Split by paragraphs for testing
    const parts = text.split('\n').filter(Boolean);
    return parts.map((content: string, i: number) => ({
      id: `${docId}-chunk-${i}`,
      content: content.trim(),
      metadata: {
        docId,
        docTitle,
        chunkIndex: i,
        totalChunks: parts.length,
      },
    }));
  }),
}));

import {
  write,
  search,
  verifySource,
  removeDocument,
  clearType,
  stats,
  hasSource,
} from '@/lib/knowledge-base/kb-manager';

beforeEach(() => {
  mockChunks.clear();
  vi.clearAllMocks();
  // Reset kb-manager internal state by re-importing
  // The module-level _index and _loaded persist, so we work with that
});

describe('KB Manager — write', () => {
  test('writes chunks to solve KB', async () => {
    const result = await write({
      kbType: 'solve',
      title: '题解: 解方程 2x+3=7',
      content: '解方程步骤\n移项得 2x=4\n除以2得 x=2',
      tags: ['数学', '方程'],
      sourceId: 'test-hash-1',
      verified: false,
    });

    expect(result.docId).toContain('kb-solve-');
    expect(result.chunks).toBe(3); // 3 lines → 3 chunks
  });

  test('writes chunks to slides KB', async () => {
    const result = await write({
      kbType: 'slides',
      title: '课件: 高中数学第一章',
      content: '函数的概念\n函数的性质\n函数的应用',
      verified: true,
    });

    expect(result.docId).toContain('kb-slides-');
    expect(result.chunks).toBe(3);
  });

  test('writes chunks to cards KB', async () => {
    const result = await write({
      kbType: 'cards',
      title: '卡片: 三角函数',
      content: 'sinθ 的定义\ncosθ 的定义\ntanθ 的定义',
      verified: true,
    });

    expect(result.docId).toContain('kb-cards-');
  });

  test('writes chunks to classroom KB', async () => {
    const result = await write({
      kbType: 'classroom',
      title: '课堂: 高中物理力学',
      content: '牛顿第一定律\n牛顿第二定律\n牛顿第三定律',
      sourceId: 'job-123',
      verified: true,
    });

    expect(result.docId).toContain('kb-classroom-');
  });
});

describe('KB Manager — search', () => {
  test('returns results from KB after write', async () => {
    // Write some content first
    await write({
      kbType: 'solve',
      title: '搜索测试',
      content: '特殊内容标记XYZ123',
    });

    const results = await search({
      kbType: 'solve',
      query: '特殊内容标记XYZ123',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.content).toContain('特殊内容标记XYZ123');
  });

  test('finds matching content after write', async () => {
    await write({
      kbType: 'solve',
      title: '题解: 解方程 2x+3=7',
      content: '解方程步骤\n移项得 2x=4\n除以2得 x=2',
      sourceId: 'hash-1',
      verified: true,
    });

    const results = await search({
      kbType: 'solve',
      query: '解方程 2x+3=7',
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.docTitle).toContain('解方程');
  });

  test('respects verifiedOnly filter', async () => {
    await write({
      kbType: 'solve',
      title: '未验证题解',
      content: '未验证的解题步骤',
      verified: false,
    });

    await write({
      kbType: 'solve',
      title: '已验证题解',
      content: '已验证的解题步骤',
      verified: true,
    });

    const verifiedResults = await search({
      kbType: 'solve',
      query: '解题步骤',
      verifiedOnly: true,
    });

    // Should only find verified entries
    for (const r of verifiedResults) {
      expect(r.chunk.verified).toBe(true);
    }
  });

  test('does not search across KB types', async () => {
    await write({
      kbType: 'solve',
      title: '题解',
      content: '解方程的步骤',
    });

    await write({
      kbType: 'slides',
      title: '课件',
      content: '解方程的步骤',
    });

    const solveResults = await search({
      kbType: 'solve',
      query: '解方程',
    });

    const slidesResults = await search({
      kbType: 'slides',
      query: '解方程',
    });

    // Both should find results in their own KB type
    expect(solveResults.length).toBeGreaterThan(0);
    expect(slidesResults.length).toBeGreaterThan(0);

    // Results should be from the correct KB type
    for (const r of solveResults) expect(r.chunk.kbType).toBe('solve');
    for (const r of slidesResults) expect(r.chunk.kbType).toBe('slides');
  });
});

describe('KB Manager — verifySource', () => {
  test('marks all chunks from source as verified', async () => {
    await write({
      kbType: 'solve',
      title: '题解',
      content: '步骤1\n步骤2',
      sourceId: 'src-1',
      verified: false,
    });

    await verifySource('src-1');

    const results = await search({
      kbType: 'solve',
      query: '步骤',
      verifiedOnly: true,
    });

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.chunk.verified).toBe(true);
    }
  });
});

describe('KB Manager — removeDocument', () => {
  test('removes all chunks of a document', async () => {
    const { docId } = await write({
      kbType: 'solve',
      title: '要删除的文档XYZ',
      content: '独特标记ABC123\n独特标记DEF456',
    });

    // Verify the document exists
    const before = await search({ kbType: 'solve', query: '独特标记ABC123' });
    const foundBefore = before.filter((r) => r.chunk.docId === docId);
    expect(foundBefore.length).toBeGreaterThan(0);

    await removeDocument(docId);

    // After removal, the document's chunks should be gone from the index
    // The dao mock removes from mockChunks, but the in-memory index in kb-manager
    // also calls removeDocument which filters by docId
    const after = await search({ kbType: 'solve', query: '独特标记ABC123', threshold: 0 });
    const foundAfter = after.filter((r) => r.chunk.docId === docId);
    expect(foundAfter.length).toBe(0);
  });
});

describe('KB Manager — clearType', () => {
  test('clears all entries for a specific type', async () => {
    await write({ kbType: 'solve', title: 'S1', content: 'solve内容' });
    await write({ kbType: 'slides', title: 'P1', content: 'slides内容' });

    await clearType('solve');

    const s = await stats();
    expect(s.byType?.solve).toBeUndefined();
    expect(s.byType?.slides).toBeDefined();
  });
});

describe('KB Manager — hasSource', () => {
  test('returns true for existing source', async () => {
    await write({
      kbType: 'solve',
      title: '题解',
      content: '内容',
      sourceId: 'existing-src',
    });

    expect(await hasSource('existing-src')).toBe(true);
  });

  test('returns false for non-existing source', async () => {
    expect(await hasSource('non-existing-src')).toBe(false);
  });
});

describe('KB Manager — stats', () => {
  test('returns correct stats after writes', async () => {
    await write({ kbType: 'solve', title: 'S1', content: 'line1\nline2' });
    await write({ kbType: 'solve', title: 'S2', content: 'line3' });
    await write({ kbType: 'slides', title: 'P1', content: 'line4\nline5\nline6' });

    const s = await stats();
    expect(s.totalChunks).toBe(6); // 2 + 1 + 3
    expect(s.totalDocuments).toBe(3);
    expect(s.byType?.solve?.chunks).toBe(3);
    expect(s.byType?.solve?.documents).toBe(2);
    expect(s.byType?.slides?.chunks).toBe(3);
    expect(s.byType?.slides?.documents).toBe(1);
  });
});
