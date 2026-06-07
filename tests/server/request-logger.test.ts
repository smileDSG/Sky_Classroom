/**
 * P1-003: Request logger middleware tests
 *
 * Tests createRequestLogInfo, logRequestEnd, and requestLogger.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger BEFORE importing the module (module-level createLogger call)
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  }),
}));

// Import after mock
const { createRequestLogInfo, logRequestEnd, requestLogger } = await import('@/lib/server/middleware/request-logger');

describe('createRequestLogInfo', () => {
  test('extracts method, path, query from Request', () => {
    const req = new Request('https://example.com/api/test?foo=bar', {
      method: 'GET',
    });
    const info = createRequestLogInfo(req);
    expect(info.method).toBe('GET');
    expect(info.path).toBe('/api/test');
    expect(info.query).toBe('?foo=bar');
    expect(info.url).toBe('https://example.com/api/test?foo=bar');
  });

  test('extracts user-agent header', () => {
    const req = new Request('https://example.com/api', {
      headers: { 'user-agent': 'TestAgent/1.0' },
    });
    const info = createRequestLogInfo(req);
    expect(info.userAgent).toBe('TestAgent/1.0');
  });

  test('extracts referer header', () => {
    const req = new Request('https://example.com/api', {
      headers: { referer: 'https://example.com' },
    });
    const info = createRequestLogInfo(req);
    expect(info.referer).toBe('https://example.com');
  });

  test('returns undefined for missing optional headers', () => {
    const req = new Request('https://example.com/api');
    const info = createRequestLogInfo(req);
    expect(info.userAgent).toBeUndefined();
    expect(info.referer).toBeUndefined();
  });

  test('sets startTime to current timestamp', () => {
    const now = Date.now();
    const req = new Request('https://example.com/api');
    const info = createRequestLogInfo(req);
    expect(info.startTime).toBeGreaterThanOrEqual(now);
  });

  test('handles POST request with query string', () => {
    const req = new Request('https://example.com/api/solve/explain?lang=zh', {
      method: 'POST',
    });
    const info = createRequestLogInfo(req);
    expect(info.method).toBe('POST');
    expect(info.path).toBe('/api/solve/explain');
    expect(info.query).toBe('?lang=zh');
  });
});

describe('logRequestEnd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('calculates duration correctly', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api'));
    info.startTime = 500;
    vi.setSystemTime(1500);
    logRequestEnd(info, 200);
    const msg = mockInfo.mock.calls[0][0] as string;
    expect(msg).toContain('1000ms');
  });

  test('uses info level for 2xx status', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api'));
    info.startTime = 0;
    logRequestEnd(info, 200);
    expect(mockInfo).toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  test('uses warn level for 4xx status', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api'));
    info.startTime = 0;
    logRequestEnd(info, 404);
    expect(mockWarn).toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  test('uses error level for 5xx status', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api'));
    info.startTime = 0;
    logRequestEnd(info, 500);
    expect(mockError).toHaveBeenCalled();
  });

  test('log message contains method, path, status, duration', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api/test'));
    info.startTime = 0;
    logRequestEnd(info, 201);
    const msg = mockInfo.mock.calls[0][0] as string;
    expect(msg).toContain('[GET]');
    expect(msg).toContain('/api/test');
    expect(msg).toContain('→ 201');
    expect(msg).toContain('ms');
  });

  test('payload includes method, path, status, durationMs', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api'));
    info.startTime = 0;
    logRequestEnd(info, 200);
    const payload = mockInfo.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.method).toBe('GET');
    expect(payload.path).toBe('/api');
    expect(payload.status).toBe(200);
    expect(payload.durationMs).toBe(1000);
  });

  test('spreads extra fields into payload', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api'));
    info.startTime = 0;
    logRequestEnd(info, 200, { userId: '123', action: 'login' });
    const payload = mockInfo.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.userId).toBe('123');
    expect(payload.action).toBe('login');
  });

  test('omits query from payload when empty', () => {
    const info = createRequestLogInfo(new Request('https://example.com/api'));
    info.startTime = 0;
    logRequestEnd(info, 200);
    const payload = mockInfo.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.query).toBeUndefined();
  });
});

describe('requestLogger', () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
  });

  test('returns object with info and end', () => {
    const req = new Request('https://example.com/api');
    const logger = requestLogger(req);
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('end');
    expect(typeof logger.end).toBe('function');
  });

  test('info contains request metadata', () => {
    const req = new Request('https://example.com/api/test?x=1', {
      method: 'POST',
      headers: { 'user-agent': 'test' },
    });
    const logger = requestLogger(req);
    expect(logger.info.method).toBe('POST');
    expect(logger.info.path).toBe('/api/test');
    expect(logger.info.query).toBe('?x=1');
    expect(logger.info.userAgent).toBe('test');
  });

  test('end() calls logRequestEnd', () => {
    const req = new Request('https://example.com/api');
    const logger = requestLogger(req);
    logger.end(200);
    expect(mockInfo).toHaveBeenCalled();
  });
});
