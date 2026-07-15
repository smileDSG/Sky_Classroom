/**
 * Derive review-quiz parameters from classroom quiz results.
 *
 * Used by classroom-complete.tsx to generate a targeted巩固练习
 * after a lesson ends.
 */

import type { QuizDetail } from './complete-summary';
import { inferSubject } from '@/lib/mistakes/subject-inference';

export interface ReviewQuizParams {
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  count: number;
}

/**
 * Derive quiz parameters from the details of incorrect answers in a classroom quiz.
 *
 * Strategy:
 * 1. Extract unique knowledge points from wrong answers.
 * 2. Infer subject by majority vote among knowledge points.
 * 3. Difficulty based on overall accuracy percentage.
 * 4. Topic = first 3 weak knowledge points.
 * 5. Count = weakKP count × 2, clamped to [3, 10].
 */
export function deriveReviewQuizParams(
  quizDetails: QuizDetail[],
  overallPct: number,
): ReviewQuizParams {
  const weakKPs = Array.from(new Set(quizDetails.flatMap((d) => d.knowledgePoints ?? [])));

  // Infer subject by majority vote
  const subjectVotes = new Map<string, number>();
  for (const kp of weakKPs) {
    const subject = inferSubject(kp);
    subjectVotes.set(subject, (subjectVotes.get(subject) ?? 0) + 1);
  }
  const subject = Array.from(subjectVotes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'math';

  // Difficulty based on overall accuracy
  let difficulty: 'easy' | 'medium' | 'hard';
  if (overallPct < 50) difficulty = 'easy';
  else if (overallPct < 80) difficulty = 'medium';
  else difficulty = 'hard';

  const topic = weakKPs.slice(0, 3).join('、') || '综合复习';
  const count = Math.min(Math.max(weakKPs.length * 2, 3), 10);

  return { subject, difficulty, topic, count };
}
