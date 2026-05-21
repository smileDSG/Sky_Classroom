/**
 * Module C — Client-side mistake type definitions.
 *
 * Mirrors the DAO's MistakeBookEntry so components and hooks can
 * consume the API response without importing from lib/storage/dao.
 */

/** Error type classification — kept in sync with lib/storage/dao/mistakes.ts */
export type ErrorType =
  | 'calculation'   // Arithmetic / algebraic mistake
  | 'concept'       // Misunderstood concept
  | 'reasoning'     // Logical reasoning error
  | 'reading'       // Misread the question
  | 'careless';     // Simple oversight

/** Label mapping for UI display */
export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  calculation: '计算错误',
  concept: '概念不清',
  reasoning: '逻辑错误',
  reading: '审题错误',
  careless: '粗心',
};

/** A single mistake entry — mirrors MistakeBookEntry from the DAO */
export interface MistakeBookEntry {
  id: string;
  problemText: string;
  problemImage?: string;
  userAnswer: string;
  correctAnswer: string;
  errorType: ErrorType;
  errorExplanation?: string;
  knowledgePoints: string[];
  reviewCount: number;
  lastReview?: number;
  nextReview?: number;
  masteryLevel: number;
  reviewed: boolean;
  sourceSessionId?: string;
}

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
