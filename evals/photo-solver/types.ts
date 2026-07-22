import { z } from 'zod';

export const evaluationModeSchema = z.enum(['real', 'synthetic']);

export const problemSpecSchema = z.record(z.string(), z.unknown());

export const recognitionResultSchema = z
  .object({
    stage: z.string().optional(),
    subject: z.string().optional(),
    questionType: z.string().optional(),
    stem: z.string().optional(),
    formulas: z.array(z.string()).optional(),
    givenConditions: z.array(z.string()).optional(),
    options: z.array(z.string()).optional(),
  })
  .catchall(z.unknown());

export const photoSolverCaseSchema = z
  .object({
    id: z.string().min(1),
    mode: evaluationModeSchema,
    stage: z.string().min(1),
    subject: z.string().min(1),
    questionType: z.string().min(1),
    imagePath: z.string().optional(),
    inputText: z.string().optional(),
    expectedProblemSpec: problemSpecSchema,
    offlineRecognition: recognitionResultSchema,
    standardAnswer: z.string(),
    answerAliases: z.array(z.string()),
    goldDocumentIds: z.array(z.string()),
    requiredEvidence: z.array(z.string()),
    shouldReject: z.boolean(),
    tags: z.array(z.string()),
  })
  .refine((item) => item.imagePath !== undefined || item.inputText !== undefined, {
    message: 'either imagePath or inputText is required',
    path: ['imagePath'],
  });

export const photoSolverDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  content: z.string().min(1),
  stage: z.string().optional(),
  subject: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const retrievedDocumentSchema = z.object({
  id: z.string().min(1),
  content: z.string().optional(),
  score: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const adapterTimingSchema = z.object({
  recognitionMs: z.number().nonnegative().optional(),
  retrievalMs: z.number().nonnegative().optional(),
  generationMs: z.number().nonnegative().optional(),
  totalMs: z.number().nonnegative(),
});

export const adapterUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  currency: z.string().optional(),
});

export const adapterResultSchema = z.object({
  recognition: recognitionResultSchema,
  retrievedDocuments: z.array(retrievedDocumentSchema),
  answer: z.string().optional(),
  evidence: z.array(z.string()),
  timing: adapterTimingSchema,
  usage: adapterUsageSchema.optional(),
  skipped: z.boolean().default(false),
  skipReason: z.string().optional(),
  error: z.object({ provider: z.string().optional(), message: z.string() }).optional(),
});

const metricMapSchema = z.record(z.string(), z.number());

export const perCaseScoreSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(['passed', 'failed', 'skipped', 'error', 'human-review']),
  recognition: metricMapSchema,
  retrieval: metricMapSchema,
  answer: metricMapSchema,
  robustness: metricMapSchema.optional(),
  latencyMs: z.number().nonnegative(),
  tokenUsage: adapterUsageSchema.optional(),
  failure: z.string().optional(),
  skipReason: z.string().optional(),
  adapterResult: adapterResultSchema.optional(),
});

export const aggregateScoreSchema = z.object({
  totalCases: z.number().int().nonnegative(),
  evaluatedCases: z.number().int().nonnegative(),
  passedCases: z.number().int().nonnegative(),
  failedCases: z.number().int().nonnegative(),
  skippedCases: z.number().int().nonnegative(),
  errorCases: z.number().int().nonnegative(),
  humanReviewCases: z.number().int().nonnegative(),
  failureRate: z.number().nonnegative(),
  skippedRate: z.number().nonnegative(),
  metrics: metricMapSchema,
  byStage: z.record(z.string(), metricMapSchema),
  bySubject: z.record(z.string(), metricMapSchema),
  byTag: z.record(z.string(), metricMapSchema),
});

export const evaluationReportSchema = z.object({
  generatedAt: z.string(),
  runMode: z.enum(['offline', 'live']),
  filters: z
    .object({
      mode: evaluationModeSchema.optional(),
      stage: z.string().optional(),
      subject: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  cases: z.array(perCaseScoreSchema),
  aggregate: aggregateScoreSchema,
});

export type EvaluationMode = z.infer<typeof evaluationModeSchema>;
export type ProblemSpec = z.infer<typeof problemSpecSchema>;
export type RecognitionResult = z.infer<typeof recognitionResultSchema>;
export type PhotoSolverCase = z.infer<typeof photoSolverCaseSchema>;
export type PhotoSolverDocument = z.infer<typeof photoSolverDocumentSchema>;
export type RetrievedDocument = z.infer<typeof retrievedDocumentSchema>;
export type AdapterTiming = z.infer<typeof adapterTimingSchema>;
export type AdapterUsage = z.infer<typeof adapterUsageSchema>;
export type AdapterResult = z.infer<typeof adapterResultSchema>;
export type PerCaseScore = z.infer<typeof perCaseScoreSchema>;
export type AggregateScore = z.infer<typeof aggregateScoreSchema>;
export type EvaluationReport = z.infer<typeof evaluationReportSchema>;

export interface PhotoSolverAdapter {
  run(testCase: PhotoSolverCase): Promise<AdapterResult>;
}

export interface PhotoSolverCaseFilters {
  mode?: EvaluationMode;
  stage?: string;
  subject?: string;
  tags?: string[];
}
