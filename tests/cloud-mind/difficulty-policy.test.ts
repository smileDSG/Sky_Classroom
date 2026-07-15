import { describe, expect, it } from 'vitest';
import { derivePreferredDifficulty } from '@/lib/cloud-mind/difficulty-policy';

describe('cloud mind difficulty policy', () => {
  it('defaults to medium when there is no learning data', () => {
    expect(derivePreferredDifficulty({ hasLearningData: false })).toBe('medium');
  });

  it('uses easy when recent accuracy or primary mastery is low', () => {
    expect(
      derivePreferredDifficulty({
        hasLearningData: true,
        recentAccuracy: 54,
        primaryMastery: 82,
      }),
    ).toBe('easy');
    expect(
      derivePreferredDifficulty({
        hasLearningData: true,
        recentAccuracy: 92,
        primaryMastery: 49,
      }),
    ).toBe('easy');
  });

  it('uses hard only when both available signals are high', () => {
    expect(
      derivePreferredDifficulty({
        hasLearningData: true,
        recentAccuracy: 88,
        primaryMastery: 79,
      }),
    ).toBe('hard');
    expect(
      derivePreferredDifficulty({
        hasLearningData: true,
        recentAccuracy: 88,
        primaryMastery: null,
      }),
    ).toBe('medium');
  });

  it('keeps the middle band at medium', () => {
    expect(
      derivePreferredDifficulty({
        hasLearningData: true,
        recentAccuracy: 72,
        primaryMastery: 68,
      }),
    ).toBe('medium');
  });
});
