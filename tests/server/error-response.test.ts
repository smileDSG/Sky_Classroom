/**
 * P1-003: API error response tests
 *
 * Tests apiError, apiSuccess, and error code definitions.
 */
import { describe, test, expect } from 'vitest';
import {
  apiError,
  apiSuccess,
  API_ERROR_CODES,
  ERROR_CODE_MESSAGES,
} from '@/lib/server/api-response';
import { ERROR_CODE_STATUS } from '@/lib/server/api-error-codes';

// ─── apiError ───

describe('apiError', () => {
  test('returns 400 status with INVALID_REQUEST', () => {
    const res = apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid request');
    expect(res.status).toBe(400);
  });

  test('returns correct error body shape', async () => {
    const res = apiError(API_ERROR_CODES.NOT_FOUND, 404, 'Not found', 'User 123');
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.NOT_FOUND,
      error: 'Not found',
      details: 'User 123',
    });
  });

  test('omits details when not provided', async () => {
    const res = apiError(API_ERROR_CODES.RATE_LIMITED, 429, 'Rate limit exceeded');
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.RATE_LIMITED,
      error: 'Rate limit exceeded',
    });
    expect(body).not.toHaveProperty('details');
  });

  test('returns 500 for INTERNAL_ERROR', () => {
    const res = apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, 'Server error');
    expect(res.status).toBe(500);
  });

  test('returns 401 for UNAUTHORIZED', () => {
    const res = apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Unauthorized');
    expect(res.status).toBe(401);
  });

  test('returns 429 for RATE_LIMITED', () => {
    const res = apiError(API_ERROR_CODES.RATE_LIMITED, 429, 'Too many requests');
    expect(res.status).toBe(429);
  });

  test('returns 409 for DUPLICATE_RESOURCE', () => {
    const res = apiError(API_ERROR_CODES.DUPLICATE_RESOURCE, 409, 'Already exists');
    expect(res.status).toBe(409);
  });

  test('returns 502 for UPSTREAM_ERROR', () => {
    const res = apiError(API_ERROR_CODES.UPSTREAM_ERROR, 502, 'Provider failed');
    expect(res.status).toBe(502);
  });
});

// ─── apiSuccess ───

describe('apiSuccess', () => {
  test('returns 200 by default', async () => {
    const res = apiSuccess({ message: 'ok' });
    expect(res.status).toBe(200);
  });

  test('includes success: true and spreads data', async () => {
    const res = apiSuccess({ id: '1', name: 'test' });
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      id: '1',
      name: 'test',
    });
  });

  test('accepts custom status code', () => {
    const res = apiSuccess({ id: '1' }, 201);
    expect(res.status).toBe(201);
  });

  test('handles nested data objects', async () => {
    const res = apiSuccess({ data: { items: [1, 2, 3] }, total: 3 });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([1, 2, 3]);
    expect(body.total).toBe(3);
  });
});

// ─── Error Code Constants ───

describe('API_ERROR_CODES', () => {
  test('has all expected codes', () => {
    const expected = [
      'MISSING_REQUIRED_FIELD',
      'MISSING_API_KEY',
      'INVALID_REQUEST',
      'RATE_LIMITED',
      'VOXCPM_AUTO_VOICE_REQUIRES_CONTEXT',
      'INVALID_URL',
      'REDIRECT_NOT_ALLOWED',
      'CONTENT_SENSITIVE',
      'UPSTREAM_ERROR',
      'GENERATION_FAILED',
      'TRANSCRIPTION_FAILED',
      'PARSE_FAILED',
      'INTERNAL_ERROR',
      'STORAGE_ERROR',
      'NOT_FOUND',
      'UNAUTHORIZED',
      'DUPLICATE_RESOURCE',
      'INVALID_CREDENTIALS',
      'EMAIL_EXISTS',
      'USERNAME_EXISTS',
      'ACCOUNT_SUSPENDED',
      'USAGE_LIMIT_EXCEEDED',
      'INSUFFICIENT_PLAN',
      'ORDER_NOT_FOUND',
      'PAYMENT_FAILED',
      'FORBIDDEN',
    ];
    for (const code of expected) {
      expect(API_ERROR_CODES).toHaveProperty(code);
    }
  });

  test('all codes are unique', () => {
    const values = Object.values(API_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  test('all codes follow UPPERCASE_SNAKE_CASE', () => {
    for (const code of Object.values(API_ERROR_CODES)) {
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('ERROR_CODE_STATUS', () => {
  test('has matching keys with API_ERROR_CODES', () => {
    for (const code of Object.keys(API_ERROR_CODES)) {
      expect(ERROR_CODE_STATUS).toHaveProperty(code);
    }
  });

  test('maps to correct HTTP statuses', () => {
    expect(ERROR_CODE_STATUS.INVALID_REQUEST).toBe(400);
    expect(ERROR_CODE_STATUS.RATE_LIMITED).toBe(429);
    expect(ERROR_CODE_STATUS.NOT_FOUND).toBe(404);
    expect(ERROR_CODE_STATUS.UNAUTHORIZED).toBe(401);
    expect(ERROR_CODE_STATUS.FORBIDDEN).toBe(403);
    expect(ERROR_CODE_STATUS.INTERNAL_ERROR).toBe(500);
    expect(ERROR_CODE_STATUS.UPSTREAM_ERROR).toBe(502);
    expect(ERROR_CODE_STATUS.DUPLICATE_RESOURCE).toBe(409);
    expect(ERROR_CODE_STATUS.REDIRECT_NOT_ALLOWED).toBe(403);
  });
});

describe('ERROR_CODE_MESSAGES', () => {
  test('has matching keys with API_ERROR_CODES', () => {
    for (const code of Object.keys(API_ERROR_CODES)) {
      expect(ERROR_CODE_MESSAGES).toHaveProperty(code);
    }
  });

  test('all messages are non-empty strings', () => {
    for (const msg of Object.values(ERROR_CODE_MESSAGES)) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  test('messages are human-readable', () => {
    expect(ERROR_CODE_MESSAGES.INVALID_REQUEST).toBe('Invalid request');
    expect(ERROR_CODE_MESSAGES.RATE_LIMITED).toBe('Rate limit exceeded');
    expect(ERROR_CODE_MESSAGES.INTERNAL_ERROR).toBe('Internal server error');
  });
});
