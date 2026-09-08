/**
 * tests/sky/knowledge-graph-api.test.ts
 *
 * API tests for GET /api/sky/knowledge-graph.
 *
 * Mocks the storage layer so graph-building runs with controlled mistake data.
 * Follows the API test patterns from tests/mistakes/mistakes-api.test.ts:
 *   - vitest describe/it/expect
 *   - import { GET } from the route module
 *   - check response status, JSON body shape, and headers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mutable mock for DAO.list() ─────────────────────────────────
// vi.hoisted ensures the reference is available when the vi.mock factories
// are hoisted above the module imports.
const { mockList } = vi.hoisted(() => ({
  mockList: vi.fn(),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/storage/dao/mistakes', () => ({
  createMistakeBookDAO: vi.fn(() => ({ list: mockList })),
}));

import { GET } from '@/app/api/sky/knowledge-graph/route';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';

// ── Helpers ──────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<MistakeBookEntry> = {}): MistakeBookEntry {
  return {
    id: 'm1',
    problemText: '1+1=?',
    userAnswer: '3',
    correctAnswer: '2',
    errorType: 'calculation',
    knowledgePoints: ['加法'],
    reviewCount: 0,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/sky/knowledge-graph', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('GET returns 200 with nodes, edges, weakPoints', async () => {
    mockList.mockResolvedValue({
      items: [
        makeEntry({ id: 'm1', knowledgePoints: ['加法', '进位'] }),
        makeEntry({ id: 'm2', knowledgePoints: ['乘法'] }),
      ],
      total: 2,
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(Array.isArray(json.edges)).toBe(true);
    expect(Array.isArray(json.weakPoints)).toBe(true);
    expect(json.nodes.length).toBeGreaterThan(0);
  });

  it('GET returns empty graph when no mistakes exist', async () => {
    mockList.mockResolvedValue({ items: [], total: 0 });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.nodes).toEqual([]);
    expect(json.edges).toEqual([]);
  });

  it('GET includes overallMastery in response', async () => {
    mockList.mockResolvedValue({
      items: [makeEntry({ id: 'm1', knowledgePoints: ['一元一次方程'] })],
      total: 1,
    });

    const res = await GET();
    const json = await res.json();

    expect(typeof json.overallMastery).toBe('number');
  });

  it('GET returns application/json Content-Type', async () => {
    mockList.mockResolvedValue({
      items: [makeEntry({ id: 'm1', knowledgePoints: ['几何'] })],
      total: 1,
    });

    const res = await GET();

    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });
});
