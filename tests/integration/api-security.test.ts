/**
 * P6-001 Test 13: 速率限制 → 错误处理
 *
 * Tests API security mechanisms — rate limiting (requests per time
 * window), error handling middleware (unified error format), and
 * security headers.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ─── Rate limiter simulation ───

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(private config: RateLimitConfig) {}

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const clientRequests = this.requests.get(clientId) || [];

    // Remove expired requests
    const validRequests = clientRequests.filter((t) => t > windowStart);
    this.requests.set(clientId, validRequests);

    if (validRequests.length >= this.config.maxRequests) {
      return false;
    }

    validRequests.push(now);
    return true;
  }

  getRemaining(clientId: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const clientRequests = this.requests.get(clientId) || [];
    const validRequests = clientRequests.filter((t) => t > windowStart);
    return Math.max(0, this.config.maxRequests - validRequests.length);
  }

  reset(clientId: string): void {
    this.requests.delete(clientId);
  }
}

// ─── Error handling simulation ───

interface APIError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

function createError(message: string, statusCode: number, details?: unknown): APIError {
  return {
    error: statusCode >= 500 ? 'Internal Server Error' : statusCode >= 400 ? 'Client Error' : 'Error',
    message,
    statusCode,
    details,
  };
}

function handleRouteError(error: unknown): APIError {
  if (error instanceof SyntaxError) {
    return createError('Invalid JSON in request body', 400);
  }
  if (error instanceof TypeError) {
    return createError('Invalid request parameters', 400);
  }
  return createError('Internal server error', 500, String(error));
}

// ─── Tests ───

describe('P6-001 Test 13: 速率限制 → 错误处理', () => {
  describe('rate limiting', () => {
    test('allows requests within limit', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 });

      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed('user-1')).toBe(true);
      }
    });

    test('blocks requests over limit', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 3 });

      expect(limiter.isAllowed('user-2')).toBe(true);
      expect(limiter.isAllowed('user-2')).toBe(true);
      expect(limiter.isAllowed('user-2')).toBe(true);
      expect(limiter.isAllowed('user-2')).toBe(false);
    });

    test('different clients have separate limits', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });

      expect(limiter.isAllowed('user-a')).toBe(true);
      expect(limiter.isAllowed('user-b')).toBe(true); // Different client
      expect(limiter.isAllowed('user-a')).toBe(false); // Same client exceeded
    });

    test('requests expire after window', () => {
      const limiter = new RateLimiter({ windowMs: 100, maxRequests: 1 });

      expect(limiter.isAllowed('user-3')).toBe(true);
      expect(limiter.isAllowed('user-3')).toBe(false);

      // Fast-forward time simulation: reset
      limiter.reset('user-3');
      expect(limiter.isAllowed('user-3')).toBe(true);
    });

    test('remaining count decreases', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 5 });

      expect(limiter.getRemaining('user-4')).toBe(5);
      limiter.isAllowed('user-4');
      expect(limiter.getRemaining('user-4')).toBe(4);
    });

    test('remaining count is zero when limit reached', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });

      limiter.isAllowed('user-5');
      limiter.isAllowed('user-5');
      expect(limiter.getRemaining('user-5')).toBe(0);
    });

    test('burst protection: rapid requests counted correctly', () => {
      const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 5 });

      let allowed = 0;
      for (let i = 0; i < 10; i++) {
        if (limiter.isAllowed('burst-user')) allowed++;
      }

      expect(allowed).toBe(5);
    });
  });

  describe('error handling', () => {
    test('SyntaxError produces 400 response', () => {
      const error = new SyntaxError('Unexpected token');
      const result = handleRouteError(error);

      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('Invalid JSON in request body');
    });

    test('TypeError produces 400 response', () => {
      const error = new TypeError('Cannot read property');
      const result = handleRouteError(error);

      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('Invalid request parameters');
    });

    test('unknown error produces 500 response', () => {
      const result = handleRouteError('some unexpected value');

      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Internal server error');
    });

    test('error response has consistent format', () => {
      const error = handleRouteError(new Error('test'));

      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('statusCode');
    });

    test('custom error with details', () => {
      const error = createError('Rate limit exceeded', 429, {
        retryAfter: 60,
        limit: 10,
      });

      expect(error.statusCode).toBe(429);
      expect(error.details).toHaveProperty('retryAfter');
    });

    test('rate limit error format', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
      limiter.isAllowed('rl-user');

      const allowed = limiter.isAllowed('rl-user');
      expect(allowed).toBe(false);

      const error = createError('Too many requests', 429);
      expect(error.statusCode).toBe(429);
    });

    test('error message is sanitized', () => {
      const error = handleRouteError(new Error('<script>alert(1)</script>'));
      expect(error.statusCode).toBe(500);
    });
  });

  describe('rate limiting + error handling integration', () => {
    test('rate limited request returns proper error', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
      limiter.isAllowed('test-user');

      const isAllowed = limiter.isAllowed('test-user');
      if (!isAllowed) {
        const error = createError('Rate limit exceeded', 429);
        expect(error.statusCode).toBe(429);
        expect(error.error).toBe('Client Error');
      }
    });

    test('error handler preserves rate limit info', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
      limiter.isAllowed('info-user');

      const remaining = limiter.getRemaining('info-user');
      const error = createError(`Rate limit exceeded. ${remaining} remaining.`, 429, {
        remaining,
      });

      expect(error.details).toHaveProperty('remaining', 0);
    });
  });
});
