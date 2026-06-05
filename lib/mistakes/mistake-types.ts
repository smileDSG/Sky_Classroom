/**
 * Module C — Client-side mistake type definitions.
 *
 * Core types (ErrorType, MistakeBookEntry) are re-exported from the
 * canonical DAO definition so there is a single source of truth.
 * Client-specific request/response types and UI labels are defined here.
 */

import type { ErrorType, MistakeBookEntry } from '@/lib/storage/dao/mistakes';

// Re-export canonical types
export type { ErrorType, MistakeBookEntry };

/** Label mapping for UI display */
export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  calculation: '计算错误',
  concept: '概念不清',
  reasoning: '逻辑错误',
  reading: '审题错误',
  careless: '粗心',
};

/** Request body for POST /api/sky/mistakes */
export interface CreateMistakeRequest {
  problemText: string;
  problemImage?: string;
  userAnswer: string;
  correctAnswer: string;
  errorType: ErrorType;
  errorExplanation?: string;
  knowledgePoints: string[];
  sourceSessionId?: string;
}

/** Request body for PATCH /api/sky/mistakes */
export interface UpdateMistakeRequest {
  reviewed?: boolean;
  errorExplanation?: string;
}

/** Query params for GET /api/sky/mistakes */
export interface MistakeQueryParams {
  errorType?: ErrorType;
  reviewed?: boolean;
  masteryBelow?: number;
  page?: number;
  pageSize?: number;
}

/** Standard API response wrapper */
export interface MistakeListResponse {
  items: MistakeBookEntry[];
  total: number;
}
