import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCloudMindCacheKey,
  clearCloudMindCache,
  getCloudMindCache,
  setCloudMindCache,
} from '@/lib/agents/cloud-mind/cache';

describe('cloud mind cache', () => {
  beforeEach(() => {
    clearCloudMindCache();
    vi.useRealTimers();
  });

  it('returns a cloned cached value for stable equivalent keys', () => {
    const keyA = buildCloudMindCacheKey('quiz', {
      topic: 'quadratic',
      count: 5,
      options: { difficulty: 'medium', subject: 'math' },
    });
    const keyB = buildCloudMindCacheKey('quiz', {
      count: 5,
      options: { subject: 'math', difficulty: 'medium' },
      topic: 'quadratic',
    });

    setCloudMindCache(keyA, { questions: [{ id: 1, text: 'cached' }] });

    const cached = getCloudMindCache<{ questions: Array<{ id: number; text: string }> }>(keyB);
    expect(cached).toEqual({ questions: [{ id: 1, text: 'cached' }] });

    cached!.questions[0].text = 'mutated';
    expect(getCloudMindCache(keyA)).toEqual({ questions: [{ id: 1, text: 'cached' }] });
  });

  it('expires entries after ttl', () => {
    vi.useFakeTimers();
    const key = buildCloudMindCacheKey('memory', { topic: 'photosynthesis' });

    setCloudMindCache(key, { cards: [] }, { ttlMs: 1000 });
    expect(getCloudMindCache(key)).toEqual({ cards: [] });

    vi.advanceTimersByTime(1001);
    expect(getCloudMindCache(key)).toBeUndefined();
  });

  it('evicts the oldest entry when max entries is exceeded', () => {
    setCloudMindCache('oldest', { value: 1 }, { maxEntries: 2 });
    setCloudMindCache('middle', { value: 2 }, { maxEntries: 2 });
    setCloudMindCache('newest', { value: 3 }, { maxEntries: 2 });

    expect(getCloudMindCache('oldest')).toBeUndefined();
    expect(getCloudMindCache('middle')).toEqual({ value: 2 });
    expect(getCloudMindCache('newest')).toEqual({ value: 3 });
  });
});
