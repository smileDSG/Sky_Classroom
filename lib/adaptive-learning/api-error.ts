import 'server-only';

import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  AdaptiveLearningError,
  type AdaptiveLearningErrorCode,
} from '@/lib/adaptive-learning/errors';

const STATUS_BY_CODE: Partial<Record<AdaptiveLearningErrorCode, number>> = {
  INVALID_SCHEMA: 400,
  AMBIGUOUS_CURRICULUM_MAPPING: 409,
  RESOURCE_GAP: 404,
  RESOURCE_INDEX_UNAVAILABLE: 503,
  PLAN_CONSTRAINT_VIOLATION: 409,
  DUPLICATE_EVENT: 409,
  SYNC_FAILED: 503,
  UNAUTHENTICATED: 401,
  CURRICULUM_VERSION_MISMATCH: 409,
  RETRY_EXHAUSTED: 503,
};

export function createCorrelationId(requestValue?: string | null): string {
  const provided = requestValue?.trim();
  return provided || randomUUID();
}

function normalizeError(error: unknown): AdaptiveLearningError {
  if (error instanceof AdaptiveLearningError) return error;

  return new AdaptiveLearningError({
    code: 'RESOURCE_INDEX_UNAVAILABLE',
    message: 'Math resource index is unavailable',
    retryable: false,
    stage: 'math-resources-api',
    cause: error,
  });
}

export function adaptiveLearningApiError(error: unknown, correlationId: string): NextResponse {
  const normalized = normalizeError(error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
        stage: normalized.stage,
        details: normalized.details ?? {},
        correlationId,
      },
    },
    {
      status: STATUS_BY_CODE[normalized.code] ?? 503,
      headers: { 'x-correlation-id': correlationId },
    },
  );
}
