/**
 * GET /api/sky/learning-path/preview
 *
 * Returns a preview of workshop data used by the learning-path generation dialog.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireQuota } from '@/lib/server/billing/require-quota';
import { buildPathGenerationContext } from '@/lib/teaching/learning-path-context';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:LearningPathPreview');

const ERROR_TYPE_LABELS: Record<string, string> = {
  calculation: '计算失误',
  concept: '概念不清',
  reasoning: '方法错误',
  reading: '审题错误',
  careless: '粗心',
};

const CAUSE_LABELS: Record<string, string> = {
  'calculation-error': '计算失误',
  'concept-unclear': '概念不清',
  'method-wrong': '方法错误',
  misreading: '审题错误',
  careless: '粗心',
  'format-error': '格式错误',
};

export async function GET(req: NextRequest) {
  try {
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    const context = await buildPathGenerationContext(quota.userId);
    const { profile, mistakes, knowledgeGraph, reviewSchedule, learningStats, quizSummary } =
      context;

    const now = Date.now();
    const dueReviewItems =
      reviewSchedule.today?.items.slice(0, 5).map((m) => ({
        id: m.id,
        problemText: m.problemText.slice(0, 80),
        knowledgePoints: m.knowledgePoints,
        nextReview: m.nextReview ?? 0,
        overdue: (m.nextReview ?? 0) > 0 && (m.nextReview ?? 0) < now - 24 * 60 * 60 * 1000,
      })) ?? [];

    const topErrorPatterns = profile.errorPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map((p) => ({
        knowledgePoint: p.knowledgePoint,
        errorType: CAUSE_LABELS[p.errorType] ?? p.errorType,
        frequency: p.frequency,
      }));

    const causeDistribution: Record<string, number> = {};
    for (const m of mistakes) {
      const label = ERROR_TYPE_LABELS[m.errorType] ?? m.errorType;
      causeDistribution[label] = (causeDistribution[label] ?? 0) + 1;
    }

    return apiSuccess({
      data: {
        weakPoints: knowledgeGraph.weakPoints.slice(0, 8),
        dueReviewItems,
        topErrorPatterns,
        causeDistribution,
        recentQuizSummary: quizSummary,
        learningStats,
        masteryPercent: learningStats?.masteryPercent ?? 0,
      },
    });
  } catch (err) {
    log.error('Failed to build learning path preview:', err);
    return apiError('INTERNAL_ERROR', 500, 'Failed to build preview');
  }
}
