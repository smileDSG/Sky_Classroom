/**
 * Learning Path Generation Context
 *
 * Aggregates all 天梯工坊 data sources into a single context object
 * consumed by the learning-path engine.
 */

import { getServerStorage } from '@/lib/server/server-storage';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { analyzeQuizPerformance } from '@/lib/student/quiz-performance-analyzer';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { buildReviewSchedule } from '@/lib/schedule/review-scheduler';
import { getLearningStats } from '@/lib/server/learning-stats';
import type { MistakeCause } from '@/lib/solve/types';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { PathGenerationContext } from './learning-path-types';

function mistakeCauseFromErrorType(
  errorType: 'calculation' | 'concept' | 'reasoning' | 'reading' | 'careless',
): MistakeCause {
  switch (errorType) {
    case 'calculation':
      return 'calculation-error';
    case 'concept':
      return 'concept-unclear';
    case 'reasoning':
      return 'method-wrong';
    case 'reading':
      return 'misreading';
    case 'careless':
      return 'careless';
  }
}

/**
 * Build a rich generation context from all available workshop data.
 */
export async function buildPathGenerationContext(userId: string): Promise<PathGenerationContext> {
  const storage = await getServerStorage();
  const mistakeDAO = createMistakeBookDAO(storage);

  // Fetch raw mistake entries for review scheduling and graph building
  const { items: mistakes } = await mistakeDAO.list({ pageSize: 9999 });

  // Build profile (includes its own mistake + quiz analysis with 30-min cache)
  const profile = await buildStudentProfile(userId);

  // Build knowledge graph from raw mistake records
  const records: MistakeRecord[] = mistakes.map((m) => ({
    id: m.id,
    problem: m.problemText,
    userAnswer: m.userAnswer,
    correctAnswer: m.correctAnswer,
    cause: mistakeCauseFromErrorType(m.errorType),
    solvedAt: m.lastReview ? new Date(m.lastReview) : new Date(),
    reviewed: m.reviewed,
    reviewCount: m.reviewCount,
    knowledgePoints: m.knowledgePoints,
    lastReview: m.lastReview,
    nextReview: m.nextReview,
    masteryLevel: m.masteryLevel,
  }));
  const knowledgeGraph = buildKnowledgeGraph(records);

  // Build review schedule from raw mistake entries
  const reviewSchedule = buildReviewSchedule(mistakes);

  // Fetch learning stats (shared helper)
  const learningStats = await getLearningStats(userId);

  // Use profile's recent quiz summary or compute fresh fallback
  const quizSummary =
    profile.recentQuizPerformance ??
    (await analyzeQuizPerformance(userId, { recentDays: 7 }));

  return {
    profile,
    mistakes,
    knowledgeGraph,
    reviewSchedule,
    learningStats,
    quizSummary,
  };
}
