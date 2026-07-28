import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findVerified: vi.fn(),
  createRepository: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/auth/helpers', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('@/lib/adaptive-learning/resources/repository', () => ({
  createGaokaoMathResourceRepository: mocks.createRepository,
}));

const { GET } = await import('@/app/api/sky/math-resources/route');

function request(query = '', correlationId?: string): Request {
  return new Request(`http://localhost/api/sky/math-resources${query}`, {
    headers: correlationId ? { 'x-correlation-id': correlationId } : undefined,
  });
}

describe('GET /api/sky/math-resources', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.createRepository.mockReturnValue({ findVerified: mocks.findVerified });
    mocks.findVerified.mockResolvedValue([]);
  });

  it('maps an authentication error result to UNAUTHENTICATED', async () => {
    mocks.requireAuth.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    const response = await GET(request('', 'corr-auth'));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        retryable: false,
        stage: 'math-resources-auth',
        details: {},
        correlationId: 'corr-auth',
      },
    });
  });

  it('maps an authentication exception to retryable SYNC_FAILED', async () => {
    mocks.requireAuth.mockRejectedValue(new Error('cookie store unavailable'));

    const response = await GET(request('', 'corr-sync'));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'SYNC_FAILED',
        retryable: true,
        stage: 'math-resources-auth',
        correlationId: 'corr-sync',
      },
    });
  });

  it('strictly rejects unknown query parameters', async () => {
    const response = await GET(request('?unknown=true', 'corr-query'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_SCHEMA',
        retryable: false,
        stage: 'math-resources-api',
        correlationId: 'corr-query',
      },
    });
    expect(mocks.findVerified).not.toHaveBeenCalled();
  });

  it.each([
    ['nodeId', '?nodeId=derivative-concept&nodeId=functions-properties'],
    ['limit', '?limit=5&limit=10'],
  ])('rejects duplicate %s query parameters instead of applying last-wins', async (key, query) => {
    const response = await GET(request(query, 'corr-duplicate'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_SCHEMA',
        stage: 'math-resources-api',
        details: { duplicateKeys: [key] },
      },
    });
    expect(mocks.findVerified).not.toHaveBeenCalled();
  });

  it('returns verified resources and preserves a caller correlation id', async () => {
    const resources = [{ id: 'math_1234567890abcdef', status: 'verified' }];
    mocks.findVerified.mockResolvedValue(resources);

    const response = await GET(
      request('?nodeId=derivative-concept&resourceType=concept&maxDifficulty=4&limit=5', 'corr-ok'),
    );

    expect(response.status).toBe(200);
    expect(mocks.findVerified).toHaveBeenCalledWith({
      nodeId: 'derivative-concept',
      resourceType: 'concept',
      maxDifficulty: 4,
      limit: 5,
    });
    expect(await response.json()).toEqual({
      success: true,
      data: resources,
      correlationId: 'corr-ok',
    });
    expect(response.headers.get('x-correlation-id')).toBe('corr-ok');
  });

  it('maps a resource gap without fallback', async () => {
    mocks.findVerified.mockRejectedValue(
      new AdaptiveLearningError({
        code: 'RESOURCE_GAP',
        message: 'No verified resources match the query',
        retryable: false,
        stage: 'resource-query',
        details: {
          nodeIds: ['derivative-concept'],
          expectedResourceType: 'concept',
          maxDifficulty: 4,
          indexPath: 'C:\\private\\index.json',
        },
      }),
    );

    const response = await GET(request('?nodeId=derivative-concept', 'corr-gap'));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'RESOURCE_GAP',
        details: {
          nodeIds: ['derivative-concept'],
          expectedResourceType: 'concept',
          maxDifficulty: 4,
        },
        correlationId: 'corr-gap',
      },
    });
  });

  it('keeps internal index details out of responses while logging them with correlation', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const indexPath = 'C:\\private\\adaptive-learning\\resource-index.v1.json';
    mocks.findVerified.mockRejectedValue(
      new AdaptiveLearningError({
        code: 'RESOURCE_INDEX_UNAVAILABLE',
        message: `Could not read ${indexPath}`,
        retryable: false,
        stage: 'resource-index-read',
        details: { indexPath, issues: [{ message: 'secret parse failure' }] },
        cause: new Error('disk read failed'),
      }),
    );

    const response = await GET(request());
    const body = await response.json();
    const responseText = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: 'RESOURCE_INDEX_UNAVAILABLE',
        retryable: false,
        stage: 'resource-index-read',
        details: {},
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    });
    expect(responseText).not.toContain(indexPath);
    expect(responseText).not.toContain('secret parse failure');
    expect(response.headers.get('x-correlation-id')).toBe(body.error.correlationId);
    expect(JSON.stringify(log.mock.calls)).toContain(body.error.correlationId);
    expect(
      log.mock.calls.some((call) => call.some((value) => value?.details?.indexPath === indexPath)),
    ).toBe(true);
    log.mockRestore();
  });
});
