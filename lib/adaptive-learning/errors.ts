export const ADAPTIVE_LEARNING_ERROR_CODES = [
  'INVALID_SCHEMA',
  'AMBIGUOUS_CURRICULUM_MAPPING',
  'RESOURCE_GAP',
  'RESOURCE_INDEX_UNAVAILABLE',
  'PLAN_CONSTRAINT_VIOLATION',
  'DUPLICATE_EVENT',
  'SYNC_FAILED',
  'UNAUTHENTICATED',
  'CURRICULUM_VERSION_MISMATCH',
  'RETRY_EXHAUSTED',
] as const;

export type AdaptiveLearningErrorCode = (typeof ADAPTIVE_LEARNING_ERROR_CODES)[number];

export interface AdaptiveLearningErrorInput {
  code: AdaptiveLearningErrorCode;
  message: string;
  retryable: boolean;
  stage: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AdaptiveLearningError extends Error {
  readonly code: AdaptiveLearningErrorCode;
  readonly retryable: boolean;
  readonly stage: string;
  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(input: AdaptiveLearningErrorInput) {
    super(input.message);
    this.name = 'AdaptiveLearningError';
    this.code = input.code;
    this.retryable = input.retryable;
    this.stage = input.stage;
    this.details = input.details;
    this.cause = input.cause;
  }
}
