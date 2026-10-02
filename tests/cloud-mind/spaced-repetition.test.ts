import { describe, expect, it } from 'vitest';
import {
  buildMemoryCardId,
  buildMemoryDeckId,
  getDueMemoryReviews,
  getLatestMemoryReviews,
  scheduleMemoryReview,
} from '@/lib/cloud-mind/spaced-repetition';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 1);

function reviewAt(
  rating: 'remembered' | 'fuzzy' | 'forgotten',
  previous?: Parameters<typeof scheduleMemoryReview>[0]['previous'],
) {
  return scheduleMemoryReview({
    userId: 'u1',
    deckId: 'deck',
    cardId: 'card',
    rating,
    previous: previous ?? null,
    now: NOW,
  });
}

describe('cloud mind spaced repetition', () => {
  it('schedules remembered cards further out and increases mastery', () => {
    const deckId = buildMemoryDeckId('二次函数', 3);
    const cardId = buildMemoryCardId(deckId, 0, '顶点式是什么？');
    const review = scheduleMemoryReview({
      userId: 'u1',
      deckId,
      cardId,
      rating: 'remembered',
      now: NOW,
    });

    expect(review.reviewCount).toBe(1);
    expect(review.mastery).toBe(53);
    expect(new Date(review.nextReviewAt).getTime()).toBe(NOW + 3 * DAY_MS);
  });

  it('resets review count when the learner forgot the card', () => {
    const previous = reviewAt('remembered');
    const next = reviewAt('forgotten', previous);

    expect(next.reviewCount).toBe(0);
    expect(next.mastery).toBeLessThan(previous.mastery);
    expect(new Date(next.nextReviewAt).getTime()).toBe(NOW + DAY_MS);
  });

  it('walks up the remembered interval ladder across repeated successes', () => {
    let review = reviewAt('remembered');
    const days = [review];
    for (let i = 1; i < 6; i += 1) {
      review = reviewAt('remembered', review);
      days.push(review);
    }
    const intervals = days.map((item) => (new Date(item.nextReviewAt).getTime() - NOW) / DAY_MS);
    expect(intervals).toEqual([3, 7, 15, 30, 60, 60]);
  });

  it('walks up the fuzzy interval ladder and caps at its final interval', () => {
    let review = reviewAt('fuzzy');
    const intervals = [2];
    for (let i = 1; i < 5; i += 1) {
      review = reviewAt('fuzzy', review);
      intervals.push((new Date(review.nextReviewAt).getTime() - NOW) / DAY_MS);
    }
    expect(intervals).toEqual([2, 4, 7, 15, 30]);
  });

  it('clamps mastery between 0 and 100', () => {
    let review = reviewAt('remembered');
    for (let i = 0; i < 6; i += 1) {
      review = reviewAt('remembered', review);
    }
    expect(review.mastery).toBe(100);

    review = reviewAt('forgotten');
    for (let i = 0; i < 6; i += 1) {
      review = reviewAt('forgotten', review);
    }
    expect(review.mastery).toBe(0);
  });

  it('keeps id, front, back and tags stable when rescheduling a known card', () => {
    const previous = reviewAt('fuzzy');
    const next = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'card',
      rating: 'remembered',
      previous,
      now: NOW + DAY_MS,
      front: '新正面',
      back: '新背面',
      tags: ['新标签'],
    });
    expect(next.id).toBe(previous.id);
    expect(next.front).toBe('新正面');
    expect(next.back).toBe('新背面');
    expect(next.tags).toEqual(['新标签']);
  });

  it('falls back to a default user and inherits source metadata from previous', () => {
    const previous = reviewAt('fuzzy');
    const next = scheduleMemoryReview({
      cardId: 'card',
      deckId: 'deck',
      rating: 'remembered',
      previous,
      now: NOW,
    });
    expect(next.userId).toBe(previous.userId);
    expect(next.sourceType).toBeUndefined();
  });

  it('returns due cards by earliest next review time', () => {
    const early = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'early',
      rating: 'fuzzy',
      now: NOW,
    });
    const later = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'later',
      rating: 'remembered',
      now: NOW,
    });

    const due = getDueMemoryReviews([later, early], NOW + 2 * DAY_MS + 1000);
    expect(due.map((item) => item.cardId)).toEqual(['early']);
  });

  it('deduplicates reviews per card keeping the latest one', () => {
    const first = reviewAt('fuzzy');
    const second = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'card',
      rating: 'remembered',
      previous: first,
      now: NOW + DAY_MS,
    });
    const latest = getLatestMemoryReviews([first, second]);
    expect(latest).toHaveLength(1);
    expect(latest[0].id).toBe(second.id);
  });

  it('excludes mastered cards (mastery >= 95) from due reviews', () => {
    let review = reviewAt('remembered');
    for (let i = 0; i < 5; i += 1) {
      review = reviewAt('remembered', review);
    }
    expect(review.mastery).toBeGreaterThanOrEqual(95);
    expect(getDueMemoryReviews([review], NOW + 100 * DAY_MS)).toEqual([]);
  });

  it('builds deterministic ids from the same inputs', () => {
    expect(buildMemoryCardId('deck', 1, 'front')).toBe(buildMemoryCardId('deck', 1, 'front'));
    expect(buildMemoryCardId('deck', 1, 'front')).not.toBe(buildMemoryCardId('deck', 1, 'other'));
  });
});
