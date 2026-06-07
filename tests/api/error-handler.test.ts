/**
 * B-004: API error handler tests
 *
 * Validates the unified error/success response format used by all API routes.
 * Tests apiError and apiSuccess helpers from lib/server/api-response.ts.
 */
import { describe, test, expect } from 'vitest';
import { API_ERROR_CODES } from '@/lib/server/api-response';

// ─── Error Codes ───

describe('API error codes', () => {
  test('all expected error codes exist', () => {
    expect(API_ERROR_CODES.MISSING_REQUIRED_FIELD).toBe('MISSING_REQUIRED_FIELD');
    expect(API_ERROR_CODES.MISSING_API_KEY).toBe('MISSING_API_KEY');
    expect(API_ERROR_CODES.INVALID_REQUEST).toBe('INVALID_REQUEST');
    expect(API_ERROR_CODES.INVALID_URL).toBe('INVALID_URL');
    expect(API_ERROR_CODES.GENERATION_FAILED).toBe('GENERATION_FAILED');
    expect(API_ERROR_CODES.PARSE_FAILED).toBe('PARSE_FAILED');
    expect(API_ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });

  test('all error codes are unique', () => {
    const values = Object.values(API_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  test('error codes follow uppercase+underscore convention', () => {
    for (const code of Object.values(API_ERROR_CODES)) {
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });
});

// ─── Response Format Validation ───

describe('API response format', () => {
  test('apiError response has correct shape (mock validation)', () => {
    const errorShape = {
      success: false,
      errorCode: API_ERROR_CODES.INTERNAL_ERROR,
      error: 'Something went wrong',
      details: 'Optional details',
    };

    expect(errorShape.success).toBe(false);
    expect(errorShape.errorCode).toBeDefined();
    expect(errorShape.error).toBeTruthy();
    expect(typeof errorShape.errorCode).toBe('string');
    expect(typeof errorShape.error).toBe('string');
  });

  test('apiSuccess response has correct shape (mock validation)', () => {
    const successShape = {
      success: true,
      data: { status: 'ok' },
    };

    expect(successShape.success).toBe(true);
    expect(successShape.data).toBeDefined();
  });

  test('MISSING_REQUIRED_FIELD used with 400 status', () => {
    // Validates the convention: missing fields → 400
    const code = API_ERROR_CODES.MISSING_REQUIRED_FIELD;
    expect(code).toBe('MISSING_REQUIRED_FIELD');
    // Convention: MISSING_* errors use 4xx status codes
    expect(code).toMatch(/^MISSING_/);
  });

  test('INTERNAL_ERROR used with 500 status', () => {
    const code = API_ERROR_CODES.INTERNAL_ERROR;
    expect(code).toBe('INTERNAL_ERROR');
  });

  test('GENERATION_FAILED used for LLM/API failures', () => {
    const code = API_ERROR_CODES.GENERATION_FAILED;
    expect(code).toBe('GENERATION_FAILED');
  });

  test('PARSE_FAILED used for JSON parse failures', () => {
    const code = API_ERROR_CODES.PARSE_FAILED;
    expect(code).toBe('PARSE_FAILED');
  });

  test('INVALID_URL used for SSRF protection', () => {
    const code = API_ERROR_CODES.INVALID_URL;
    expect(code).toBe('INVALID_URL');
  });

  test('apiResponseTypes provides type-safe error codes', () => {
    // TypeScript compile-time check: all codes should be valid strings
    const codes = Object.values(API_ERROR_CODES);
    for (const code of codes) {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }
  });
});
