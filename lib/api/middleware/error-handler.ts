/**
 * API Error Handler — Unified Error Handling Middleware
 *
 * Provides a consistent error response format across all API routes.
 * Replaces scattered error handling with a centralized wrapper pattern.
 *
 * Usage:
 *   export const POST = withErrorHandler(async (req, ctx) => { ... }, { route: 'chat' });
 *
 *   Or manually:
 *   try { ... } catch (e) { return handleApiError(e, 'chat'); }
 */

import { NextResponse, NextRequest } from 'next/server';
import { apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import type { ApiErrorCode } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('ApiErrorHandler');

/**
 * Structured API error class.
 * Throw this instead of raw errors for consistent responses.
 */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status: number,
    message: string,
    public details?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Validation error — thrown when request body fails Zod validation.
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: string) {
    super(API_ERROR_CODES.INVALID_REQUEST, 400, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error.
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(API_ERROR_CODES.INVALID_REQUEST, 404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error.
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super(
      'RATE_LIMITED',
      429,
      'Rate limit exceeded',
      retryAfter ? `Retry after ${retryAfter}s` : undefined,
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Convert any error to a consistent API response.
 */
export function handleApiError(error: unknown, route?: string): NextResponse {
  if (error instanceof ApiError) {
    return apiError(error.code, error.status, error.message, error.details);
  }

  const message = error instanceof Error ? error.message : String(error);
  log.error(`[API${route ? `:${route}` : ''}] Unhandled error:`, error);

  return apiError(
    API_ERROR_CODES.INTERNAL_ERROR,
    500,
    'Internal server error',
    process.env.NODE_ENV === 'development' ? message : undefined,
  );
}

/**
 * Wrap an async route handler with unified error handling.
 * Catches all errors and returns a standardized JSON error response.
 */
export function withErrorHandler(
  handler: (req: NextRequest, ctx: Record<string, unknown>) => Promise<NextResponse>,
  options?: { route?: string },
) {
  return async (req: NextRequest, ctx: Record<string, unknown>) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return handleApiError(error, options?.route);
    }
  };
}

/**
 * Validate request body against a schema (Zod or manual).
 * Returns the parsed body or throws ValidationError.
 */
export function validateBody<T>(
  body: unknown,
  validate: (body: unknown) => { success: true; data: T } | { success: false; errors: string[] },
): T {
  const result = validate(body);
  if (result.success) return result.data;

  throw new ValidationError('Invalid request body', result.errors.join('; '));
}

/**
 * Require a non-empty field in the request body.
 */
export function requireField(value: unknown, fieldName: string): asserts value {
  if (!value) {
    throw new ValidationError(`Missing required field: ${fieldName}`);
  }
}
