import type { MemoryReviewRating, MemoryReviewRecord } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const INTERVALS_BY_RATING: Record<MemoryReviewRating, number[]> = {
  remembered: [1, 3, 7, 15, 30, 60],
  fuzzy: [1, 2, 4, 7, 15, 30],
  forgotten: [1, 1, 2, 4, 7, 15],
};

const MASTERY_DELTA: Record<MemoryReviewRating, number> = {
  remembered: 18,
  fuzzy: 6,
  forgotten: -18,
};

export const MEMORY_REVIEW_LABELS: Record<MemoryReviewRating, string> = {
  remembered: '已掌握',
  fuzzy: '还需复习',
  forgotten: '没记住',
};

export function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildMemoryReviewId(userId: string, cardId: string): string {
  return `memory_review_${hashString(`${userId}:${cardId}`)}`;
}

export function buildMemoryDeckId(topic: string, cardCount: number): string {
  return `memory_deck_${hashString(`${topic}:${cardCount}`)}`;
}

export function buildMemoryCardId(deckId: string, index: number, front: string): string {
  return `${deckId}_card_${index}_${hashString(front)}`;
}

function clampMastery(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function intervalFor(rating: MemoryReviewRating, reviewCount: number): number {
  const intervals = INTERVALS_BY_RATING[rating];
  return intervals[Math.min(Math.max(reviewCount, 0), intervals.length - 1)];
}

export function scheduleMemoryReview(input: {
  userId?: string;
  cardId: string;
  deckId: string;
  rating: MemoryReviewRating;
  previous?: MemoryReviewRecord | null;
  now?: number;
  sourceType?: MemoryReviewRecord['sourceType'];
  sourceId?: string;
  front?: string;
  back?: string;
  tags?: string[];
}): MemoryReviewRecord {
  const now = input.now ?? Date.now();
  const userId = input.userId || input.previous?.userId || 'default-user';
  const previousReviewCount = input.previous?.reviewCount ?? 0;
  const previousMastery = input.previous?.mastery ?? 35;
  const reviewCount = input.rating === 'forgotten' ? 0 : previousReviewCount + 1;
  const mastery = clampMastery(previousMastery + MASTERY_DELTA[input.rating]);
  const nextReviewAt = now + intervalFor(input.rating, reviewCount) * DAY_MS;

  return {
    id: input.previous?.id || buildMemoryReviewId(userId, input.cardId),
    cardId: input.cardId,
    deckId: input.deckId,
    userId,
    rating: input.rating,
    reviewCount,
    mastery,
    lastReviewedAt: new Date(now).toISOString(),
    nextReviewAt: new Date(nextReviewAt).toISOString(),
    sourceType: input.sourceType ?? input.previous?.sourceType,
    sourceId: input.sourceId ?? input.previous?.sourceId,
    front: input.front ?? input.previous?.front,
    back: input.back ?? input.previous?.back,
    tags: input.tags ?? input.previous?.tags ?? [],
  };
}

export function getLatestMemoryReviews(
  reviews: MemoryReviewRecord[],
): MemoryReviewRecord[] {
  const byCardId = new Map<string, MemoryReviewRecord>();
  for (const review of reviews) {
    const existing = byCardId.get(review.cardId);
    if (
      !existing ||
      new Date(review.lastReviewedAt).getTime() > new Date(existing.lastReviewedAt).getTime()
    ) {
      byCardId.set(review.cardId, review);
    }
  }
  return [...byCardId.values()];
}

export function getDueMemoryReviews(
  reviews: MemoryReviewRecord[],
  now = Date.now(),
): MemoryReviewRecord[] {
  return getLatestMemoryReviews(reviews)
    .filter((review) => new Date(review.nextReviewAt).getTime() <= now && review.mastery < 95)
    .sort(
      (a, b) =>
        new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime(),
    );
}
