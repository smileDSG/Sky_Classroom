/**
 * Adaptive Teaching Engine — Real-time pace adjustment based on learning feedback.
 *
 * Analyzes section feedback and quiz results to decide whether supplemental
 * sections should be generated for weak knowledge points.
 */

import type { LessonSection } from './lesson-types';
import { getDifficultyForMastery } from '@/lib/student/profile-config';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdaptiveEngine');

export interface SectionFeedback {
  sectionId: string;
  feedbackType: 'mastered' | 'needs_review';
  knowledgePoints: string[];
  timestamp: number;
}

export interface QuizResult {
  sectionId: string;
  chunkOrder: number;
  knowledgePoints?: string[];
  isCorrect: boolean;
  timestamp: number;
}

export interface AdaptiveDecision {
  shouldSupplement: boolean;
  weakKnowledgePoints: string[];
  supplementalSections: LessonSection[];
}

/** Collect weak knowledge points from feedback and quiz results. */
export function analyzeWeakPoints(
  feedbacks: SectionFeedback[],
  quizResults: QuizResult[],
): string[] {
  const weakSet = new Set<string>();

  for (const fb of feedbacks) {
    if (fb.feedbackType === 'needs_review') {
      for (const kp of fb.knowledgePoints) {
        weakSet.add(kp);
      }
    }
  }

  for (const qr of quizResults) {
    if (!qr.isCorrect && qr.knowledgePoints) {
      for (const kp of qr.knowledgePoints) {
        weakSet.add(kp);
      }
    }
  }

  return Array.from(weakSet);
}

/** Map difficulty id to lesson section depth. */
function difficultyToDepth(difficulty: string): 'basic' | 'intermediate' | 'advanced' {
  switch (difficulty) {
    case 'easy':
      return 'basic';
    case 'medium':
      return 'intermediate';
    case 'hard':
      return 'advanced';
    default:
      return 'basic';
  }
}

/** Map a depth label to a suggested duration in minutes. */
function durationForDepth(depth: string): number {
  switch (depth) {
    case 'basic':
      return 5;
    case 'intermediate':
      return 8;
    case 'advanced':
      return 12;
    default:
      return 5;
  }
}

/** Build supplemental sections for weak knowledge points. */
export function buildSupplementalSections(
  weakPoints: string[],
  existingSections: LessonSection[],
  masteryByKnowledge?: Record<string, number>,
): LessonSection[] {
  if (weakPoints.length === 0) {
    return [];
  }

  // Deduplicate against existing section knowledge points
  const existingKps = new Set<string>();
  for (const sec of existingSections) {
    for (const kp of sec.knowledgePoints) {
      existingKps.add(kp);
    }
  }

  const uniqueWeak = weakPoints.filter((kp) => !existingKps.has(kp));

  // Group weak points into at most 2 supplemental sections
  const groups: string[][] = [];
  if (uniqueWeak.length <= 3) {
    groups.push(uniqueWeak);
  } else {
    groups.push(uniqueWeak.slice(0, Math.ceil(uniqueWeak.length / 2)));
    groups.push(uniqueWeak.slice(Math.ceil(uniqueWeak.length / 2)));
  }

  const supplemental: LessonSection[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (group.length === 0) continue;

    // Determine depth from the weakest point in the group
    const minMastery = Math.min(
      ...group.map((kp) => masteryByKnowledge?.[kp] ?? 0),
    );
    const depth = difficultyToDepth(getDifficultyForMastery(minMastery));

    supplemental.push({
      id: `section-supplement-${i + 1}`,
      title: `补充强化：${group.join('、')}`,
      contentType: 'example',
      depth,
      knowledgePoints: group,
      estimatedDuration: durationForDepth(depth),
      hasQuiz: true,
    });
  }

  log.info(`Adaptive decision: ${supplemental.length} supplemental sections for ${uniqueWeak.length} weak points`);
  return supplemental;
}

/** Main decision function: given feedbacks + quiz results + current plan, decide adjustments. */
export function decideAdaptiveAdjustment(
  feedbacks: SectionFeedback[],
  quizResults: QuizResult[],
  existingSections: LessonSection[],
  masteryByKnowledge?: Record<string, number>,
): AdaptiveDecision {
  const weakPoints = analyzeWeakPoints(feedbacks, quizResults);
  const supplementalSections = buildSupplementalSections(
    weakPoints,
    existingSections,
    masteryByKnowledge,
  );

  return {
    shouldSupplement: supplementalSections.length > 0,
    weakKnowledgePoints: weakPoints,
    supplementalSections,
  };
}
