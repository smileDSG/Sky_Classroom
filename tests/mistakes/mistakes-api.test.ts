import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const apiBoundary = vi.hoisted(() => ({
  userId: 'user-a',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: apiBoundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => apiBoundary.storage),
  getRequiredServerStorage: vi.fn(async () => apiBoundary.storage),
}));

vi.mock('@/lib/solve/grader', () => ({
  gradeAnswer: vi.fn(async (_problem: string, correctAnswer: string, userAnswer: string) => ({
    isCorrect: false,
    score: 0,
    correctAnswer,
    userAnswer,
    errorAnalysis: 'mock grading error',
    cause: 'concept-unclear',
  })),
}));

vi.mock('server-only', () => ({}));

import { GET, POST, PATCH, DELETE } from '@/app/api/sky/mistakes/route';
import { DELETE as DELETE_BY_ID } from '@/app/api/sky/mistakes/[id]/route';
import { GET as GET_DUE } from '@/app/api/sky/review/due/route';
import { GET as GET_KNOWLEDGE_GRAPH } from '@/app/api/sky/knowledge-graph/route';
import { POST as GRADE_ANSWER } from '@/app/api/sky/solve/grade/route';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';

const BASE = 'http://localhost/api/sky/mistakes';
const storage = new MemoryStorageProvider();
apiBoundary.storage = storage;

async function seedPreferences(userId: string) {
  const repo = new LearnerProfileRepository(storage);
  await repo.insertPreferences({
    userId,
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['worked-example', 'diagram'],
    explanationDepth: 'detailed',
    learningPace: 'standard',
    stepByStepMode: 'always',
    interactionTone: 'encouraging',
    assistantName: '小智',
    preferenceNotes: '',
    privacy: {
      conversationMemory: 'persistent',
      optionalBehaviorSignals: true,
      privateKnowledgeRetrieval: false,
    },
    version: 1,
    schemaVersion: '1.0.0',
    updatedAt: '2026-07-28T00:00:00.000Z',
    updatedBy: 'user',
  });
}

function buildUrl(params: Record<string, string> = {}): string {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function createMistake(overrides: Record<string, unknown> = {}) {
  const res = await POST(
    new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({
        problemText: '1+1=?',
        userAnswer: '3',
        correctAnswer: '2',
        errorType: 'calculation',
        knowledgePoints: ['加法'],
        ...overrides,
      }),
    }),
  );
  return res;
}

async function extractId(res: Response): Promise<string> {
  const json = await res.json();
  return json.id as string;
}

beforeEach(async () => {
  apiBoundary.userId = 'user-a';
  await storage.clear('mistakes');
});

// ── GET ────────────────────────────────────────────────────────────

describe('GET /api/sky/mistakes', () => {
  it("does not reveal another authenticated user's mistakes", async () => {
    const created = await createMistake({ knowledgePoints: ['A_PRIVATE_POINT'] });
    const id = await extractId(created);

    apiBoundary.userId = 'user-b';
    const response = await GET(new NextRequest(BASE));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(0);
    expect(payload.items.map((item: { id: string }) => item.id)).not.toContain(id);
  });

  it('returns items array and total count', async () => {
    const req = new NextRequest(BASE);
    const res = await GET(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.items)).toBe(true);
    expect(typeof json.total).toBe('number');
  });

  it('returns status 200', async () => {
    const req = new NextRequest(BASE);
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('filters by errorType', async () => {
    // Create a calculation mistake first
    await createMistake({ errorType: 'calculation', knowledgePoints: ['测试加法'] });

    const url = buildUrl({ errorType: 'calculation' });
    const req = new NextRequest(url);
    const res = await GET(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    for (const item of json.items) {
      expect(item.errorType).toBe('calculation');
    }
  });

  it('filters by reviewed', async () => {
    const url = buildUrl({ reviewed: 'false' });
    const req = new NextRequest(url);
    const res = await GET(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    for (const item of json.items) {
      expect(item.reviewed).toBe(false);
    }
  });

  it('supports pagination', async () => {
    const url = buildUrl({ page: '1', pageSize: '5' });
    const req = new NextRequest(url);
    const res = await GET(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.items.length).toBeLessThanOrEqual(5);
  });
});

describe('GET /api/sky/review/due', () => {
  it("builds the review schedule from only the authenticated user's mistakes", async () => {
    const dao = createMistakeBookDAO(storage);
    const base = {
      problemText: 'due problem',
      userAnswer: 'wrong',
      correctAnswer: 'right',
      errorType: 'concept' as const,
      knowledgePoints: ['due-point'],
      nextReview: Date.now() - 1_000,
    };
    await dao.add('user-a', { id: 'due-a', ...base });
    await dao.add('user-b', { id: 'due-b', ...base });

    apiBoundary.userId = 'user-b';
    const response = await GET_DUE();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.dueToday.map((item: { id: string }) => item.id)).toEqual(['due-b']);
  });
});

describe('GET /api/sky/knowledge-graph', () => {
  it("builds graph nodes from only the authenticated user's mistakes", async () => {
    const dao = createMistakeBookDAO(storage);
    const base = {
      problemText: 'graph problem',
      userAnswer: 'wrong',
      correctAnswer: 'right',
      errorType: 'concept' as const,
    };
    await dao.add('user-a', {
      id: 'graph-a',
      ...base,
      knowledgePoints: ['A_PRIVATE_POINT'],
    });
    await dao.add('user-b', {
      id: 'graph-b',
      ...base,
      knowledgePoints: ['B_PRIVATE_POINT'],
    });

    apiBoundary.userId = 'user-b';
    const response = await GET_KNOWLEDGE_GRAPH();
    const payload = await response.json();
    const nodeIds = payload.nodes.map((node: { id: string }) => node.id);

    expect(response.status).toBe(200);
    expect(nodeIds).toContain('B_PRIVATE_POINT');
    expect(nodeIds).not.toContain('A_PRIVATE_POINT');
  });
});

describe('POST /api/sky/solve/grade', () => {
  it('binds generated mistakes to the authenticated user and ignores client-owned ids', async () => {
    await seedPreferences(apiBoundary.userId);

    const response = await GRADE_ANSWER(
      new Request('http://localhost/api/sky/solve/grade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          problem: '1 + 1 = ?',
          correctAnswer: '2',
          userAnswer: '3',
          mistakeId: 'attacker-selected-id',
          knowledgePoints: ['加法'],
        }),
      }),
    );

    expect(response.status).toBe(200);

    const list = await GET(new NextRequest(BASE));
    const payload = await list.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].userId).toBe('user-a');
    expect(payload.items[0].id).not.toBe('attacker-selected-id');
  });
});

// ── POST ────────────────────────────────────────────────────────────

describe('POST /api/sky/mistakes', () => {
  it('creates a new mistake and returns 201', async () => {
    const res = await createMistake();
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.id).toBeDefined();
    expect(typeof json.id).toBe('string');
  });

  it('returns created: true', async () => {
    const res = await createMistake();
    const json = await res.json();
    expect(json.created).toBe(true);
  });

  it('uses defaults for missing fields', async () => {
    const res = await POST(
      new NextRequest(BASE, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeDefined();
  });

  it('correctly stores error type', async () => {
    const res = await createMistake({ errorType: 'concept', knowledgePoints: ['函数'] });
    const json = await res.json();
    const id = json.id as string;

    // Verify via GET
    const url = buildUrl({});
    const getRes = await GET(new NextRequest(url));
    const getJson = await getRes.json();
    const created = getJson.items.find((i: { id: string }) => i.id === id);
    expect(created).toBeDefined();
    if (created) {
      expect(created.errorType).toBe('concept');
    }
  });

  it('ignores client-provided userId and binds the entry to the authenticated user', async () => {
    const res = await POST(
      new NextRequest(BASE, {
        method: 'POST',
        body: JSON.stringify({
          problemText: 'client-userid-test',
          userAnswer: 'wrong',
          correctAnswer: 'right',
          errorType: 'concept',
          userId: 'attacker',
        }),
      }),
    );
    expect(res.status).toBe(201);

    const getRes = await GET(new NextRequest(BASE));
    const getJson = await getRes.json();
    expect(getJson.items).toHaveLength(1);
    expect(getJson.items[0].userId).toBe('user-a');
  });
});

// ── PATCH ───────────────────────────────────────────────────────────

describe('PATCH /api/sky/mistakes', () => {
  it('does not let another authenticated user review a private mistake', async () => {
    const createRes = await createMistake({ knowledgePoints: ['A_REVIEW_PRIVATE'] });
    const id = await extractId(createRes);

    apiBoundary.userId = 'user-b';
    const response = await PATCH(
      new NextRequest(BASE, {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      }),
    );

    expect(response.status).toBe(404);

    apiBoundary.userId = 'user-a';
    const list = await GET(new NextRequest(BASE));
    const payload = await list.json();
    expect(payload.items.find((item: { id: string }) => item.id === id)?.reviewCount).toBe(0);
  });

  it('records a review and returns success', async () => {
    const createRes = await createMistake({ knowledgePoints: ['复习测试'] });
    const id = await extractId(createRes);

    const res = await PATCH(
      new NextRequest(BASE, {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      }),
    );
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.reviewed).toBe(true);
  });

  it('returns 400 when id is missing', async () => {
    const res = await PATCH(
      new NextRequest(BASE, {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('increments reviewCount after review', async () => {
    const createRes = await createMistake({ knowledgePoints: ['reviewCount测试'] });
    const id = await extractId(createRes);

    await PATCH(
      new NextRequest(BASE, {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      }),
    );

    // Get the updated entry
    const url = buildUrl({});
    const getRes = await GET(new NextRequest(url));
    const getJson = await getRes.json();
    const updated = getJson.items.find((i: { id: string }) => i.id === id);
    expect(updated?.reviewCount).toBe(1);
  });

  it('sets nextReview after PATCH', async () => {
    const createRes = await createMistake({ knowledgePoints: ['nextReview测试'] });
    const id = await extractId(createRes);

    await PATCH(
      new NextRequest(BASE, {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      }),
    );

    const url = buildUrl({});
    const getRes = await GET(new NextRequest(url));
    const getJson = await getRes.json();
    const updated = getJson.items.find((i: { id: string }) => i.id === id);
    expect(updated?.nextReview).toBeDefined();
    expect(updated?.nextReview).toBeGreaterThan(Date.now());
  });

  it('records a review-completed learning event after PATCH', async () => {
    const createRes = await createMistake({ knowledgePoints: ['事件测试'] });
    const id = await extractId(createRes);

    await PATCH(
      new NextRequest(BASE, {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      }),
    );

    const repository = new LearnerProfileRepository(storage);
    const events = await repository.listLearningEvents('user-a');
    const reviewEvent = events.find((e) => e.type === 'review-completed' && e.correlationId === id);

    expect(reviewEvent).toBeDefined();
    expect(reviewEvent?.source).toBe('mistake-review');
    expect(reviewEvent?.payload.rating).toBe('recalled');
    expect(reviewEvent?.payload.knowledgePoints).toEqual(['事件测试']);
  });
});

// ── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/sky/mistakes', () => {
  it('enforces ownership in the dynamic delete route used by the client', async () => {
    const createRes = await createMistake({ knowledgePoints: ['A_DYNAMIC_DELETE_PRIVATE'] });
    const id = await extractId(createRes);

    apiBoundary.userId = 'user-b';
    const response = await DELETE_BY_ID(new NextRequest(`${BASE}/${id}`), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(404);
  });

  it('does not let another authenticated user delete a private mistake', async () => {
    const createRes = await createMistake({ knowledgePoints: ['A_DELETE_PRIVATE'] });
    const id = await extractId(createRes);

    apiBoundary.userId = 'user-b';
    const response = await DELETE(new NextRequest(`${BASE}/${id}`));
    expect(response.status).toBe(404);

    apiBoundary.userId = 'user-a';
    const list = await GET(new NextRequest(BASE));
    const payload = await list.json();
    expect(payload.items.map((item: { id: string }) => item.id)).toContain(id);
  });

  it('deletes a mistake and returns success', async () => {
    const createRes = await createMistake({ knowledgePoints: ['删除测试'] });
    const id = await extractId(createRes);

    const url = `${BASE}/${id}`;
    const res = await DELETE(new NextRequest(url));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deleted).toBe(true);
  });

  it('deleted item is no longer in list', async () => {
    const createRes = await createMistake({ knowledgePoints: ['彻底删除'] });
    const id = await extractId(createRes);

    const url = `${BASE}/${id}`;
    await DELETE(new NextRequest(url));

    const getRes = await GET(new NextRequest(BASE));
    const getJson = await getRes.json();
    const ids = getJson.items.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(id);
  });
});

// ── Full CRUD flow ─────────────────────────────────────────────────

describe('CRUD integration', () => {
  it('POST → GET → PATCH → DELETE full cycle', async () => {
    // 1. Create
    const createRes = await createMistake({
      problemText: '2+3=?',
      userAnswer: '6',
      correctAnswer: '5',
      errorType: 'calculation',
      knowledgePoints: ['加法', '进位'],
    });
    expect(createRes.status).toBe(201);
    const id = await extractId(createRes);

    // 2. Verify in list
    const listRes1 = await GET(new NextRequest(buildUrl({})));
    const listJson1 = await listRes1.json();
    const found = listJson1.items.find((i: { id: string }) => i.id === id);
    expect(found).toBeDefined();
    expect(found.problemText).toBe('2+3=?');
    expect(found.knowledgePoints).toContain('进位');

    // 3. Review
    const patchRes = await PATCH(
      new NextRequest(BASE, {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      }),
    );
    expect(patchRes.status).toBe(200);

    // 4. Verify reviewed
    const listRes2 = await GET(new NextRequest(buildUrl({})));
    const listJson2 = await listRes2.json();
    const reviewed = listJson2.items.find((i: { id: string }) => i.id === id);
    expect(reviewed?.reviewCount).toBeGreaterThanOrEqual(1);

    // 5. Delete
    const delRes = await DELETE(new NextRequest(`${BASE}/${id}`));
    expect(delRes.status).toBe(200);

    // 6. Verify gone
    const listRes3 = await GET(new NextRequest(buildUrl({})));
    const listJson3 = await listRes3.json();
    const ids = listJson3.items.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(id);
  });
});
