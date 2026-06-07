/**
 * B-003: Classroom CRUD integration tests
 *
 * Tests the /api/classroom endpoint for:
 * - POST (create classroom)
 * - GET (retrieve classroom by id)
 * - Input validation and error handling
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock storage layer to avoid filesystem/database dependencies
const mockPersistClassroom = vi.fn();
const mockReadClassroom = vi.fn();
const mockIsValidClassroomId = vi.fn().mockReturnValue(true);
const mockBuildRequestOrigin = vi.fn().mockReturnValue('http://localhost:3000');

vi.mock('@/lib/server/classroom-storage', () => ({
  buildRequestOrigin: (...args: unknown[]) => mockBuildRequestOrigin(...args),
  isValidClassroomId: (...args: unknown[]) => mockIsValidClassroomId(...args),
  persistClassroom: (...args: unknown[]) => mockPersistClassroom(...args),
  readClassroom: (...args: unknown[]) => mockReadClassroom(...args),
}));

import { POST, GET } from '@/app/api/classroom/route';

function createPostRequest(body: unknown): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/classroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  // NextRequest.json() reads from the body that was set at construction
  // Use Object.defineProperty to mock the json method
  Object.defineProperty(req, 'json', {
    value: async () => structuredClone(body),
  });
  return req;
}

function createGetRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/classroom?id=${encodeURIComponent(id)}`);
}

// ─── POST /api/classroom (Create) ───

describe('POST /api/classroom — create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistClassroom.mockResolvedValue({
      id: 'classroom-001',
      url: 'http://localhost:3000/classroom/classroom-001',
    });
  });

  test('creates classroom with valid stage and scenes', async () => {
    const req = createPostRequest({
      stage: { id: 'stage-1', title: 'Test Stage' },
      scenes: [{ id: 'scene-1', title: 'Scene 1' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    // apiSuccess spreads data: { success: true, id, url }
    expect(body.id).toBe('classroom-001');
    expect(body.url).toContain('classroom-001');
  });

  test('rejects request missing stage field', async () => {
    const req = createPostRequest({ scenes: [] });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('stage');
  });

  test('rejects request missing scenes field', async () => {
    const req = createPostRequest({ stage: { id: 's1' } });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('scenes');
  });

  test('rejects empty request body', async () => {
    const req = createPostRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('generates UUID for classroom when stage has no id', async () => {
    const req = createPostRequest({
      stage: { title: 'Untitled Stage' },
      scenes: [{ id: 'scene-1' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    // apiSuccess spreads data: { success: true, id, url }
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe('string');
  });

  test('returns 500 on storage failure', async () => {
    mockPersistClassroom.mockRejectedValue(new Error('Disk full'));

    const req = createPostRequest({
      stage: { id: 'stage-1' },
      scenes: [{ id: 'scene-1' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });
});

// ─── GET /api/classroom (Retrieve) ───

describe('GET /api/classroom — retrieve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidClassroomId.mockReturnValue(true);
    mockReadClassroom.mockResolvedValue({
      id: 'classroom-001',
      stage: { id: 'stage-1', title: 'Test Stage' },
      scenes: [{ id: 'scene-1' }],
    });
  });

  test('retrieves classroom by valid id', async () => {
    const req = createGetRequest('classroom-001');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // apiSuccess spreads data: { success: true, classroom: {...} }
    expect(body.classroom.id).toBe('classroom-001');
  });

  test('rejects request missing id parameter', async () => {
    const req = new NextRequest('http://localhost:3000/api/classroom');

    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('id');
  });

  test('rejects invalid classroom id format', async () => {
    mockIsValidClassroomId.mockReturnValue(false);

    const req = createGetRequest('invalid!!!id');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  test('returns 404 for non-existent classroom', async () => {
    mockReadClassroom.mockResolvedValue(null);

    const req = createGetRequest('non-existent-id');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 500 on read failure', async () => {
    mockReadClassroom.mockRejectedValue(new Error('Database connection lost'));

    const req = createGetRequest('classroom-001');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });
});

// ─── Response Format Consistency ───

describe('Classroom API — response format', () => {
  test('all error responses follow unified {success, errorCode, error} shape', async () => {
    const req = createPostRequest({});
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('errorCode');
    expect(body).toHaveProperty('error');
    expect(body.errorCode).toMatch(/^[A-Z_]+$/);
  });

  test('all success responses follow unified {success, data} shape', async () => {
    mockPersistClassroom.mockResolvedValue({
      id: 'classroom-002',
      url: 'http://localhost:3000/classroom/classroom-002',
    });

    const req = createPostRequest({
      stage: { id: 'stage-1' },
      scenes: [{ id: 'scene-1' }],
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    // apiSuccess spreads data inline: { success: true, id, url }
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('url');
  });
});
