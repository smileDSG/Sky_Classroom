import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH, DELETE } from '@/app/api/sky/mistakes/route';

const BASE = 'http://localhost/api/sky/mistakes';

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

// ── GET ────────────────────────────────────────────────────────────

describe('GET /api/sky/mistakes', () => {
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
});

// ── PATCH ───────────────────────────────────────────────────────────

describe('PATCH /api/sky/mistakes', () => {
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
});

// ── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/sky/mistakes', () => {
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
