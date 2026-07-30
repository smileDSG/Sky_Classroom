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
  PROFILE_NOT_FOUND: 404,
  PROFILE_INCOMPLETE: 422,
  PROFILE_STALE: 409,
  PROFILE_VERSION_CONFLICT: 409,
  PROFILE_PROJECTION_FAILED: 500,
  PROFILE_EVIDENCE_REJECTED: 422,
  PERSISTENT_STORAGE_UNAVAILABLE: 503,
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

function publicDetails(error: AdaptiveLearningError): Record<string, unknown> {
  const details = error.details ?? {};
  switch (error.code) {
    case 'INVALID_SCHEMA':
      return {
        ...(Array.isArray(details.issues) ? { issues: details.issues } : {}),
        ...(Array.isArray(details.duplicateKeys) ? { duplicateKeys: details.duplicateKeys } : {}),
      };
    case 'RESOURCE_GAP':
      return {
        ...(Array.isArray(details.nodeIds) ? { nodeIds: details.nodeIds } : {}),
        ...(typeof details.expectedResourceType === 'string'
          ? { expectedResourceType: details.expectedResourceType }
          : {}),
        ...(typeof details.maxDifficulty === 'number'
          ? { maxDifficulty: details.maxDifficulty }
          : {}),
      };
    case 'CURRICULUM_VERSION_MISMATCH':
      return {
        ...('expected' in details
          ? { expected: details.expected }
          : 'expectedCurriculumPackId' in details
            ? { expected: details.expectedCurriculumPackId }
            : {}),
        ...('actual' in details
          ? { actual: details.actual }
          : 'actualCurriculumPackId' in details
            ? { actual: details.actualCurriculumPackId }
            : {}),
      };
    case 'SYNC_FAILED': {
      const causeType =
        typeof details.causeType === 'string'
          ? details.causeType
          : error.cause instanceof Error
            ? error.cause.name
            : error.cause === undefined
              ? undefined
              : typeof error.cause;
      return causeType ? { causeType } : {};
    }
    default:
      return {};
  }
}

function publicMessage(error: AdaptiveLearningError): string {
  if (error.code === 'RESOURCE_INDEX_UNAVAILABLE') return 'Math resource index is unavailable';
  if (error.code === 'SYNC_FAILED') return 'Math resource service dependency is unavailable';
  return error.message;
}

export function adaptiveLearningApiError(error: unknown, correlationId: string): NextResponse {
  const normalized = normalizeError(error);
  if (normalized.code === 'RESOURCE_INDEX_UNAVAILABLE' || normalized.code === 'SYNC_FAILED') {
    console.error('Adaptive learning API internal failure', {
      correlationId,
      code: normalized.code,
      stage: normalized.stage,
      message: normalized.message,
      details: normalized.details ?? {},
      cause: normalized.cause,
    });
  }
  return NextResponse.json(
    {
      success: false,
      error: {
        code: normalized.code,
        message: publicMessage(normalized),
        retryable: normalized.retryable,
        stage: normalized.stage,
        details: publicDetails(normalized),
        correlationId,
      },
    },
    {
      status: STATUS_BY_CODE[normalized.code] ?? 503,
      headers: { 'x-correlation-id': correlationId },
    },
  );
}
