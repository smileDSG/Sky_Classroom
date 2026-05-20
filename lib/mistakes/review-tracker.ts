/**
 * Module C — Review tracker with Ebbinghaus forgetting-curve scheduling.
 *
 * Pure functions that work with MistakeBookEntry[] arrays.
 * No I/O — callers provide the data.
 */
import type { MistakeBookEntry } from './mistake-types';

/** Ebbinghaus review intervals in days */
export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30] as const;

/**
 * Calculate the next review timestamp and mastery level based on
 * reviewCount and the Ebbinghaus intervals.
 */
export function calculateNextReview(reviewCount: number): {
  nextReview: number;
  masteryLevel: number;
} {
  const idx = Math.min(reviewCount, EBBINGHAUS_INTERVALS.length - 1);
  const days = EBBINGHAUS_INTERVALS[idx];
  const nextReview = Date.now() + days * 24 * 60 * 60 * 1000;
  const masteryLevel = Math.min(reviewCount, EBBINGHAUS_INTERVALS.length);
  return { nextReview, masteryLevel };
}

/** Entries due for review right now */
export function getDueForReview(mistakes: MistakeBookEntry[]): MistakeBookEntry[] {
  const now = Date.now();
  return mistakes
    .filter((m) => !m.reviewed && m.nextReview !== undefined && m.nextReview <= now)
    .sort((a, b) => (a.nextReview ?? 0) - (b.nextReview ?? 0));
}

/** Review statistics */
export interface ReviewStats {
  total: number;
  reviewed: number;
  dueNow: number;
  mastered: number;
  reviewRate: number; // 0–1
}

export function getReviewStats(mistakes: MistakeBookEntry[]): ReviewStats {
  const total = mistakes.length;
  const reviewed = mistakes.filter((m) => m.reviewed).length;
  const dueNow = getDueForReview(mistakes).length;
  const mastered = mistakes.filter((m) => m.masteryLevel >= EBBINGHAUS_INTERVALS.length).length;
  const reviewRate = total > 0 ? reviewed / total : 0;
  return { total, reviewed, dueNow, mastered, reviewRate };
}
