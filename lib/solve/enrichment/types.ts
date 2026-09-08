/**
 * Enrichment module types — background knowledge enrichment agent.
 *
 * This module periodically searches the web for educational problems,
 * solves them via the existing solve pipeline, and stores high-confidence
 * solutions in the question bank.
 */

import type { SolverAgentType } from '../types';

// ── Subject & grade taxonomy ────────────────────────────────────────

export type SubjectId =
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'chinese'
  | 'english'
  | 'biology'
  | 'history'
  | 'geography'
  | 'politics';

export type GradeLevel = 'junior' | 'senior' | 'college';

export interface SubjectConfig {
  id: SubjectId;
  label: string; // Chinese display name
  labelEn: string; // English display name
  searchKeywords: string[]; // Bing search query templates
  gradeLevels: GradeLevel[];
  priority: number; // 1 = highest
}

export interface GradeConfig {
  id: GradeLevel;
  label: string;
  searchSuffix: string; // e.g. "高中" "初中" "大学"
}

// ── Search ──────────────────────────────────────────────────────────

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

export interface SearchQuery {
  subject: SubjectId;
  gradeLevel: GradeLevel;
  query: string;
  maxResults: number;
}

// ── Fetched page ────────────────────────────────────────────────────

export interface FetchedPage {
  url: string;
  domain: string;
  title: string;
  textContent: string; // extracted text (no HTML tags)
  fetchedAt: number;
  robotsAllowed: boolean;
}

// ── Extracted question ──────────────────────────────────────────────

export interface ExtractedQuestion {
  /** Raw problem text extracted from the page */
  problemText: string;
  /** Subject classification */
  subject: SubjectId;
  /** Grade level */
  gradeLevel: GradeLevel;
  /** Question type: choice / fill / solve / judge */
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  /** Answer if provided on the source page */
  sourceAnswer?: string;
  /** Source URL */
  sourceUrl: string;
  /** Extraction confidence (0-1) from LLM */
  extractionConfidence: number;
}

// ── Enrich result (one question through the pipeline) ───────────────

export interface EnrichQuestionResult {
  /** Original extracted question */
  extracted: ExtractedQuestion;
  /** Whether the solve was successful */
  solved: boolean;
  /** The solved solution text */
  solution?: string;
  /** Agent type used for solving */
  agentType?: SolverAgentType;
  /** Confidence from the solver */
  solveConfidence?: number;
  /** Whether the result was stored in the question bank */
  stored: boolean;
  /** Error message if any step failed */
  error?: string;
}

// ── Batch job ───────────────────────────────────────────────────────

export interface EnrichJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  subject: SubjectId;
  gradeLevels: GradeLevel[];
  startedAt: number;
  completedAt?: number;
  stats: EnrichJobStats;
  error?: string;
}

export interface EnrichJobStats {
  totalSearched: number;
  totalFetched: number;
  totalExtracted: number;
  totalSolved: number;
  totalStored: number;
  totalFailed: number;
  /** Per-subject breakdown */
  bySubject: Record<
    string,
    {
      searched: number;
      fetched: number;
      extracted: number;
      solved: number;
      stored: number;
      failed: number;
    }
  >;
}

// ── Global status ───────────────────────────────────────────────────

export interface EnrichmentStatus {
  isRunning: boolean;
  currentJob: EnrichJob | null;
  lastJob: EnrichJob | null;
  totalStored: number;
}
