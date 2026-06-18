/**
 * D-005 Memory Card Parameter Deriver
 *
 * Automatically derives memory-card generation parameters from a student's profile
 * so that cards are generated from weak points / error patterns instead of manual input.
 */

import type { StudentProfile } from './profile-types';
import {
  getDifficultyForMastery,
  getReviewIntervalsForMastery,
  MEMORY_COUNT_OPTIONS,
} from './profile-config';

export interface AutoMemoryParams {
  topic: string;
  content: string;
  cardCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  reviewIntervals: number[];
}

/**
 * Derive memory-card parameters from a student's profile.
 *
 * Strategy:
 * 1. Topic = top N weak points joined.
 * 2. Content = weak points with mastery + related error patterns.
 * 3. Card count = based on number of weak points (clamped to options range).
 * 4. Difficulty = based on average mastery of weak points.
 * 5. Review intervals = compressed for lower mastery.
 */
export function deriveMemoryParamsFromProfile(
  profile: StudentProfile,
  options?: { minCards?: number; maxCards?: number; maxTopics?: number },
): AutoMemoryParams {
  const minCards = options?.minCards ?? MEMORY_COUNT_OPTIONS[0]; // 6
  const maxCards = options?.maxCards ?? MEMORY_COUNT_OPTIONS[2]; // 20
  const maxTopics = options?.maxTopics ?? 3;

  const weakPoints = profile.weakPoints.slice(0, maxTopics);

  const topic = weakPoints.join('、') || '基础复习';

  // Build content from weak points + related error patterns
  const contentParts: string[] = [];
  for (const kp of weakPoints) {
    const mastery = profile.masteryByKnowledge[kp] ?? 0;
    contentParts.push(`【${kp}】当前掌握度 ${mastery}%，属于薄弱知识点。`);
  }

  const relatedErrors = profile.errorPatterns
    .filter((ep) => weakPoints.some((kp) => ep.knowledgePoint.includes(kp) || kp.includes(ep.knowledgePoint)))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);

  if (relatedErrors.length > 0) {
    contentParts.push('高频错误模式：');
    for (const ep of relatedErrors) {
      contentParts.push(`- ${ep.knowledgePoint}：${ep.errorType}（${ep.frequency}次）`);
    }
  }

  const content = contentParts.join('\n');

  // Card count scales with weak point count
  const cardCount = Math.min(
    Math.max(weakPoints.length * 2 + 1, minCards),
    maxCards,
  );

  // Difficulty & intervals from average mastery of weak points
  let avgMastery = 50;
  if (weakPoints.length > 0) {
    const sum = weakPoints.reduce(
      (s, kp) => s + (profile.masteryByKnowledge[kp] ?? 0),
      0,
    );
    avgMastery = sum / weakPoints.length;
  } else if (profile.totalQuestions > 0) {
    avgMastery = (profile.totalCorrect / profile.totalQuestions) * 100;
  }

  const difficulty = getDifficultyForMastery(avgMastery);
  const reviewIntervals = getReviewIntervalsForMastery(avgMastery);

  return {
    topic,
    content,
    cardCount,
    difficulty,
    reviewIntervals,
  };
}
