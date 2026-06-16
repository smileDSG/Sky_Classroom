/**
 * D-004 Quiz Parameter Deriver
 *
 * Automatically derives quiz generation parameters (subject, difficulty, topic, count)
 * from a student's profile for personalized "千人千题" quiz generation.
 */

import type { StudentProfile } from './profile-types';
import type { Subject } from '@/lib/solve/agents/analyze-types';

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
 * 1. Subject = the subject with the lowest mastery (>0).
 * 2. Topic = top N weak points joined.
 * 3. Difficulty = based on average mastery of weak points.
 * 4. Count = configurable (default 5).
 */
export function deriveQuizParamsFromProfile(
  profile: StudentProfile,
  options?: { count?: number; maxTopics?: number },
): AutoQuizParams {
  const count = options?.count ?? 5;
  const maxTopics = options?.maxTopics ?? 3;

  // 1. Subject: pick the one with the lowest positive mastery
  const subjects = Object.entries(profile.masteryBySubject)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[1] - b[1]);
  const subject = (subjects[0]?.[0] as Subject) ?? 'math';

  // 2. Topic: top N weak points
  const topic = profile.weakPoints.slice(0, maxTopics).join('、') || '基础复习';

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

  let difficulty: 'easy' | 'medium' | 'hard';
  if (avgMastery < 30) difficulty = 'easy';
  else if (avgMastery < 70) difficulty = 'medium';
  else difficulty = 'hard';

  return { subject, difficulty, topic, count };
}
