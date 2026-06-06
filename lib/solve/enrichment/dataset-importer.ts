/**
 * Dataset importer — download open-source question datasets,
 * parse JSON/CSV, normalize fields, and convert to ExtractedQuestion.
 *
 * Zero-cost: no API key needed, just web access to GitHub/HuggingFace.
 */

import type { ExtractedQuestion, SubjectId, GradeLevel } from './types';
import type { DatasetSource } from './dataset-sources';
import { DATASET_SOURCES } from './dataset-sources';
import { createLogger } from '@/lib/logger';

const log = createLogger('Enrichment:Dataset');

// ── CSV parser (lightweight, no dependency) ──────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// ── JSON parser ──────────────────────────────────────────────────────

function parseJSON(text: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(text);

    // Handle JSONL (newline-delimited JSON)
    if (typeof data === 'string') {
      return text
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => {
          try { return JSON.parse(l); } catch { return null; }
        })
        .filter(Boolean) as Record<string, unknown>[];
    }

    // Handle array
    if (Array.isArray(data)) return data;

    // Handle object with questions array
    if (typeof data === 'object' && data !== null) {
      for (const key of ['questions', 'data', 'items', 'problems', 'examples']) {
        if (Array.isArray((data as any)[key])) {
          return (data as any)[key];
        }
      }
      // Single object — wrap in array
      return [data as Record<string, unknown>];
    }

    return [];
  } catch {
    log.warn('[Dataset] Failed to parse JSON');
    return [];
  }
}

// ── Field normalization ──────────────────────────────────────────────

function findField(
  row: Record<string, unknown>,
  candidates: string[],
): unknown {
  for (const field of candidates) {
    // Exact match
    if (field in row && row[field] != null && row[field] !== '') {
      return row[field];
    }
    // Case-insensitive match
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === field.toLowerCase() && row[key] != null && row[key] !== '') {
        return row[key];
      }
    }
  }
  return undefined;
}

function normalizeSubject(raw: unknown, source: DatasetSource): SubjectId {
  if (typeof raw !== 'string') {
    // Use source default
    return source.subjects[0] as SubjectId ?? 'math';
  }
  const s = raw.toLowerCase();
  if (s.includes('math') || s.includes('数学')) return 'math';
  if (s.includes('physics') || s.includes('物理')) return 'physics';
  if (s.includes('chemistry') || s.includes('化学')) return 'chemistry';
  if (s.includes('chinese') || s.includes('语文')) return 'chinese';
  if (s.includes('english') || s.includes('英语')) return 'english';
  if (s.includes('biology') || s.includes('生物')) return 'biology';
  if (s.includes('history') || s.includes('历史')) return 'history';
  if (s.includes('geography') || s.includes('地理')) return 'geography';
  if (s.includes('politics') || s.includes('政治')) return 'politics';
  return source.subjects[0] as SubjectId ?? 'math';
}

function normalizeGrade(raw: unknown, source: DatasetSource): GradeLevel {
  if (typeof raw === 'string') {
    const s = raw.toLowerCase();
    if (s.includes('小学') || s.includes('primary') || s.includes('elementary')) return 'junior';
    if (s.includes('初中') || s.includes('junior') || s.includes('middle')) return 'junior';
    if (s.includes('高中') || s.includes('senior') || s.includes('high')) return 'senior';
    if (s.includes('大学') || s.includes('college') || s.includes('university')) return 'college';
  }
  if (typeof raw === 'number') {
    if (raw <= 6) return 'junior'; // Grades 1-6
    if (raw <= 9) return 'junior'; // Grades 7-9
    if (raw <= 12) return 'senior'; // Grades 10-12
  }
  return source.gradeLevels[0] as GradeLevel ?? 'senior';
}

function normalizeType(raw: unknown): ExtractedQuestion['questionType'] {
  if (typeof raw !== 'string') return 'solve';
  const s = raw.toLowerCase();
  if (s.includes('选择') || s.includes('choice') || s.includes('单选') || s.includes('多选')) return 'choice';
  if (s.includes('填空') || s.includes('fill')) return 'fill';
  if (s.includes('判断') || s.includes('judge') || s.includes('true') || s.includes('false')) return 'judge';
  if (s.includes('解答') || s.includes('solve') || s.includes('证明') || s.includes('计算') || s.includes('简答')) return 'solve';
  return 'solve';
}

// ── Main importer ────────────────────────────────────────────────────

export interface ImportDatasetOptions {
  /** Specific dataset ID to import (default: all) */
  datasetId?: string;
  /** Max questions to return */
  maxQuestions?: number;
  /** Filter by subject */
  subjects?: SubjectId[];
}

interface ImportedRow {
  question: ExtractedQuestion;
  sourceAnswer?: string;
}

/**
 * Download and parse a single dataset.
 */
export async function importDataset(
  source: DatasetSource,
  maxQuestions: number = 500,
): Promise<ImportedRow[]> {
  log.info(`[Dataset] Downloading ${source.id}: ${source.url}`);

  let text: string;
  try {
    const resp = await fetch(source.url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        'User-Agent': 'SkyClassroom-EnrichBot/1.0 (educational research)',
        'Accept': 'application/json,text/csv,text/plain,*/*',
      },
    });

    if (!resp.ok) {
      log.warn(`[Dataset] HTTP ${resp.status} for ${source.id}`);
      return [];
    }

    text = await resp.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[Dataset] Download failed for ${source.id}: ${msg}`);
    return [];
  }

  // Parse based on format
  let rows: Record<string, unknown>[];

  if (source.format === 'csv') {
    rows = parseCSV(text).map((r) => r as unknown as Record<string, unknown>);
  } else {
    rows = parseJSON(text);
  }

  if (rows.length === 0) {
    log.warn(`[Dataset] No rows parsed from ${source.id}`);
    return [];
  }

  log.info(`[Dataset] Parsed ${rows.length} rows from ${source.id}`);

  // Normalize to ExtractedQuestion
  const results: ImportedRow[] = [];

  for (const row of rows) {
    const problemText = findField(row, source.fieldMap.problemText);
    if (!problemText || typeof problemText !== 'string' || problemText.length < 5) {
      continue;
    }

    const sourceAnswer = findField(row, source.fieldMap.answer ?? []);
    // Also look for solution/analysis — sometimes the answer is there
    const solutionText = findField(row, source.fieldMap.solution ?? []);

    const question: ExtractedQuestion = {
      problemText: problemText.trim().slice(0, 3000),
      subject: normalizeSubject(findField(row, source.fieldMap.subject ?? []), source),
      gradeLevel: normalizeGrade(findField(row, source.fieldMap.gradeLevel ?? []), source),
      questionType: normalizeType(findField(row, source.fieldMap.questionType ?? [])),
      sourceAnswer: typeof sourceAnswer === 'string' ? sourceAnswer.slice(0, 2000) : undefined,
      sourceUrl: source.url,
      extractionConfidence: 0.85, // datasets are pre-structured
    };

    results.push({ question, sourceAnswer: question.sourceAnswer });

    if (results.length >= maxQuestions) break;
  }

  log.info(`[Dataset] Normalized ${results.length} questions from ${source.id}`);
  return results;
}

export interface ImportAllDatasetsOptions {
  datasets?: DatasetSource[];
  maxQuestions?: number;
  subjects?: SubjectId[];
}

/**
 * Import from multiple datasets, deduplicated.
 */
export async function importAllDatasets(
  opts: ImportAllDatasetsOptions = {},
): Promise<ExtractedQuestion[]> {
  const {
    datasets = DATASET_SOURCES,
    maxQuestions = 200,
    subjects,
  } = opts;

  // Filter by subject if requested
  const filtered = subjects
    ? datasets.filter((d) => d.subjects.some((s) => subjects.includes(s as SubjectId)))
    : datasets;

  const allQuestions: ExtractedQuestion[] = [];
  const seen = new Set<string>();

  for (const source of filtered) {
    if (allQuestions.length >= maxQuestions) break;

    const imported = await importDataset(source, maxQuestions - allQuestions.length);

    for (const { question } of imported) {
      // Dedup
      const key = question.problemText.slice(0, 100) + '|' + question.problemText.slice(-50);
      if (seen.has(key)) continue;
      seen.add(key);

      allQuestions.push(question);

      if (allQuestions.length >= maxQuestions) break;
    }

    log.info(`[Dataset] ${source.id}: ${imported.length} imported → ${allQuestions.length} total (after dedup)`);
  }

  log.info(`[Dataset] Total: ${allQuestions.length} unique questions from ${filtered.length} datasets`);
  return allQuestions;
}
