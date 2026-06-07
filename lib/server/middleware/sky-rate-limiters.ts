/**
 * Sky Classroom API Rate Limiters
 *
 * Per-endpoint token-bucket rate limiters for /api/sky/* routes.
 * These are more generous than the global limiters since sky routes
 * are student-facing and may see burst usage.
 */

import { createRateLimiter } from '@/lib/api/middleware/rate-limiter';

export const skyRateLimiters = {
  /** Image recognition (OCR): 10 per minute — vision models are expensive */
  recognize: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    prefix: 'sky:recognize:',
  }),

  /** Problem explanation: 10 per minute */
  explain: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    prefix: 'sky:explain:',
  }),

  /** Grading: 15 per minute */
  grade: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 15,
    prefix: 'sky:grade:',
  }),

  /** AI assistant chat: 20 per minute */
  assistant: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 20,
    prefix: 'sky:assistant:',
  }),

  /** Slide generation: 5 per minute — LLM-heavy */
  slidesGenerate: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 5,
    prefix: 'sky:slides:generate:',
  }),

  /** Avatar speak: 10 per minute */
  avatarSpeak: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    prefix: 'sky:avatar:speak:',
  }),

  /** Mistakes CRUD: 30 per minute — lightweight */
  mistakes: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
    prefix: 'sky:mistakes:',
  }),

  /** Question bank: 30 per minute — lightweight */
  questionBank: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
    prefix: 'sky:qbank:',
  }),

  /** Knowledge graph: 10 per minute — compute-heavy */
  knowledgeGraph: createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    prefix: 'sky:graph:',
  }),
};
