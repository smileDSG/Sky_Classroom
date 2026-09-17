import { NextRequest } from 'next/server';
import { z } from 'zod';

import { getServerStorage } from '@/lib/server/server-storage';
import { buildSoftwareCupProfile } from '@/lib/software-cup/demo-service';
import {
  buildLearningEffectReport,
  evaluatePracticeResults,
  learningEffectToProfileSignals,
  type PracticeResult,
} from '@/lib/software-cup/learning-effect';
import { createProfileSignalDAO } from '@/lib/student/profile-signals';
import { requireAuth } from '@/lib/server/auth/helpers';

const DEFAULT_RESULTS: PracticeResult[] = [
  {
    questionId: 'ai-04-003',
    knowledgePoint: 'overfitting',
    correct: false,
    errorTag: 'concept boundary confusion',
  },
  {
    questionId: 'ai-04-004',
    knowledgePoint: 'evaluation metrics',
    correct: false,
    errorTag: 'single-metric judgement',
  },
  {
    questionId: 'ai-10-002',
    knowledgePoint: 'RAG',
    correct: true,
  },
];

function buildMasteryByKnowledge(results: PracticeResult[]): Record<string, number> {
  const masteryByKnowledge: Record<string, number> = {};

  for (const result of results) {
    const current = masteryByKnowledge[result.knowledgePoint] ?? 50;
    masteryByKnowledge[result.knowledgePoint] = result.correct
      ? Math.min(100, current + 12)
      : Math.max(0, current - 18);
  }

  return masteryByKnowledge;
}

function buildErrorsByKnowledge(results: PracticeResult[]): Record<string, string[]> {
  const errorsByKnowledge: Record<string, string[]> = {};

  for (const result of results) {
    if (result.correct) continue;
    errorsByKnowledge[result.knowledgePoint] = [
      ...(errorsByKnowledge[result.knowledgePoint] ?? []),
      result.errorTag || 'unclassified error',
    ];
  }

  return errorsByKnowledge;
}

function buildNextActions(accuracy: number): string[] {
  if (accuracy < 60) {
    return ['降低练习难度', '补充图解讲义', '推送前置知识复习'];
  }

  return ['进入代码案例', '推送项目任务', '安排错题复盘'];
}

const EvaluateSchema = z.object({
  input: z.string().max(200).optional(),
  results: z
    .array(
      z.object({
        questionId: z.string().max(200),
        knowledgePoint: z.string().max(200),
        correct: z.boolean(),
        errorTag: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(200)
    .optional(),
  resourceUsage: z
    .array(
      z.object({
        resourceId: z.string().max(200),
        resourceType: z.string().max(100),
        action: z.enum(['view', 'favorite', 'skip', 'complete']),
        completionRate: z.number().min(0).max(100).optional(),
        durationSeconds: z.number().int().min(0).optional(),
      }),
    )
    .max(500)
    .optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const parsed = EvaluateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  const results = parsed.data.results ?? DEFAULT_RESULTS;
  const [profile, summary] = await Promise.all([
    buildSoftwareCupProfile(parsed.data.input || ''),
    Promise.resolve(evaluatePracticeResults(results)),
  ]);
  const report = buildLearningEffectReport({
    results,
    resourceUsage: parsed.data.resourceUsage ?? [],
  });

  const masteryByKnowledge = buildMasteryByKnowledge(results);
  const errorsByKnowledge = buildErrorsByKnowledge(results);
  const weakPoints = Object.entries(masteryByKnowledge)
    .filter(([, mastery]) => mastery < 60)
    .map(([point]) => point);
  const nextActions = buildNextActions(summary.accuracy);
  const profileSignals = learningEffectToProfileSignals({ userId: auth.user.id, results });

  if (profileSignals.length > 0) {
    const storage = await getServerStorage();
    await createProfileSignalDAO(storage).addMany(profileSignals);
  }

  return Response.json({
    success: true,
    data: {
      accuracy: summary.accuracy,
      total: summary.total,
      correct: summary.correct,
      masteryByKnowledge,
      errorsByKnowledge,
      profilePatch: {
        weakPoints:
          weakPoints.length > 0 ? weakPoints : profile.dimensions.knowledgeBase.weakPoints,
        currentLearningState:
          summary.accuracy < 60
            ? '诊断结果显示基础概念仍需补强，下一步优先推送低难度图解和概念辨析题。'
            : '诊断结果达到基础要求，下一步适合进入代码案例和项目任务。',
      },
      profileSignals,
      report,
      nextActions,
    },
  });
}
