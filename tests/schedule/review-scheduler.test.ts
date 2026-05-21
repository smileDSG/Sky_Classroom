import { describe, it, expect } from 'vitest';
import {
  buildReviewSchedule,
  getTodayMistakes,
  getDaysUntilReview,
  getMasteryProgress,
  getUrgentItems,
} from '@/lib/schedule/review-scheduler';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';

function makeEntry(overrides: Partial<MistakeBookEntry> = {}): MistakeBookEntry {
  return {
    id: 'm1',
    problemText: '1+1=?',
    userAnswer: '3',
    correctAnswer: '2',
    errorType: 'calculation',
    knowledgePoints: ['加法'],
    reviewCount: 0,
    masteryLevel: 0,
    reviewed: false,
    ...overrides,
  };
}

describe('getTodayMistakes', () => {
  it('returns items due now', () => {
    const due = makeEntry({ id: 'due', nextReview: Date.now() - 1000 });
    const future = makeEntry({ id: 'future', nextReview: Date.now() + 86400000 });
    const result = getTodayMistakes([due, future]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('due');
  });

  it('excludes reviewed items even if past due', () => {
    const reviewed = makeEntry({ id: 'r1', reviewed: true, nextReview: Date.now() - 1000 });
    expect(getTodayMistakes([reviewed])).toHaveLength(0);
  });

  it('excludes items with no nextReview', () => {
    const noReview = makeEntry({ id: 'n1', nextReview: undefined });
    expect(getTodayMistakes([noReview])).toHaveLength(0);
  });

  it('sorts by nextReview ascending', () => {
    const older = makeEntry({ id: 'older', nextReview: Date.now() - 5000 });
    const newer = makeEntry({ id: 'newer', nextReview: Date.now() - 1000 });
    const result = getTodayMistakes([newer, older]);
    expect(result[0].id).toBe('older');
  });

  it('empty array → empty', () => {
    expect(getTodayMistakes([])).toHaveLength(0);
  });
});

describe('buildReviewSchedule', () => {
  it('empty → zero totals', () => {
    const schedule = buildReviewSchedule([]);
    expect(schedule.total).toBe(0);
    expect(schedule.today).toBeNull();
  });

  it('has today plan when items are due', () => {
    const due = makeEntry({ id: 'due', nextReview: Date.now() - 1000 });
    const schedule = buildReviewSchedule([due]);
    expect(schedule.today).not.toBeNull();
    expect(schedule.today!.count).toBe(1);
  });

  it('counts completed items', () => {
    const done = makeEntry({ id: 'done', reviewed: true });
    const due = makeEntry({ id: 'due', nextReview: Date.now() - 1000 });
    const schedule = buildReviewSchedule([done, due]);
    expect(schedule.completed).toBe(1);
  });

  it('counts overdue items (>1 day past)', () => {
    const old = makeEntry({
      id: 'old',
      nextReview: Date.now() - 3 * 24 * 60 * 60 * 1000,
    });
    const schedule = buildReviewSchedule([old]);
    expect(schedule.overdue).toBe(1);
  });

  it('builds upcoming plan for future reviews', () => {
    const future = makeEntry({
      id: 'f1',
      nextReview: Date.now() + 2 * 24 * 60 * 60 * 1000,
    });
    const schedule = buildReviewSchedule([future]);
    expect(schedule.upcoming.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getDaysUntilReview', () => {
  it('returns days until next review', () => {
    const entry = makeEntry({ nextReview: Date.now() + 2 * 24 * 60 * 60 * 1000 });
    expect(getDaysUntilReview(entry)).toBeGreaterThanOrEqual(1);
  });

  it('returns null for reviewed items', () => {
    const entry = makeEntry({ reviewed: true, nextReview: Date.now() + 1000 });
    expect(getDaysUntilReview(entry)).toBeNull();
  });

  it('returns null when no nextReview', () => {
    expect(getDaysUntilReview(makeEntry({ nextReview: undefined }))).toBeNull();
  });

  it('returns 0 for past due items', () => {
    const entry = makeEntry({ nextReview: Date.now() - 1000 });
    expect(getDaysUntilReview(entry)).toBe(0);
  });
});

describe('getMasteryProgress', () => {
  it('full mastery → 100%', () => {
    const items = [
      makeEntry({ id: 'a', reviewed: true }),
      makeEntry({ id: 'b', reviewed: true }),
    ];
    const progress = getMasteryProgress(items);
    expect(progress.percentComplete).toBe(100);
    expect(progress.masteredCount).toBe(2);
  });

  it('no items → 100% with empty label', () => {
    const progress = getMasteryProgress([]);
    expect(progress.percentComplete).toBe(100);
    expect(progress.label).toContain('还没有错题记录');
  });

  it('partial progress → correct percentage', () => {
    const items = [
      makeEntry({ id: 'a', reviewed: true }),
      makeEntry({ id: 'b', reviewed: false, reviewCount: 1 }),
      makeEntry({ id: 'c', reviewed: false, reviewCount: 0 }),
    ];
    const progress = getMasteryProgress(items);
    expect(progress.masteredCount).toBe(1);
    expect(progress.percentComplete).toBe(33);
  });
});

describe('getUrgentItems', () => {
  it('returns limited urgent count', () => {
    const items = [
      makeEntry({ id: 'a', nextReview: Date.now() - 1000 }),
      makeEntry({ id: 'b', nextReview: Date.now() - 2000 }),
      makeEntry({ id: 'c', nextReview: Date.now() - 3000 }),
    ];
    expect(getUrgentItems(items, 2)).toHaveLength(2);
  });

  it('sorts most overdue first', () => {
    const items = [
      makeEntry({ id: 'newer', nextReview: Date.now() - 1000 }),
      makeEntry({ id: 'older', nextReview: Date.now() - 5000 }),
    ];
    const urgent = getUrgentItems(items);
    expect(urgent[0].id).toBe('older');
  });
});
