import { jsonrepair } from 'jsonrepair';
import type { ProblemSpec, ProblemStage } from '@/lib/solve/types';

const REQUIRED_FIELDS = ['stage', 'subject', 'questionType', 'stem'] as const;
const ALLOWED_FIELDS = new Set([
  'id',
  'stage',
  'subject',
  'questionType',
  'stem',
  'options',
  'givens',
  'asks',
  'formulas',
  'ambiguities',
  'materials',
  'subQuestions',
  'diagram',
  'confidence',
]);
const STAGES = new Set(['\u521d\u4e2d', '\u9ad8\u4e2d', '\u5927\u5b66', 'unknown']);

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
    if (!value || typeof value !== 'object')
      throw new Error(`problems[${index}] must be an object`);
    const problem = value as Record<string, unknown>;
    for (const key of Object.keys(problem)) {
      if (!ALLOWED_FIELDS.has(key)) throw new Error(`problems[${index}].${key} is not allowed`);
    }
    for (const field of REQUIRED_FIELDS) {
      if (typeof problem[field] !== 'string' || !problem[field].trim()) {
        throw new Error(`problems[${index}].${field} is required`);
      }
    }
    if (!STAGES.has(problem.stage as string))
      throw new Error(`problems[${index}].stage is invalid`);
    const confidence =
      typeof problem.confidence === 'number' && Number.isFinite(problem.confidence)
        ? Math.min(1, Math.max(0, problem.confidence))
        : 0;
    const options = problem.options == null ? [] : problem.options;
    if (!Array.isArray(options)) throw new Error(`problems[${index}].options must be an array`);
    const normalizedOptions = options.filter(
      (option) =>
        option &&
        typeof option === 'object' &&
        typeof (option as Record<string, unknown>).key === 'string' &&
        !!(option as Record<string, unknown>).key?.toString().trim() &&
        typeof (option as Record<string, unknown>).content === 'string' &&
        !!(option as Record<string, unknown>).content?.toString().trim(),
    );
    if (normalizedOptions.length !== options.length)
      throw new Error(`problems[${index}].options entries require key/content`);
    for (const field of ['materials', 'subQuestions', 'asks', 'formulas'] as const) {
      if (
        problem[field] != null &&
        (!Array.isArray(problem[field]) ||
          !(problem[field] as unknown[]).every((item) => typeof item === 'string'))
      )
        throw new Error(`problems[${index}].${field} must be string[]`);
    }
    if (
      problem.givens != null &&
      (!Array.isArray(problem.givens) ||
        !problem.givens.every(
          (item) =>
            item &&
            typeof item === 'object' &&
            Object.entries(item as Record<string, unknown>).every(
              ([key, value]) =>
                !['name', 'symbol', 'value', 'unit'].includes(key) ||
                value == null ||
                typeof value === 'string',
            ),
        ))
    )
      throw new Error(`problems[${index}].givens must contain objects`);
    if (
      problem.ambiguities != null &&
      (!Array.isArray(problem.ambiguities) ||
        !problem.ambiguities.every(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof (item as Record<string, unknown>).field === 'string' &&
            Array.isArray((item as Record<string, unknown>).candidates) &&
            ((item as Record<string, unknown>).candidates as unknown[]).every(
              (candidate) => typeof candidate === 'string',
            ) &&
            typeof (item as Record<string, unknown>).reason === 'string',
        ))
    )
      throw new Error(`problems[${index}].ambiguities entries are invalid`);
    if (
      problem.diagram != null &&
      (!problem.diagram ||
        typeof problem.diagram !== 'object' ||
        typeof (problem.diagram as Record<string, unknown>).type !== 'string' ||
        typeof (problem.diagram as Record<string, unknown>).description !== 'string' ||
        !Array.isArray((problem.diagram as Record<string, unknown>).labels) ||
        !((problem.diagram as Record<string, unknown>).labels as unknown[]).every(
          (item) => typeof item === 'string',
        ) ||
        !Array.isArray((problem.diagram as Record<string, unknown>).relations) ||
        !((problem.diagram as Record<string, unknown>).relations as unknown[]).every(
          (item) => typeof item === 'string',
        ))
    )
      throw new Error(`problems[${index}].diagram is invalid`);

    return {
      id: typeof problem.id === 'string' && problem.id.trim() ? problem.id : String(index + 1),
      stage: problem.stage as ProblemStage,
      subject: problem.subject as string,
      questionType: problem.questionType as string,
      stem: problem.stem as string,
      options: normalizedOptions,
      givens: Array.isArray(problem.givens) ? problem.givens : [],
      asks: Array.isArray(problem.asks) ? problem.asks : [],
      formulas: Array.isArray(problem.formulas) ? problem.formulas : [],
      ambiguities: Array.isArray(problem.ambiguities) ? problem.ambiguities : [],
      materials: Array.isArray(problem.materials) ? problem.materials : [],
      subQuestions: Array.isArray(problem.subQuestions) ? problem.subQuestions : [],
      diagram: problem.diagram && typeof problem.diagram === 'object' ? problem.diagram : null,
      confidence,
    } as ProblemSpec;
  });
}

/** Validate and normalize one request-boundary ProblemSpec. */
export function validateProblemSpec(value: unknown): ProblemSpec {
  const parsed = parseProblemSpecs(JSON.stringify({ problems: [value] }));
  return parsed[0];
}
