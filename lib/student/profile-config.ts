/**
 * D-001-b Student Profile — Configuration Layer
 *
 * Centralizes all learning-profile related constants and rules so that
 * quiz / memory-card / teaching modules can be driven by StudentProfile
 * without hard-coding subjects, thresholds, or difficulty ranges.
 */

import type { Subject } from '@/lib/solve/agents/analyze-types';
import { inferSubject } from '@/lib/mistakes/subject-inference';
import type { StudentProfile } from './profile-types';

// ── Thresholds ─────────────────────────────────────────────────────

export const PROFILE_THRESHOLDS = {
  weak: 30,
  strong: 80,
  masteryCompleted: 80,
  masteryReview: 50,
} as const;

// ── Difficulty configuration ────────────────────────────────────────

export type DifficultyId = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  desc: string;
  masteryRange: [number, number];
}

export const DIFFICULTY_CONFIG: DifficultyConfig[] = [
  { id: 'easy', label: '基础', desc: '巩固基础概念和公式', masteryRange: [0, PROFILE_THRESHOLDS.weak] },
  { id: 'medium', label: '进阶', desc: '提升理解与应用能力', masteryRange: [PROFILE_THRESHOLDS.weak, 70] },
  { id: 'hard', label: '挑战', desc: '强化综合与思维深度', masteryRange: [70, 100] },
];

/**
 * Map a mastery percentage to a difficulty level.
 */
export function getDifficultyForMastery(mastery: number): DifficultyId {
  if (mastery < PROFILE_THRESHOLDS.weak) return 'easy';
  if (mastery <= 70) return 'medium';
  return 'hard';
}

// ── Subject configuration ───────────────────────────────────────────

export interface SubjectConfig {
  id: Subject;
  label: string;
  promptHint: string;
  /** Tailwind CSS class for the subject indicator dot */
  dot: string;
}

export const SUBJECT_CONFIG: SubjectConfig[] = [
  { id: 'math', label: '数学', promptHint: '注重计算过程、公式运用和逻辑推理', dot: 'bg-violet-400' },
  { id: 'physics', label: '物理', promptHint: '注重物理情景理解、公式选择和实验分析', dot: 'bg-sky-400' },
  { id: 'chemistry', label: '化学', promptHint: '注重反应原理、物质结构和实验操作', dot: 'bg-emerald-400' },
  { id: 'biology', label: '生物', promptHint: '注重概念辨析、生理过程和生命现象', dot: 'bg-green-400' },
  { id: 'chinese', label: '语文', promptHint: '注重文学常识、阅读理解和语言表达', dot: 'bg-rose-400' },
  { id: 'english', label: '英语', promptHint: '注重语法、词汇运用和阅读理解', dot: 'bg-amber-400' },
  { id: 'history', label: '历史', promptHint: '注重史实脉络、时代背景和因果分析', dot: 'bg-orange-400' },
  { id: 'politics', label: '政治', promptHint: '注重概念理解、材料分析和观点辨析', dot: 'bg-red-400' },
  { id: 'geography', label: '地理', promptHint: '注重区域认知、图表信息和自然人文联系', dot: 'bg-teal-400' },
];

export const SUBJECT_IDS = SUBJECT_CONFIG.map((s) => s.id);

/**
 * Resolve a subject from a topic and optional profile.
 * 1. Try to infer from the topic string.
 * 2. Fall back to the weakest subject with positive mastery in the profile.
 * 3. Final fallback to 'math' for backward compatibility.
 */
export function resolveSubject(topic: string, profile?: StudentProfile): Subject {
  const fromTopic = inferSubject(topic);
  if (fromTopic !== 'unknown') return fromTopic;

  if (profile) {
    const subjects = Object.entries(profile.masteryBySubject)
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[1] - b[1]);
    const weakest = subjects[0]?.[0] as Subject | undefined;
    if (weakest) return weakest;
  }

  return 'math';
}

// ── Count / interval options ────────────────────────────────────────

export const QUIZ_COUNT_OPTIONS = [3, 5, 10, 15];
export const MEMORY_COUNT_OPTIONS = [6, 12, 20, 30];
export const DEFAULT_REVIEW_INTERVALS = [1, 2, 4, 7, 15];

/**
 * Adjust review intervals based on average mastery.
 * Lower mastery → shorter initial intervals for more frequent review.
 */
export function getReviewIntervalsForMastery(
  avgMastery: number,
  baseIntervals: number[] = DEFAULT_REVIEW_INTERVALS,
): number[] {
  // Mastery 0..100. Scale factor ranges from 0.5 (very weak) to 1.5 (strong).
  const scale = 0.5 + (avgMastery / 100) * 1.0;
  return baseIntervals.map((d) => Math.max(1, Math.round(d * scale)));
}
