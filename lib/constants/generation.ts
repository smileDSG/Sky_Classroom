/**
 * Constants for PDF content generation
 * Shared between client and server code
 */

// PDF content truncation limit (characters)
export const MAX_PDF_CONTENT_CHARS = 50000;

// Maximum number of images to send as vision content parts
export const MAX_VISION_IMAGES = 20;

// Maximum concurrent scene generation calls (limits parallel AI API requests)
export const GENERATION_CONCURRENCY = 6;

/**
 * Resolve optimal concurrency based on available key pool size.
 * Each key can handle ~1 concurrent request before rate limiting.
 * Returns a value between 2 and 12.
 */
export function resolveConcurrency(keyPoolSize: number): number {
  const MIN_CONCURRENCY = 2;
  const MAX_CONCURRENCY = 12;
  return Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, keyPoolSize));
}
