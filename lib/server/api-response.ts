/**
 * Unified API Response Utilities
 *
 * All API route handlers should use `apiSuccess` / `apiError` for consistent
 * response shape: `{ success, ...data }` or `{ success: false, errorCode, error, details? }`.
 */

import { NextResponse } from 'next/server';
import { API_ERROR_CODES, type ApiErrorCode, ERROR_CODE_MESSAGES } from './api-error-codes';

export { API_ERROR_CODES, ERROR_CODE_MESSAGES } from './api-error-codes';
export type { ApiErrorCode } from './api-error-codes';

export interface ApiErrorBody {
  success: false;
  errorCode: ApiErrorCode;
  error: string;
  details?: string;
}

/**
 * Create a standardised error JSON response.
 *
 * @param code    – One of the defined API_ERROR_CODES
 * @param status  – HTTP status code
 * @param error   – Human-readable error message (overrides default)
 * @param details – Optional detail string (validation errors, stack trace, etc.)
 */
export function apiError(
  code: ApiErrorCode,
  status: number,
  error: string,
  details?: string,
  headers?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      success: false as const,
      errorCode: code,
      error,
      ...(details ? { details } : {}),
    },
    { status, headers },
  );
}

/**
 * Create a standardised success JSON response.
 *
 * The `data` object is spread at the top level alongside `success: true`.
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status, headers });
}
