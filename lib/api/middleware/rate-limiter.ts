/**
 * API Rate Limiter — Request Rate Limiting Middleware
 *
 * Provides token-bucket rate limiting for API endpoints.
 * Uses an in-memory store (for serverless, consider Redis).
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
 *   export const POST = async (req) => {
 *     const result = limiter.consume(getClientIp(req));
 *     if (!result.allowed) return rateLimitResponse(result);
 *     ...
 *   };
 */

import { NextResponse } from 'next/server';

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Custom key prefix (e.g., 'chat:', 'generate:') */
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfter?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  limit: number;
  refillRate: number;
}

const buckets = new Map<string, TokenBucket>();

// Cleanup: remove stale buckets every 60s (idle > 5 min)
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_BUCKET_IDLE_MS = 300_000;
const MAX_BUCKETS = 10_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > MAX_BUCKET_IDLE_MS) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Create a token-bucket rate limiter.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const refillRate = config.maxRequests / config.windowMs;

  return {
    /**
     * Consume a token for the given key. Returns rate limit status.
     */
    consume(key: string): RateLimitResult {
      const bucketKey = `${config.prefix ?? ''}${key}`;
      const now = Date.now();
      let bucket = buckets.get(bucketKey);

      // Capacity protection: emergency cleanup if too many buckets
      if (buckets.size > MAX_BUCKETS) {
        const entries = Array.from(buckets.entries());
        entries
          .sort((a, b) => a[1].lastRefill - b[1].lastRefill)
          .slice(0, Math.floor(MAX_BUCKETS / 2))
          .forEach(([k]) => buckets.delete(k));
      }

      if (!bucket) {
        bucket = {
          tokens: config.maxRequests,
          lastRefill: now,
          limit: config.maxRequests,
          refillRate,
        };
        buckets.set(bucketKey, bucket);
      }

      // Refill tokens based on elapsed time
      const elapsed = now - bucket.lastRefill;
      const newTokens = elapsed * bucket.refillRate;
      bucket.tokens = Math.min(bucket.limit, bucket.tokens + newTokens);
      bucket.lastRefill = now;

      const resetAt = now + config.windowMs;

      if (bucket.tokens < 1) {
        const retryAfter = Math.ceil((1 - bucket.tokens) / bucket.refillRate / 1000);
        return {
          allowed: false,
          remaining: 0,
          limit: bucket.limit,
          resetAt,
          retryAfter,
        };
      }

      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        limit: bucket.limit,
        resetAt,
      };
    },

    /**
     * Reset rate limit for a key.
     */
    reset(key: string): void {
      buckets.delete(`${config.prefix ?? ''}${key}`);
    },

    /**
     * Clear all rate limits.
     */
    clear(): void {
      buckets.clear();
    },
  };
}

/**
 * Create a rate-limited NextResponse.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      errorCode: 'RATE_LIMITED',
      error: 'Rate limit exceeded',
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
        'Retry-After': String(result.retryAfter ?? 60),
      },
    },
  );
}

/**
 * Add rate limit headers to an existing response.
 */
export function addRateLimitHeaders(response: NextResponse, result: RateLimitResult): void {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.resetAt));
}

/**
 * Pre-configured rate limiters for common endpoints.
 */
export const rateLimiters = {
  /** Chat endpoint: 30 requests per minute */
  chat: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
    prefix: 'chat:',
  }),

  /** Generation endpoints: 10 requests per minute */
  generate: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    prefix: 'generate:',
  }),

  /** PDF parsing: 5 requests per minute */
  parsePdf: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 5,
    prefix: 'parse:',
  }),

  /** Health check: 60 requests per minute */
  health: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
    prefix: 'health:',
  }),
};

/**
 * Extract client IP from request (works with proxies).
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
