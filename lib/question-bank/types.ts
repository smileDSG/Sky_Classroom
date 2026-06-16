/**
 * Question Bank — dedicated table types.
 *
 * These types back the `question_bank` MySQL table and the DAO layer.
 * Separate from `lib/solve/types.ts` (which uses the KB system) to avoid
 * coupling the new dedicated table with legacy code.
 */

// ── Row types ───────────────────────────────────────────────────────

export interface QuestionBankRow {
  id: string;
  subject: string;
  grade: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  content: string;               // question text (may contain LaTeX)
  answer: string;
  explanation: string;
  knowledgePoints: string[];     // stored as JSON array
  image: string | null;          // base64 or URL
  options: string[] | null;      // for choice/judge questions
  source: string | null;         // e.g. "2024高考真题"
  tags: string[];                // arbitrary tags
  problemHash: string;           // dedup hash of content
  verified: boolean;
  createdAt: string;             // ISO datetime
  updatedAt: string;             // ISO datetime
}

// ── Insert / Update types ───────────────────────────────────────────

export interface QuestionBankInsert {
  id?: string;                   // auto-generated if omitted
  subject: string;
  grade: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  content: string;
  answer: string;
  explanation?: string;
  knowledgePoints?: string[];
  image?: string;
  options?: string[];
  source?: string;
  tags?: string[];
  verified?: boolean;
}

export interface QuestionBankUpdate {
  subject?: string;
  grade?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionType?: 'choice' | 'fill' | 'solve' | 'judge';
  content?: string;
  answer?: string;
  explanation?: string;
  knowledgePoints?: string[];
  image?: string;
  options?: string[];
  source?: string;
  tags?: string[];
  verified?: boolean;
}

// ── Filter / Query types ────────────────────────────────────────────

export interface QuestionBankFilter {
  subject?: string;
  grade?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionType?: 'choice' | 'fill' | 'solve' | 'judge';
  verified?: boolean;
  keyword?: string;              // FULLTEXT search on content
  knowledgePoint?: string;       // match knowledge_points
  tags?: string[];               // match any tag
  limit?: number;
  offset?: number;
}

// ── Import types ────────────────────────────────────────────────────

export interface ImportResult {
  total: number;
  inserted: number;
  duplicates: number;
  errors: { row: number; reason: string }[];
}
