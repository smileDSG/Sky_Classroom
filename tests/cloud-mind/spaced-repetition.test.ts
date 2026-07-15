import { describe, expect, it } from 'vitest';
import {
  buildMemoryCardId,
  buildMemoryDeckId,
  getDueMemoryReviews,
  scheduleMemoryReview,
} from '@/lib/cloud-mind/spaced-repetition';

describe('cloud mind spaced repetition', () => {
  it('schedules remembered cards further out and increases mastery', () => {
    const deckId = buildMemoryDeckId('二次函数', 3);
    const cardId = buildMemoryCardId(deckId, 0, '顶点式是什么？');
    const review = scheduleMemoryReview({
      userId: 'u1',
      deckId,
      cardId,
      rating: 'remembered',
      now: Date.UTC(2026, 0, 1),
    });

    expect(review.reviewCount).toBe(1);
    expect(review.mastery).toBeGreaterThan(35);
    expect(new Date(review.nextReviewAt).getTime()).toBeGreaterThan(Date.UTC(2026, 0, 1));
  });

  it('resets review count when the learner forgot the card', () => {
    const previous = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'card',
      rating: 'remembered',
      now: Date.UTC(2026, 0, 1),
    });
    const next = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'card',
      rating: 'forgotten',
      previous,
      now: Date.UTC(2026, 0, 2),
    });

    expect(next.reviewCount).toBe(0);
    expect(next.mastery).toBeLessThan(previous.mastery);
  });

  it('returns due cards by earliest next review time', () => {
    const early = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'early',
      rating: 'fuzzy',
      now: Date.UTC(2026, 0, 1),
    });
    const later = scheduleMemoryReview({
      userId: 'u1',
      deckId: 'deck',
      cardId: 'later',
      rating: 'remembered',
      now: Date.UTC(2026, 0, 1),
    });

    const due = getDueMemoryReviews([later, early], Date.UTC(2026, 0, 3));
    expect(due.map((item) => item.cardId)).toEqual(['early']);
  });
});
