/**
 * Enrichment module — barrel export.
 */

export type {
  SubjectId,
  GradeLevel,
  SubjectConfig,
  GradeConfig,
  SearchResult,
  FetchedPage,
  ExtractedQuestion,
  EnrichQuestionResult,
  EnrichJob,
  EnrichJobStats,
  EnrichmentStatus,
} from './types';

export { searchForSubject, isSearchConfigured } from './web-search';
export { fetchPage, fetchPages } from './page-fetcher';
export { extractQuestionsFromText, extractQuestionsFromPages } from './question-extractor';
export { importDataset, importAllDatasets } from './dataset-importer';
export { DATASET_SOURCES } from './dataset-sources';
export type { DatasetSource } from './dataset-sources';
export { generateQuestions } from './question-generator';
export { runEnrichment, runEnrichmentParallel, getEnrichmentStatus, getEnrichmentProgress } from './enrichment-pipeline';
export { saveQuestion, hasProblem, getCount, getBySubject, getRecent, getStats } from './sqlite-store';
