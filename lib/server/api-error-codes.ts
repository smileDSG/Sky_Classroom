/**
 * API Error Code Definitions
 *
 * Centralised error codes for all API responses.
 * Each code maps to a human-readable message and HTTP status.
 */

/** Known API error codes */
export const API_ERROR_CODES = {
  /** The request is missing a required field */
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  /** The request is missing a required API key */
  MISSING_API_KEY: 'MISSING_API_KEY',
  /** The request contains invalid data (failed Zod validation) */
  INVALID_REQUEST: 'INVALID_REQUEST',
  /** Rate limit exceeded */
  RATE_LIMITED: 'RATE_LIMITED',
  /** VoxCPM auto-voice requires prior context/audio */
  VOXCPM_AUTO_VOICE_REQUIRES_CONTEXT: 'VOXCPM_AUTO_VOICE_REQUIRES_CONTEXT',
  /** The provided URL is invalid or unreachable */
  INVALID_URL: 'INVALID_URL',
  /** Redirect not allowed for this resource */
  REDIRECT_NOT_ALLOWED: 'REDIRECT_NOT_ALLOWED',
  /** Content flagged as sensitive */
  CONTENT_SENSITIVE: 'CONTENT_SENSITIVE',
  /** Upstream provider returned an error */
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  /** Generation task failed */
  GENERATION_FAILED: 'GENERATION_FAILED',
  /** Transcription task failed */
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  /** Parsing task failed */
  PARSE_FAILED: 'PARSE_FAILED',
  /** An internal server error occurred */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Storage operation failed */
  STORAGE_ERROR: 'STORAGE_ERROR',
  /** Resource not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Unauthorized access */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Authenticated user is not allowed to access this resource */
  FORBIDDEN: 'FORBIDDEN',
  /** Duplicate resource */
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  /** Invalid login credentials */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** Email already registered */
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  /** Username already taken */
  USERNAME_EXISTS: 'USERNAME_EXISTS',
  /** Account is suspended */
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  /** Usage limit exceeded */
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  /** Insufficient plan permissions */
  INSUFFICIENT_PLAN: 'INSUFFICIENT_PLAN',
  /** Order not found */
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  /** Payment failed */
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  /** Email not verified */
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  /** Invalid or expired verification token */
  VERIFY_TOKEN_INVALID: 'VERIFY_TOKEN_INVALID',
  /** Invalid or expired reset token */
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  /** File too large */
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  /** Invalid file type */
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  /** Learner profile does not exist */
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  /** Learner profile is missing fields required by a consumer */
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  /** Learner profile snapshot is stale */
  PROFILE_STALE: 'PROFILE_STALE',
  /** Learner profile version changed concurrently */
  PROFILE_VERSION_CONFLICT: 'PROFILE_VERSION_CONFLICT',
  /** Learner profile projection could not be built */
  PROFILE_PROJECTION_FAILED: 'PROFILE_PROJECTION_FAILED',
  /** Learning evidence was rejected by profile policy */
  PROFILE_EVIDENCE_REJECTED: 'PROFILE_EVIDENCE_REJECTED',
  /** Required persistent storage is unavailable */
  PERSISTENT_STORAGE_UNAVAILABLE: 'PERSISTENT_STORAGE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Default HTTP status for each error code */
export const ERROR_CODE_STATUS: Record<ApiErrorCode, number> = {
  MISSING_REQUIRED_FIELD: 400,
  MISSING_API_KEY: 401,
  INVALID_REQUEST: 400,
  RATE_LIMITED: 429,
  VOXCPM_AUTO_VOICE_REQUIRES_CONTEXT: 400,
  INVALID_URL: 400,
  REDIRECT_NOT_ALLOWED: 403,
  CONTENT_SENSITIVE: 400,
  UPSTREAM_ERROR: 502,
  GENERATION_FAILED: 500,
  TRANSCRIPTION_FAILED: 500,
  PARSE_FAILED: 400,
  INTERNAL_ERROR: 500,
  STORAGE_ERROR: 500,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  DUPLICATE_RESOURCE: 409,
  INVALID_CREDENTIALS: 401,
  EMAIL_EXISTS: 409,
  USERNAME_EXISTS: 409,
  ACCOUNT_SUSPENDED: 403,
  USAGE_LIMIT_EXCEEDED: 429,
  INSUFFICIENT_PLAN: 403,
  ORDER_NOT_FOUND: 404,
  PAYMENT_FAILED: 502,
  EMAIL_NOT_VERIFIED: 403,
  VERIFY_TOKEN_INVALID: 400,
  RESET_TOKEN_INVALID: 400,
  FILE_TOO_LARGE: 413,
  INVALID_FILE_TYPE: 400,
  PROFILE_NOT_FOUND: 404,
  PROFILE_INCOMPLETE: 422,
  PROFILE_STALE: 409,
  PROFILE_VERSION_CONFLICT: 409,
  PROFILE_PROJECTION_FAILED: 500,
  PROFILE_EVIDENCE_REJECTED: 422,
  PERSISTENT_STORAGE_UNAVAILABLE: 503,
};

/** Default human-readable message for each error code */
export const ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  MISSING_REQUIRED_FIELD: 'Missing required field',
  MISSING_API_KEY: 'API key is required',
  INVALID_REQUEST: 'Invalid request',
  RATE_LIMITED: 'Rate limit exceeded',
  VOXCPM_AUTO_VOICE_REQUIRES_CONTEXT: 'Auto-voice requires prior context',
  INVALID_URL: 'Invalid URL',
  REDIRECT_NOT_ALLOWED: 'Redirect not allowed',
  CONTENT_SENSITIVE: 'Content flagged as sensitive',
  UPSTREAM_ERROR: 'Upstream service error',
  GENERATION_FAILED: 'Generation failed',
  TRANSCRIPTION_FAILED: 'Transcription failed',
  PARSE_FAILED: 'Parse failed',
  INTERNAL_ERROR: 'Internal server error',
  STORAGE_ERROR: 'Storage operation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  DUPLICATE_RESOURCE: 'Resource already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_EXISTS: 'Email already registered',
  USERNAME_EXISTS: 'Username already taken',
  ACCOUNT_SUSPENDED: 'Account is suspended',
  USAGE_LIMIT_EXCEEDED: 'Usage limit exceeded',
  INSUFFICIENT_PLAN: 'Insufficient plan permissions',
  ORDER_NOT_FOUND: 'Order not found',
  PAYMENT_FAILED: 'Payment processing failed',
  EMAIL_NOT_VERIFIED: 'Please verify your email address first',
  VERIFY_TOKEN_INVALID: 'Invalid or expired verification token',
  RESET_TOKEN_INVALID: 'Invalid or expired reset token',
  FILE_TOO_LARGE: 'File size exceeds the limit',
  INVALID_FILE_TYPE: 'Invalid file type',
  PROFILE_NOT_FOUND: 'Learner profile not found',
  PROFILE_INCOMPLETE: 'Learner profile is incomplete',
  PROFILE_STALE: 'Learner profile is stale',
  PROFILE_VERSION_CONFLICT: 'Learner profile version conflict',
  PROFILE_PROJECTION_FAILED: 'Learner profile projection failed',
  PROFILE_EVIDENCE_REJECTED: 'Learning evidence rejected',
  PERSISTENT_STORAGE_UNAVAILABLE: 'Persistent storage unavailable',
};
