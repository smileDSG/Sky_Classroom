/**
 * Question Bank — validation pipeline for imported rows.
 *
 * Uses Zod for schema validation. Collects ALL errors per row (does not
 * short-circuit on first error) so the user can see everything at once.
 */

import { z } from 'zod';
import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { ImportRowError } from './types';

// ── Schema ──────────────────────────────────────────────────────────

const DifficultyEnum = z.enum(['easy', 'medium', 'hard']);
const QuestionTypeEnum = z.enum(['choice', 'fill', 'solve', 'judge']);

const QuestionBankInsertSchema = z.object({
  subject: z.string().min(1, '学科不能为空'),
  grade: z.string().optional(),
  difficulty: DifficultyEnum.default('medium'),
  questionType: QuestionTypeEnum.default('solve'),
  content: z.string().min(1, '题目内容不能为空'),
  answer: z.string().min(1, '答案不能为空'),
  explanation: z.string().optional(),
  knowledgePoints: z.union([z.array(z.string()), z.string()]).optional(),
  image: z.string().optional(),
  options: z.union([z.array(z.string()), z.string()]).optional(),
  source: z.string().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  verified: z.boolean().default(true),
});

// ── Coercion helpers ────────────────────────────────────────────────

function coerceValue(key: string, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;

  switch (key) {
    case 'difficulty':
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['easy', '简单', '易'].includes(v)) return 'easy';
        if (['medium', '中等', '中'].includes(v)) return 'medium';
        if (['hard', '困难', '难'].includes(v)) return 'hard';
      }
      return value;

    case 'questionType':
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['choice', '选择', '选择题', '单选', '多选'].includes(v)) return 'choice';
        if (['fill', '填空', '填空题'].includes(v)) return 'fill';
        if (['solve', '解答', '解答题', '计算', '计算题'].includes(v)) return 'solve';
        if (['judge', '判断', '判断题'].includes(v)) return 'judge';
      }
      return value;

    case 'knowledgePoints':
    case 'options':
    case 'tags':
      if (typeof value === 'string') {
        // Try JSON array first, then comma-separated
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // fall through
        }
        return value
          .split(/[,，;；]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (Array.isArray(value)) return value;
      return value;

    case 'verified':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return ['true', '1', 'yes', '是', '已验证'].includes(value.trim().toLowerCase());
      }
      if (typeof value === 'number') return value === 1;
      return value;

    default:
      return value;
  }
}

// ── Validate a single row ───────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  data?: QuestionBankInsert;
  errors: ImportRowError[];
}

/**
 * Validate a raw row object against the QuestionBankInsert schema.
 *
 * Applies coercion for enums and array fields before validation.
 * Returns ALL errors found in the row (not just the first).
 */
export function validateRow(row: Record<string, unknown>, rowIndex: number): ValidationResult {
  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    coerced[key] = coerceValue(key, value);
  }

  const result = QuestionBankInsertSchema.safeParse(coerced);

  if (result.success) {
    return { valid: true, data: result.data as QuestionBankInsert, errors: [] };
  }

  const errors: ImportRowError[] = result.error.issues.map((issue) => ({
    row: rowIndex,
    field: issue.path.length > 0 ? String(issue.path[0]) : undefined,
    value: issue.path.length > 0 ? coerced[String(issue.path[0])] : undefined,
    reason: issue.message,
  }));

  return { valid: false, errors };
}

// ── Validate multiple rows ──────────────────────────────────────────

export interface BatchValidationResult {
  validEntries: QuestionBankInsert[];
  allErrors: ImportRowError[];
  validCount: number;
  invalidCount: number;
}

export function validateRows(rows: Record<string, unknown>[]): BatchValidationResult {
  const validEntries: QuestionBankInsert[] = [];
  const allErrors: ImportRowError[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const result = validateRow(rows[i], i + 1); // 1-based row index
    if (result.valid && result.data) {
      validEntries.push(result.data);
      validCount++;
    } else {
      allErrors.push(...result.errors);
      invalidCount++;
    }
  }

  return { validEntries, allErrors, validCount, invalidCount };
}
