import type { PhotoSolverAdapter } from './adapters/types';
import { z } from 'zod';
import { evaluateAnswer } from './metrics/answer';
import { evaluateRecognition } from './metrics/recognition';
import { evaluateRetrieval } from './metrics/retrieval';
import {
  evaluationReportSchema,
  adapterResultSchema,
  photoSolverCaseSchema,
  type AggregateScore,
  type EvaluationReport,
  type PerCaseScore,
  type PhotoSolverCase,
} from './types';

export interface RunnerOptions {
  runMode?: 'offline' | 'live';
  generatedAt?: string;
  filters?: EvaluationReport['filters'];
}
const runnerOptionsSchema = z
  .object({
    runMode: z.enum(['offline', 'live']).optional(),
    generatedAt: z.string().min(1).optional(),
    filters: z
      .object({
        mode: z.enum(['real', 'synthetic']).optional(),
        stage: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        tags: z.array(z.string().min(1)).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const avg = (rows: PerCaseScore[], key: 'recognition' | 'retrieval' | 'answer') => {
  const sums: Record<string, number> = {};
  let n = 0;
  for (const r of rows) {
    if (r.status === 'skipped' || (key === 'answer' && r.status === 'human-review')) continue;
    n++;
    for (const [k, v] of Object.entries(r[key])) sums[k] = (sums[k] ?? 0) + v;
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, n ? v / n : 0]));
};
const grouped = (
  rows: PerCaseScore[],
  cases: PhotoSolverCase[],
  field: 'stage' | 'subject' | 'tags',
) => {
  const out: Record<string, PerCaseScore[]> = {};
  rows.forEach((r, i) => {
    const vals = field === 'tags' ? cases[i].tags : [cases[i][field]];
    for (const v of vals) (out[v] ??= []).push(r);
  });
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, summary(v)]));
};
const summary = (rows: PerCaseScore[]) => ({
  ...Object.fromEntries(
    Object.entries(avg(rows, 'recognition')).map(([k, v]) => [`recognition.${k}`, v]),
  ),
  ...Object.fromEntries(
    Object.entries(avg(rows, 'retrieval')).map(([k, v]) => [`retrieval.${k}`, v]),
  ),
  ...Object.fromEntries(Object.entries(avg(rows, 'answer')).map(([k, v]) => [`answer.${k}`, v])),
  total: rows.length,
  passed: rows.filter((r) => r.status === 'passed').length,
  failed: rows.filter((r) => r.status === 'failed' || r.status === 'error').length,
  skipped: rows.filter((r) => r.status === 'skipped').length,
  latencyMs: rows.reduce((s, r) => s + r.latencyMs, 0),
  totalTokens: rows.reduce((s, r) => s + (r.tokenUsage?.totalTokens ?? 0), 0),
  inputTokens: rows.reduce((s, r) => s + (r.tokenUsage?.inputTokens ?? 0), 0),
  outputTokens: rows.reduce((s, r) => s + (r.tokenUsage?.outputTokens ?? 0), 0),
  estimatedCost: rows.reduce((s, r) => s + (r.tokenUsage?.estimatedCost ?? 0), 0),
  totalLatencyMs: rows.reduce((s, r) => s + r.latencyMs, 0),
  averageLatencyMs: rows.length ? rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length : 0,
  currencyMixed: new Set(rows.map((r) => r.tokenUsage?.currency).filter(Boolean)).size > 1 ? 1 : 0,
});
export async function runPhotoSolverEvaluation(
  cases: PhotoSolverCase[],
  adapter: PhotoSolverAdapter,
  options: RunnerOptions = {},
): Promise<EvaluationReport> {
  runnerOptionsSchema.parse(options);
  if (!Array.isArray(cases) || !adapter || typeof adapter.run !== 'function')
    throw new Error('invalid config or dataset');
  for (const item of cases) {
    const parsed = photoSolverCaseSchema.safeParse(item);
    if (!parsed.success) throw new Error(`invalid evaluation case: ${parsed.error.message}`);
  }
  const scores: PerCaseScore[] = [];
  for (const testCase of cases) {
    try {
      const result = adapterResultSchema.parse(await adapter.run(testCase));
      const recognition = evaluateRecognition(testCase.offlineRecognition, result.recognition);
      const retrieval = evaluateRetrieval(
        testCase.goldDocumentIds,
        result.retrievedDocuments.map((d) => d.id),
        5,
      );
      const answer = evaluateAnswer({
        predictedAnswer: result.answer,
        standardAnswer: testCase.standardAnswer,
        answerAliases: testCase.answerAliases,
        shouldReject: testCase.shouldReject,
        didReject: !result.answer,
        evidence: result.evidence,
        requiredEvidence: testCase.requiredEvidence,
        subjective: testCase.questionType === 'subjective',
      });
      const status = result.skipped
        ? 'skipped'
        : result.error
          ? 'failed'
          : answer.needsHumanReview
            ? 'human-review'
            : (testCase.shouldReject ? answer.rejectionAccuracy === 1 : answer.answerMatch === 1)
              ? 'passed'
              : 'failed';
      scores.push({
        caseId: testCase.id,
        status,
        recognition,
        retrieval,
        answer: { ...answer, needsHumanReview: Number(answer.needsHumanReview) },
        latencyMs: result.timing.totalMs,
        tokenUsage: result.usage,
        skipReason: result.skipReason,
        failure: result.error?.message,
        adapterResult: result,
      });
    } catch (error) {
      if (options.runMode === 'offline') throw error;
      scores.push({
        caseId: testCase.id,
        status: 'error',
        recognition: {},
        retrieval: {},
        answer: {},
        latencyMs: 0,
        failure: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const evaluated = scores.filter((s) => s.status !== 'skipped').length,
    passed = scores.filter((s) => s.status === 'passed').length,
    failed = scores.filter((s) => s.status === 'failed').length,
    skipped = scores.filter((s) => s.status === 'skipped').length,
    errors = scores.filter((s) => s.status === 'error').length;
  const aggregate: AggregateScore = {
    totalCases: scores.length,
    evaluatedCases: evaluated,
    passedCases: passed,
    failedCases: failed,
    skippedCases: skipped,
    errorCases: errors,
    humanReviewCases: scores.filter((s) => s.status === 'human-review').length,
    failureRate: evaluated ? (failed + errors) / evaluated : 0,
    skippedRate: scores.length ? skipped / scores.length : 0,
    metrics: summary(scores),
    byStage: grouped(scores, cases, 'stage'),
    bySubject: grouped(scores, cases, 'subject'),
    byTag: grouped(scores, cases, 'tags'),
  };
  const report = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    runMode: options.runMode ?? 'offline',
    filters: options.filters,
    cases: scores,
    aggregate,
  };
  return evaluationReportSchema.parse(report);
}
