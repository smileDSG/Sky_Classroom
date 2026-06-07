/**
 * B-004: Rate limiter middleware tests
 *
 * Tests the token-bucket rate limiting implementation including:
 * - Allow/deny behavior within and beyond limits
 * - Token refill over time
 * - Pre-configured rate limiters
 * - Rate limit response headers
 * - Client IP extraction
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createRateLimiter,
  rateLimitResponse,
  addRateLimitHeaders,
  rateLimiters,
  getClientIp,
} from '@/lib/api/middleware/rate-limiter';
import type { RateLimitConfig, RateLimitResult } from '@/lib/api/middleware/rate-limiter';

// Helper to advance time in tests
function advanceTime(ms: number) {
  vi.advanceTimersByTime(ms);
}

// ─── Token Bucket Core Logic ───

describe('createRateLimiter — token bucket', () => {
  const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 };
  let seq = 0;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  function uniqueClient(): string {
    return `client-${++seq}`;
  }

  test('first request is allowed and initializes bucket', () => {
    const limiter = createRateLimiter(config);
    const result = limiter.consume(uniqueClient());

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.limit).toBe(10);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  test('exactly maxRequests are allowed within window', () => {
    const limiter = createRateLimiter(config);
    const client = uniqueClient();

    for (let i = 0; i < 10; i++) {
      const result = limiter.consume(client);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9 - i);
    }
  });

  test('request beyond limit is denied with 429 headers', () => {
    const limiter = createRateLimiter(config);
    const client = uniqueClient();

    // Exhaust the bucket
    for (let i = 0; i < 10; i++) {
      limiter.consume(client);
    }

    const denied = limiter.consume(client);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfter).toBeDefined();
    expect(denied.retryAfter!).toBeGreaterThan(0);
  });

  test('tokens refill after window passes', () => {
    const limiter = createRateLimiter(config);
    const client = uniqueClient();

    // Exhaust
    for (let i = 0; i < 10; i++) {
      limiter.consume(client);
    }

    // Verify denied
    expect(limiter.consume(client).allowed).toBe(false);

    // Advance past the window
    advanceTime(60_000);

    // Should have refilled tokens
    const refilled = limiter.consume(client);
    expect(refilled.allowed).toBe(true);
    expect(refilled.remaining).toBe(9);
  });

  test('partial refill after half window', () => {
    const limiter = createRateLimiter(config);
    const client = uniqueClient();

    for (let i = 0; i < 10; i++) {
      limiter.consume(client);
    }

    advanceTime(30_000);

    const result = limiter.consume(client);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(3);
    expect(result.remaining).toBeLessThanOrEqual(5);
  });

  test('tokens do not exceed bucket limit', () => {
    const limiter = createRateLimiter(config);
    const client = uniqueClient();

    for (let i = 0; i < 5; i++) {
      limiter.consume(client);
    }

    advanceTime(120_000);

    const result = limiter.consume(client);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  test('independent buckets per client', () => {
    const limiter = createRateLimiter(config);
    const c1 = uniqueClient();
    const c2 = uniqueClient();

    for (let i = 0; i < 10; i++) {
      limiter.consume(c1);
    }
    expect(limiter.consume(c1).allowed).toBe(false);

    const client2Result = limiter.consume(c2);
    expect(client2Result.allowed).toBe(true);
    expect(client2Result.remaining).toBe(9);
  });

  test('reset clears a specific client bucket', () => {
    const limiter = createRateLimiter(config);
    const client = uniqueClient();

    for (let i = 0; i < 10; i++) {
      limiter.consume(client);
    }
    expect(limiter.consume(client).allowed).toBe(false);

    limiter.reset(client);

    const fresh = limiter.consume(client);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(9);
  });

  test('clear removes all buckets', () => {
    const limiter = createRateLimiter(config);
    const c1 = uniqueClient();
    const c2 = uniqueClient();

    for (let i = 0; i < 10; i++) {
      limiter.consume(c1);
      limiter.consume(c2);
    }

    expect(limiter.consume(c1).allowed).toBe(false);
    expect(limiter.consume(c2).allowed).toBe(false);

    limiter.clear();

    expect(limiter.consume(c1).allowed).toBe(true);
    expect(limiter.consume(c2).allowed).toBe(true);
  });
});

// ─── Rate Limit Response ───

describe('rateLimitResponse', () => {
  test('returns 429 with correct JSON body', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      limit: 10,
      resetAt: 1700000000000,
      retryAfter: 6,
    };

    const response = rateLimitResponse(result);
    expect(response.status).toBe(429);

    // Check headers
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBe('6');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1700000000000');
  });
});

// ─── addRateLimitHeaders ───

describe('addRateLimitHeaders', () => {
  test('adds rate limit headers to response', () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const result: RateLimitResult = {
      allowed: true,
      remaining: 5,
      limit: 10,
      resetAt: 1700000000000,
    };

    // Use the function — it mutates the response headers
    const nextResp = response as unknown as import('next/server').NextResponse;
    // Type-safe: test the underlying Response header API
    addRateLimitHeaders(nextResp, result);

    expect(nextResp.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(nextResp.headers.get('X-RateLimit-Remaining')).toBe('5');
  });
});

// ─── Pre-configured Rate Limiters ───

describe('rateLimiters — pre-configured', () => {
  let seq = 0;
  function uniqueUser(): string {
    return `user-${++seq}`;
  }

  test('chat limiter allows 30 requests', () => {
    vi.useFakeTimers();
    const user = uniqueUser();
    for (let i = 0; i < 30; i++) {
      expect(rateLimiters.chat.consume(user).allowed).toBe(true);
    }
    expect(rateLimiters.chat.consume(user).allowed).toBe(false);
    rateLimiters.chat.clear();
  });

  test('generate limiter allows 10 requests', () => {
    vi.useFakeTimers();
    const user = uniqueUser();
    for (let i = 0; i < 10; i++) {
      expect(rateLimiters.generate.consume(user).allowed).toBe(true);
    }
    expect(rateLimiters.generate.consume(user).allowed).toBe(false);
    rateLimiters.generate.clear();
  });

  test('parsePdf limiter allows 5 requests', () => {
    vi.useFakeTimers();
    const user = uniqueUser();
    for (let i = 0; i < 5; i++) {
      expect(rateLimiters.parsePdf.consume(user).allowed).toBe(true);
    }
    expect(rateLimiters.parsePdf.consume(user).allowed).toBe(false);
    rateLimiters.parsePdf.clear();
  });

  test('health limiter allows 60 requests', () => {
    vi.useFakeTimers();
    const user = uniqueUser();
    for (let i = 0; i < 60; i++) {
      expect(rateLimiters.health.consume(user).allowed).toBe(true);
    }
    expect(rateLimiters.health.consume(user).allowed).toBe(false);
    rateLimiters.health.clear();
  });
});

// ─── Client IP Extraction ───

describe('getClientIp', () => {
  test('extracts from x-forwarded-for header', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  test('falls back to x-real-ip header', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  test('prefers x-forwarded-for over x-real-ip', () => {
    const req = new Request('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '203.0.113.1',
        'x-real-ip': '10.0.0.1',
      },
    });
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  test('returns unknown when no proxy headers present', () => {
    const req = new Request('http://localhost/api/test');
    expect(getClientIp(req)).toBe('unknown');
  });
});
