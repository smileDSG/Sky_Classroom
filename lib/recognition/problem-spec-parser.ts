import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import type { ProblemSpec } from '@/lib/solve/types';

const problemOptionSchema = z
  .object({ key: z.string().min(1), content: z.string().min(1) })
  .strict();

const problemGivenSchema = z
  .object({
    name: z.string().optional(),
    symbol: z.string().optional(),
    value: z.string().optional(),
    unit: z.string().optional(),
  })
  .strict();

const problemAmbiguitySchema = z
  .object({
    field: z.string().min(1),
    candidates: z.array(z.string()),
    reason: z.string().min(1),
  })
  .strict();

const problemDiagramSchema = z
  .object({
    type: z.string(),
    description: z.string(),
    labels: z.array(z.string()),
    relations: z.array(z.string()),
  })
  .strict();

/** Strict runtime contract shared by recognition output and confirmed solve input. */
export const problemSpecSchema = z
  .object({
    id: z.string().min(1).default('1'),
    stage: z.enum(['\u521d\u4e2d', '\u9ad8\u4e2d', '\u5927\u5b66', 'unknown']),
    subject: z.string().min(1),
    questionType: z.string().min(1),
    stem: z.string().min(1),
    options: z.array(problemOptionSchema).default([]),
    givens: z.array(problemGivenSchema).default([]),
    asks: z.array(z.string()).default([]),
    formulas: z.array(z.string()).default([]),
    ambiguities: z.array(problemAmbiguitySchema).default([]),
    materials: z.array(z.string()).default([]),
    subQuestions: z.array(z.string()).default([]),
    diagram: problemDiagramSchema.nullable().default(null),
    confidence: z.number().finite().min(0).max(1).default(0),
  })
  .strict();

function formatSchemaError(prefix: string, error: z.ZodError): Error {
  const issue = error.issues[0];
  const path = issue.path.length > 0 ? `.${issue.path.join('.')}` : '';
  return new Error(`${prefix}${path}: ${issue.message}`);
}

export function parseProblemSpecInput(value: unknown): ProblemSpec | null {
  if (value == null) return null;
  const result = problemSpecSchema.safeParse(value);
  if (!result.success) throw formatSchemaError('problemSpec', result.error);
  return result.data as ProblemSpec;
}

export function isJsonLikeOutput(raw: string): boolean {
  const text = raw.trim();
  return text.startsWith('{') || /^```json\b/i.test(text) || /["']problems["']\s*:/.test(text);
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object found');
  return raw.slice(start, end + 1);
}

export function parseProblemSpecs(raw: string): ProblemSpec[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonrepair(extractJson(raw)));
  } catch (error) {
    throw new Error(
      `Invalid ProblemSpec JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const problems = (parsed as { problems?: unknown })?.problems;
  if (!Array.isArray(problems)) throw new Error('ProblemSpec field "problems" must be an array');

  return problems.map((value, index) => {
    const result = problemSpecSchema.safeParse(value);
    if (!result.success) throw formatSchemaError(`problems[${index}]`, result.error);
    return result.data as ProblemSpec;
  });
}
