/**
 * P6-001 Test 16: 生成缓存
 *
 * Tests the generation caching system — cache hit/miss behavior,
 * key generation from requirements, and cache eviction strategies.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { GenerationCache, generateCacheKey } from '@/lib/generation/cache';
import type { UserRequirements, SceneOutline } from '@/lib/types/generation';

// ─── Tests ───

describe('P6-001 Test 16: 生成缓存', () => {
  describe('cache key generation', () => {
    test('same requirements produce same cache key', () => {
      const req1: UserRequirements = { topic: '光合作用', grade: '初中' };
      const req2: UserRequirements = { topic: '光合作用', grade: '初中' };

      const key1 = generateCacheKey(req1);
      const key2 = generateCacheKey(req2);

      expect(key1).toBe(key2);
    });

    test('different requirements produce different cache keys', () => {
      const req1: UserRequirements = { topic: '光合作用', grade: '初中' };
      const req2: UserRequirements = { topic: '牛顿定律', grade: '初中' };

      const key1 = generateCacheKey(req1);
      const key2 = generateCacheKey(req2);

      expect(key1).not.toBe(key2);
    });

    test('cache key includes scene type', () => {
      const outline1: SceneOutline = { id: 's1', type: 'slide', title: 'A', description: '', keyPoints: [], order: 0 };
      const outline2: SceneOutline = { id: 's1', type: 'quiz', title: 'A', description: '', keyPoints: [], order: 0 };

      const key1 = generateCacheKey({ outline: outline1 } as UserRequirements);
      const key2 = generateCacheKey({ outline: outline2 } as UserRequirements);

      expect(key1).not.toBe(key2);
    });

    test('cache key is deterministic', () => {
      const req: UserRequirements = {
        topic: 'Chemistry',
        grade: '高中',
        language: 'en',
      };

      const key1 = generateCacheKey(req);
      const key2 = generateCacheKey(req);
      expect(key1).toBe(key2);
    });
  });

  describe('cache read/write', () => {
    let cache: GenerationCache;

    beforeEach(() => {
      cache = new GenerationCache();
    });

    test('stores and retrieves cached content', () => {
      const req: UserRequirements = { topic: 'Test', grade: '初中' };
      const content = { elements: [], background: undefined, remark: '' };

      cache.set(req, content);
      const cached = cache.get(req);

      expect(cached).not.toBeNull();
      expect(cached).toEqual(content);
    });

    test('returns null for cache miss', () => {
      const req: UserRequirements = { topic: 'Nonexistent', grade: '小学' };
      const cached = cache.get(req);
      expect(cached).toBeNull();
    });

    test('cache hit rate increases on hit', () => {
      const req: UserRequirements = { topic: 'Hit', grade: '初中' };
      cache.set(req, { elements: [], background: undefined, remark: '' });

      cache.get(req); // hit
      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    test('cache miss decreases hit rate', () => {
      const req: UserRequirements = { topic: 'Miss', grade: '初中' };
      cache.get(req); // miss

      const stats = cache.getStats();
      expect(stats.misses).toBeGreaterThan(0);
    });
  });

  describe('cache eviction', () => {
    let cache: GenerationCache;

    beforeEach(() => {
      cache = new GenerationCache({ maxSize: 3 });
    });

    test('evicts oldest entry when full', () => {
      cache.set({ topic: 'A', grade: '初中' }, { elements: [], background: undefined, remark: '' });
      cache.set({ topic: 'B', grade: '初中' }, { elements: [], background: undefined, remark: '' });
      cache.set({ topic: 'C', grade: '初中' }, { elements: [], background: undefined, remark: '' });
      cache.set({ topic: 'D', grade: '初中' }, { elements: [], background: undefined, remark: '' });

      // A should be evicted
      expect(cache.get({ topic: 'A', grade: '初中' })).toBeNull();
      expect(cache.get({ topic: 'D', grade: '初中' })).not.toBeNull();
    });

    test('max size is respected', () => {
      for (let i = 0; i < 10; i++) {
        cache.set({ topic: `T${i}`, grade: '初中' }, { elements: [], background: undefined, remark: '' });
      }

      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(3);
    });
  });

  describe('cache statistics', () => {
    test('getStats returns hit/miss counts', () => {
      const cache = new GenerationCache();
      const req: UserRequirements = { topic: 'Stats', grade: '初中' };

      cache.set(req, { elements: [], background: undefined, remark: '' });
      cache.get(req); // hit
      cache.get({ topic: 'Miss', grade: '初中' }); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    test('hit rate is calculated correctly', () => {
      const cache = new GenerationCache();
      const req: UserRequirements = { topic: 'Rate', grade: '初中' };

      cache.set(req, { elements: [], background: undefined, remark: '' });
      cache.get(req); // hit
      cache.get(req); // hit
      cache.get({ topic: 'Miss', grade: '初中' }); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 1);
    });

    test('clear resets all statistics', () => {
      const cache = new GenerationCache();
      cache.set({ topic: 'Clear', grade: '初中' }, { elements: [], background: undefined, remark: '' });
      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
