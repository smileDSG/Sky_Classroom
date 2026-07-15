/**
 * D-004 Quiz Parameter Deriver
 *
 * Automatically derives quiz generation parameters (subject, difficulty, topic, count)
 * from a student's profile for personalized "千人千题" quiz generation.
 */

import type { StudentProfile } from './profile-types';
import {
  getDifficultyForMastery,
  resolveSubject,
  QUIZ_COUNT_OPTIONS,
} from './profile-config';

export interface AutoQuizParams {
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  count: number;
}

/**
 * Derive quiz parameters from a student's profile.
 *
 * Strategy:
 * 1. Subject = inferred from topic, or weakest positive-mastery subject in profile.
 * 2. Topic = top N weak points joined.
 * 3. Difficulty = based on average mastery of weak points, adjusted by recent performance.
 * 4. Count = configurable (default from QUIZ_COUNT_OPTIONS).
 */
export function deriveQuizParamsFromProfile(
  profile: StudentProfile,
  options?: { count?: number; maxTopics?: number },
): AutoQuizParams {
  const count = options?.count ?? QUIZ_COUNT_OPTIONS[1]; // default 5
  const maxTopics = options?.maxTopics ?? 3;

  // 1. Topic: top N weak points
  const topic = profile.weakPoints.slice(0, maxTopics).join('、') || '基础复习';

  // 2. Subject: infer from topic, fall back to weakest positive-mastery subject
  const subject = resolveSubject(topic, profile);

  // 3. Difficulty: based on average mastery of weak points
  let avgMastery = 0;
  if (profile.weakPoints.length > 0) {
    const sum = profile.weakPoints.reduce(
      (s, kp) => s + (profile.masteryByKnowledge[kp] ?? 0),
      0,
    );
    avgMastery = sum / profile.weakPoints.length;
  } else {
    avgMastery =
      profile.totalQuestions > 0
        ? (profile.totalCorrect / profile.totalQuestions) * 100
        : 50;
  }

  let difficulty = getDifficultyForMastery(avgMastery);

  // Adjust based on recent quiz performance recommended depth shift
  const shift = profile.recentQuizPerformance?.recommendedDepthShift;
  if (shift === 'deeper' && difficulty !== 'hard') {
    difficulty = difficulty === 'easy' ? 'medium' : 'hard';
  } else if (shift === 'shallower' && difficulty !== 'easy') {
    difficulty = difficulty === 'hard' ? 'medium' : 'easy';
  }

  return { subject, difficulty, topic, count };
}
