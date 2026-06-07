/**
 * P1-003: CORS middleware tests
 *
 * Tests buildCorsHeaders, withCors, corsPreflightResponse, createProductionCorsConfig.
 */
import { describe, test, expect } from 'vitest';
import {
  buildCorsHeaders,
  withCors,
  corsPreflightResponse,
  createProductionCorsConfig,
  DEFAULT_CORS_CONFIG,
  type CorsConfig,
} from '@/lib/server/middleware/cors';

// ─── buildCorsHeaders ───

describe('buildCorsHeaders', () => {
  test('returns wildcard origin when origins includes *', () => {
    const config: CorsConfig = {
      origins: ['*'],
      methods: ['GET'],
      allowedHeaders: ['Content-Type'],
      allowCredentials: false,
      maxAge: 3600,
    };
    const headers = buildCorsHeaders(config);
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('returns specific origin when credentials enabled and origin matches', () => {
    const config: CorsConfig = {
      origins: ['https://example.com'],
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      allowCredentials: true,
      maxAge: 3600,
    };
    const headers = buildCorsHeaders(config, 'https://example.com');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
  });

  test('returns empty string when credentials enabled but origin not in list', () => {
    const config: CorsConfig = {
      origins: ['https://example.com'],
      methods: ['GET'],
      allowedHeaders: ['Content-Type'],
      allowCredentials: true,
      maxAge: 3600,
    };
    const headers = buildCorsHeaders(config, 'https://evil.com');
    expect(headers).toEqual({});
  });

  test('returns first origin when credentials disabled and no wildcard', () => {
    const config: CorsConfig = {
      origins: ['https://example.com', 'https://other.com'],
      methods: ['GET'],
      allowedHeaders: ['Content-Type'],
      allowCredentials: false,
      maxAge: 3600,
    };
    const headers = buildCorsHeaders(config);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
  });

  test('includes Access-Control-Allow-Methods joined by comma', () => {
    const headers = buildCorsHeaders(DEFAULT_CORS_CONFIG);
    expect(headers['Access-Control-Allow-Methods']).toBe(
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
  });

  test('includes Access-Control-Allow-Headers joined by comma', () => {
    const headers = buildCorsHeaders(DEFAULT_CORS_CONFIG);
    expect(headers['Access-Control-Allow-Headers']).toBe(
      'Content-Type, Authorization, X-Requested-With',
    );
  });

  test('includes Allow-Credentials: true when enabled', () => {
    const config: CorsConfig = {
      origins: ['https://example.com'],
      methods: ['GET'],
      allowedHeaders: ['Content-Type'],
      allowCredentials: true,
      maxAge: 3600,
    };
    const headers = buildCorsHeaders(config, 'https://example.com');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  test('omits Allow-Credentials when disabled', () => {
    const headers = buildCorsHeaders(DEFAULT_CORS_CONFIG);
    expect(headers).not.toHaveProperty('Access-Control-Allow-Credentials');
  });

  test('includes Max-Age as string', () => {
    const headers = buildCorsHeaders(DEFAULT_CORS_CONFIG);
    expect(headers['Access-Control-Max-Age']).toBe('86400');
  });

  test('returns empty object when origin not allowed with credentials', () => {
    const config: CorsConfig = {
      origins: ['https://allowed.com'],
      methods: ['GET'],
      allowedHeaders: [],
      allowCredentials: true,
      maxAge: 3600,
    };
    const headers = buildCorsHeaders(config, 'https://not-allowed.com');
    expect(Object.keys(headers)).toHaveLength(0);
  });
});

// ─── withCors ───

describe('withCors', () => {
  test('sets CORS headers on response with default config', () => {
    const res = new Response(null, { status: 200 });
    const result = withCors(res);
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(result).toBe(res); // same response object
  });

  test('sets CORS headers with custom config', () => {
    const res = new Response(null);
    const config: CorsConfig = {
      origins: ['https://app.example.com'],
      methods: ['POST'],
      allowedHeaders: ['X-Custom'],
      allowCredentials: false,
      maxAge: 1800,
    };
    const result = withCors(res, config);
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(result.headers.get('Access-Control-Allow-Methods')).toBe('POST');
    expect(result.headers.get('Access-Control-Max-Age')).toBe('1800');
  });

  test('passes requestOrigin for credentials-based origin matching', () => {
    const res = new Response(null);
    const config: CorsConfig = {
      origins: ['https://trusted.com'],
      methods: ['GET'],
      allowedHeaders: [],
      allowCredentials: true,
      maxAge: 3600,
    };
    withCors(res, config, 'https://trusted.com');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://trusted.com');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });
});

// ─── corsPreflightResponse ───

describe('corsPreflightResponse', () => {
  test('returns 204 status', () => {
    const res = corsPreflightResponse();
    expect(res.status).toBe(204);
  });

  test('includes CORS headers', () => {
    const res = corsPreflightResponse();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
  });

  test('uses custom config', () => {
    const config: CorsConfig = {
      origins: ['https://api.example.com'],
      methods: ['PUT', 'DELETE'],
      allowedHeaders: ['Authorization'],
      allowCredentials: false,
      maxAge: 7200,
    };
    const res = corsPreflightResponse(config);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://api.example.com');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('PUT, DELETE');
  });
});

// ─── createProductionCorsConfig ───

describe('createProductionCorsConfig', () => {
  test('sets given origins', () => {
    const config = createProductionCorsConfig(['https://prod.com']);
    expect(config.origins).toEqual(['https://prod.com']);
  });

  test('enables credentials', () => {
    const config = createProductionCorsConfig(['https://prod.com']);
    expect(config.allowCredentials).toBe(true);
  });

  test('includes standard methods and headers', () => {
    const config = createProductionCorsConfig(['https://prod.com']);
    expect(config.methods).toContain('GET');
    expect(config.methods).toContain('POST');
    expect(config.allowedHeaders).toContain('Content-Type');
    expect(config.allowedHeaders).toContain('Authorization');
    expect(config.maxAge).toBe(86400);
  });

  test('supports multiple origins', () => {
    const config = createProductionCorsConfig(['https://a.com', 'https://b.com']);
    expect(config.origins).toEqual(['https://a.com', 'https://b.com']);
  });
});

// ─── DEFAULT_CORS_CONFIG ───

describe('DEFAULT_CORS_CONFIG', () => {
  test('allows all origins in development', () => {
    expect(DEFAULT_CORS_CONFIG.origins).toEqual(['*']);
  });

  test('includes all HTTP methods', () => {
    expect(DEFAULT_CORS_CONFIG.methods).toEqual([
      'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS',
    ]);
  });

  test('has standard allowed headers', () => {
    expect(DEFAULT_CORS_CONFIG.allowedHeaders).toEqual([
      'Content-Type', 'Authorization', 'X-Requested-With',
    ]);
  });

  test('credentials disabled by default', () => {
    expect(DEFAULT_CORS_CONFIG.allowCredentials).toBe(false);
  });

  test('max age is 86400 seconds (24 hours)', () => {
    expect(DEFAULT_CORS_CONFIG.maxAge).toBe(86400);
  });
});
