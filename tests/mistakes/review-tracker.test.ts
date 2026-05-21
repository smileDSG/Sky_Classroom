import { describe, it, expect } from 'vitest';
import {
  EBBINGHAUS_INTERVALS,
  calculateNextReview,
  getDueForReview,
  getReviewStats,
} from '@/lib/mistakes/review-tracker';
import type { MistakeBookEntry } from '@/lib/mistakes/mistake-types';

function makeEntry(overrides: Partial<MistakeBookEntry> = {}): MistakeBookEntry {
  return {
    id: 'm1',
    problemText: 'x + 2 = 5',
    userAnswer: 'x = 2',
    correctAnswer: 'x = 3',
    errorType: 'calculation',
    knowledgePoints: ['代数'],
    reviewCount: 0,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  };
}

describe('calculateNextReview', () => {
  it('reviewCount 0 → next review in 1 day', () => {
    const { nextReview, masteryLevel } = calculateNextReview(0);
    const dayMs = 24 * 60 * 60 * 1000;
    expect(nextReview).toBeGreaterThan(Date.now() + dayMs - 1000);
    expect(nextReview).toBeLessThan(Date.now() + 2 * dayMs);
    expect(masteryLevel).toBe(0);
  });

  it('reviewCount 1 → next review in 2 days', () => {
    const { masteryLevel } = calculateNextReview(1);
    expect(masteryLevel).toBe(1);
  });

  it('reviewCount 5 → mastery 5, next in 30 days', () => {
    const { nextReview, masteryLevel } = calculateNextReview(5);
    const dayMs = 24 * 60 * 60 * 1000;
    expect(masteryLevel).toBe(5);
    expect(nextReview).toBeGreaterThan(Date.now() + 29 * dayMs);
  });

  it('reviewCount 6 (mastered) → mastery 6', () => {
    const { masteryLevel } = calculateNextReview(6);
    expect(masteryLevel).toBe(6);
  });

  it('reviewCount beyond max → capped', () => {
    const { masteryLevel } = calculateNextReview(10);
    expect(masteryLevel).toBe(EBBINGHAUS_INTERVALS.length);
  });
});

describe('getDueForReview', () => {
  it('returns entries with nextReview in the past', () => {
    const past = Date.now() - 3600000;
    const future = Date.now() + 86400000;
    const entries = [
      makeEntry({ id: 'a', nextReview: past, reviewed: false }),
      makeEntry({ id: 'b', nextReview: future, reviewed: false }),
      makeEntry({ id: 'c' }), // no nextReview
    ];
    const due = getDueForReview(entries);
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('a');
  });

  it('excludes reviewed entries', () => {
    const past = Date.now() - 3600000;
    const entries = [
      makeEntry({ id: 'a', nextReview: past, reviewed: true }),
    ];
    expect(getDueForReview(entries)).toHaveLength(0);
  });

  it('empty array returns empty', () => {
    expect(getDueForReview([])).toHaveLength(0);
  });
});

describe('getReviewStats', () => {
  it('empty array returns zeros', () => {
    const stats = getReviewStats([]);
    expect(stats).toEqual({ total: 0, reviewed: 0, dueNow: 0, mastered: 0, reviewRate: 0 });
  });

  it('computes stats correctly', () => {
    const past = Date.now() - 3600000;
    const entries = [
      makeEntry({ id: 'a', reviewed: true, masteryLevel: 6 }),
      makeEntry({ id: 'b', reviewed: false, nextReview: past }),
      makeEntry({ id: 'c', reviewed: false }),
      makeEntry({ id: 'd', reviewed: true, masteryLevel: 3 }),
    ];
    const stats = getReviewStats(entries);
    expect(stats.total).toBe(4);
    expect(stats.reviewed).toBe(2);
    expect(stats.dueNow).toBe(1);
    expect(stats.mastered).toBe(1);
    expect(stats.reviewRate).toBe(0.5);
  });
});
