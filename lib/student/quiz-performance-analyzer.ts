/**
 * Quiz Performance Analyzer
 *
 * Analyzes recent quiz/solve performance from the mistake book to derive
 * recommendations for lesson depth adjustments.
 */

import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { canonicalizeKnowledgePoint } from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';
import { createQuizAttemptDAO } from './quiz-attempts';

export interface QuizPerformanceSummary {
  /** Overall accuracy across recent attempts (0-100) */
  overallAccuracy: number;
  /** Accuracy per knowledge point (0-100) */
  accuracyByKnowledge: Record<string, number>;
  /** Top error causes by frequency */
  topErrorCauses: string[];
  /** Recommended depth adjustment direction */
  recommendedDepthShift: 'deeper' | 'shallower' | 'maintain';
}

const RECENT_DAYS_DEFAULT = 7;

export async function analyzeQuizPerformance(
  userId: string,
  options?: { recentDays?: number },
): Promise<QuizPerformanceSummary> {
  const recentDays = options?.recentDays ?? RECENT_DAYS_DEFAULT;
  const cutoff = Date.now() - recentDays * 24 * 60 * 60 * 1000;

  const storage = await getServerStorage();
  const dao = createMistakeBookDAO(storage);
  const quizAttemptDAO = createQuizAttemptDAO(storage);

  // Fetch recent mistakes and direct quiz attempts
  const [{ items: allMistakes }, recentAttempts] = await Promise.all([
    dao.list(userId, { pageSize: 9999 }),
    quizAttemptDAO.list({ userId, recentDays }),
  ]);
  const recentMistakes = allMistakes.filter(
    (m) => (m.lastReview ?? 0) >= cutoff || (m.nextReview ?? 0) >= cutoff,
  );

  // If no recent data, return neutral summary
  if (recentMistakes.length === 0 && recentAttempts.length === 0) {
    return {
      overallAccuracy: 50,
      accuracyByKnowledge: {},
      topErrorCauses: [],
      recommendedDepthShift: 'maintain',
    };
  }

  // Calculate accuracy by knowledge point
  const kpStats = new Map<
    string,
    { name: string; attempts: number; correct: number }
  >();

  const causeCounts = new Map<string, number>();

  for (const attempt of recentAttempts) {
    for (const question of attempt.questions) {
      const points = question.knowledgePoints.length > 0
        ? question.knowledgePoints
        : attempt.topic
          ? [attempt.topic]
          : ['综合练习'];
      for (const kp of points) {
        const canonical = canonicalizeKnowledgePoint(kp);
        const stat = kpStats.get(canonical.id) ?? {
          name: canonical.name,
          attempts: 0,
          correct: 0,
        };
        stat.attempts += 1;
        if (question.isCorrect) stat.correct += 1;
        kpStats.set(canonical.id, stat);
      }
    }
  }

  for (const m of recentMistakes) {
    for (const kp of m.knowledgePoints) {
      const canonical = canonicalizeKnowledgePoint(kp);
      const stat = kpStats.get(canonical.id) ?? {
        name: canonical.name,
        attempts: 0,
        correct: 0,
      };
      stat.attempts += 1;
      if (m.reviewed) stat.correct += 1;
      kpStats.set(canonical.id, stat);
    }

    const cause = m.errorType ?? 'concept';
    causeCounts.set(cause, (causeCounts.get(cause) ?? 0) + 1);
  }

  const accuracyByKnowledge: Record<string, number> = {};
  let totalAttempts = 0;
  let totalCorrect = 0;

  for (const stat of kpStats.values()) {
    totalAttempts += stat.attempts;
    totalCorrect += stat.correct;
    accuracyByKnowledge[stat.name] =
      stat.attempts > 0
        ? Math.round((stat.correct / stat.attempts) * 100)
        : 0;
  }

  const overallAccuracy =
    totalAttempts > 0
      ? Math.round((totalCorrect / totalAttempts) * 100)
      : 50;

  const topErrorCauses = Array.from(causeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cause]) => cause);

  // Derive depth shift recommendation
  let recommendedDepthShift: 'deeper' | 'shallower' | 'maintain';
  if (overallAccuracy < 40) recommendedDepthShift = 'shallower';
  else if (overallAccuracy > 80) recommendedDepthShift = 'deeper';
  else recommendedDepthShift = 'maintain';

  return {
    overallAccuracy,
    accuracyByKnowledge,
    topErrorCauses,
    recommendedDepthShift,
  };
}
