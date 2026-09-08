/**
 * Local file importer — parse downloaded JSON/JSONL datasets
 * from local files (no network needed at import time).
 */

import type { ExtractedQuestion, SubjectId, GradeLevel } from './types';
import { createLogger } from '@/lib/logger';
import { readFile } from 'fs/promises';

const log = createLogger('Enrichment:FileImport');

// ── JSONL parser ─────────────────────────────────────────────────────

function parseJSONL(text: string): Record<string, unknown>[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

// ── TAL-SCQ5K specific parser ───────────────────────────────────────

interface TALQuestion {
  qid: string;
  problem: string;
  qtype: string;
  difficulty: string;
  answer_option_list?: Array<Array<{ aoVal: string; content: string }>>;
  competition_source_list?: string[];
}

function parseTALQuestion(raw: Record<string, unknown>): ExtractedQuestion | null {
  const q = raw as unknown as TALQuestion;
  if (!q.problem || q.problem.length < 5) return null;

  // Build full question text with options
  let text = q.problem.trim();

  // Fix LaTeX: $$...$$ → $...$ (the solver expects single $)
  text = text.replace(/\$\$([^$]+)\$\$/g, '$$$1$$');

  // Add options if available
  if (q.answer_option_list && q.answer_option_list.length > 0) {
    const options = q.answer_option_list
      .map((opt) => {
        const first = opt[0];
        if (!first) return '';
        return `${first.aoVal}. ${first.content.trim()}`;
      })
      .filter(Boolean)
      .join('  ');
    if (options) text += '\n' + options;
  }

  // Map difficulty: '0' → unknown, '1' → easy, '2' → medium, '3' → hard
  const gradeLevel: GradeLevel = 'senior'; // competition math → senior

  return {
    problemText: text.slice(0, 3000),
    subject: 'math' as SubjectId,
    gradeLevel,
    questionType: q.qtype === 'single_choice' ? 'choice' : 'solve',
    sourceUrl: `tal-scq5k://${q.qid}`,
    extractionConfidence: 0.9, // pre-curated dataset
  };
}

// ── Generic parser ───────────────────────────────────────────────────

function parseJSON(text: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) {
      for (const key of ['questions', 'data', 'items', 'problems']) {
        if (Array.isArray((data as any)[key])) return (data as any)[key];
      }
      return [data as Record<string, unknown>];
    }
    return [];
  } catch {
    return [];
  }
}

// ── AGIEval parser ───────────────────────────────────────────────────

interface AGIEvalQuestion {
  passage?: string | null;
  question: string;
  options?: string[];
  label?: string;
  answer?: string | null;
  other?: { source?: string };
}

function parseAGIEvalQuestion(
  raw: Record<string, unknown>,
  subject: SubjectId,
): ExtractedQuestion | null {
  const q = raw as unknown as AGIEvalQuestion;
  if (!q.question || q.question.length < 5) return null;

  // Build full question text
  let text = q.question.trim();

  // Add passage if present
  if (q.passage) {
    text = q.passage.trim() + '\n\n' + text;
  }

  // Add options
  if (q.options && q.options.length > 0) {
    text += '\n' + q.options.join('\n');
  }

  return {
    problemText: text.slice(0, 3000),
    subject,
    gradeLevel: 'senior' as GradeLevel,
    questionType: q.options ? 'choice' : 'solve',
    sourceAnswer: q.label || q.answer || undefined,
    sourceUrl: q.other?.source ?? `agieval://${subject}`,
    extractionConfidence: 0.95, // official exam questions
  };
}

// ── Main importer ────────────────────────────────────────────────────

export interface LocalFileImportOptions {
  /** Path to local JSONL/JSON file */
  filePath: string;
  /** Parser to use */
  format?: 'tal-scq5k' | 'agieval' | 'generic-jsonl' | 'generic-json';
  /** Subject for AGIEval format */
  agievalSubject?: SubjectId;
  /** Max questions to import */
  maxQuestions?: number;
}

/**
 * Import questions from a local dataset file.
 */
export async function importLocalFile(opts: LocalFileImportOptions): Promise<ExtractedQuestion[]> {
  const { filePath, format, maxQuestions = 1000 } = opts;

  log.info(`[FileImport] Reading ${filePath}...`);

  let text: string;
  try {
    text = await readFile(filePath, 'utf-8');
  } catch (err) {
    log.error(`[FileImport] Cannot read ${filePath}: ${err}`);
    return [];
  }

  // Auto-detect format
  const detectedFormat = format ?? (filePath.endsWith('.jsonl') ? 'tal-scq5k' : 'generic-json');

  let questions: ExtractedQuestion[];

  switch (detectedFormat) {
    case 'tal-scq5k': {
      const rows = parseJSONL(text);
      log.info(`[FileImport] Parsed ${rows.length} JSONL rows`);
      questions = rows.map(parseTALQuestion).filter(Boolean) as ExtractedQuestion[];
      break;
    }
    case 'agieval': {
      const rows = parseJSONL(text);
      log.info(`[FileImport] Parsed ${rows.length} AGIEval JSONL rows`);
      const subject = opts.agievalSubject ?? 'physics';
      questions = rows
        .map((r) => parseAGIEvalQuestion(r, subject))
        .filter(Boolean) as ExtractedQuestion[];
      break;
    }
    case 'generic-jsonl': {
      const rows = parseJSONL(text);
      questions = rows
        .map((r) => parseGenericRow(r, filePath))
        .filter(Boolean) as ExtractedQuestion[];
      break;
    }
    case 'generic-json': {
      const rows = parseJSON(text);
      questions = rows
        .map((r) => parseGenericRow(r, filePath))
        .filter(Boolean) as ExtractedQuestion[];
      break;
    }
    default:
      return [];
  }

  // Dedup by problem text
  const seen = new Set<string>();
  const deduped: ExtractedQuestion[] = [];
  for (const q of questions) {
    const key = q.problemText.slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(q);
  }

  log.info(
    `[FileImport] ${deduped.length} unique questions (${questions.length - deduped.length} dupes)`,
  );
  return deduped.slice(0, maxQuestions);
}

function parseGenericRow(row: Record<string, unknown>, source: string): ExtractedQuestion | null {
  const problemText = (row.question || row.problem || row.text || row.problemText || '') as string;
  if (!problemText || problemText.length < 5) return null;

  return {
    problemText: problemText.slice(0, 3000),
    subject: detectSubject(problemText),
    gradeLevel: 'senior',
    questionType: 'solve',
    sourceUrl: `file://${source}`,
    extractionConfidence: 0.7,
  };
}

function detectSubject(text: string): SubjectId {
  const lower = text.toLowerCase();
  if (
    lower.includes('物理') ||
    lower.includes('力学') ||
    lower.includes('电场') ||
    lower.includes('磁场')
  )
    return 'physics';
  if (lower.includes('化学') || lower.includes('反应') || lower.includes('溶液'))
    return 'chemistry';
  if (lower.includes('生物') || lower.includes('细胞') || lower.includes('基因')) return 'biology';
  return 'math';
}
