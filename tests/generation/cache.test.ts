import { describe, expect, it, beforeEach } from 'vitest';
import { GenerationCache } from '@/lib/generation/cache';
import type { SceneOutline } from '@/lib/types/generation';

describe('GenerationCache', () => {
  let cache: GenerationCache;

  beforeEach(() => {
    cache = new GenerationCache(10);
  });

  function makeOutline(overrides: Partial<SceneOutline> = {}): SceneOutline {
    return {
      id: 'outline-1',
      type: 'slide',
      title: 'Test Outline',
      description: 'A test outline',
      keyPoints: ['point 1', 'point 2'],
      order: 1,
      ...overrides,
    };
  }

  describe('buildKey', () => {
    it('produces same key for identical outlines', () => {
      const a = makeOutline();
      const b = makeOutline();
      expect(cache.buildKey(a)).toBe(cache.buildKey(b));
    });

    it('produces same key regardless of id/order fields', () => {
      const a = makeOutline({ id: 'xyz', order: 99 });
      const b = makeOutline({ id: 'abc', order: 1 });
      expect(cache.buildKey(a)).toBe(cache.buildKey(b));
    });

    it('produces different keys for completely different outline content', () => {
      const a = makeOutline({
        title: 'Introduction to Machine Learning',
        description: 'Covering supervised and unsupervised methods',
        keyPoints: ['regression', 'classification', 'clustering'],
      });
      const b = makeOutline({
        title: 'Advanced Quantum Field Theory',
        description: 'Gauge symmetries and renormalization',
        keyPoints: ['Lagrangian', 'Feynman diagrams', 'QED'],
      });
      expect(cache.buildKey(a)).not.toBe(cache.buildKey(b));
    });

    it('produces different keys when options differ significantly', () => {
      const outline = makeOutline();
      const key1 = cache.buildKey(outline, {
        languageDirective: 'Chinese, formal academic style',
        agentCount: 4,
      });
      const key2 = cache.buildKey(outline, {
        languageDirective: 'English, casual conversational style',
        agentCount: 1,
      });
      expect(key1).not.toBe(key2);
    });
  });

  describe('get/set', () => {
    it('returns undefined for missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('returns stored value', () => {
      cache.set('key1', { data: 'hello' });
      expect(cache.get('key1')).toEqual({ data: 'hello' });
    });

    it('increments hit counter on get', () => {
      cache.set('key1', 'value');
      cache.get('key1');
      cache.get('key1');
      expect(cache.stats().hits).toBe(2);
    });

    it('increments miss counter for missing keys', () => {
      cache.get('nonexistent');
      expect(cache.stats().misses).toBe(1);
    });
  });

  describe('eviction', () => {
    it('evicts oldest entry when maxSize exceeded', () => {
      const small = new GenerationCache(3);
      small.set('a', 1);
      small.set('b', 2);
      small.set('c', 3);
      small.set('d', 4); // Should evict 'a'

      expect(small.get('a')).toBeUndefined();
      expect(small.get('b')).toBe(2);
      expect(small.get('c')).toBe(3);
      expect(small.get('d')).toBe(4);
    });
  });

  describe('stats and hitRate', () => {
    it('reports initial stats correctly', () => {
      const s = cache.stats();
      expect(s.size).toBe(0);
      expect(s.hits).toBe(0);
      expect(s.misses).toBe(0);
      expect(s.maxSize).toBe(10);
    });

    it('hitRate returns 0 with no accesses', () => {
      expect(cache.hitRate()).toBe(0);
    });

    it('hitRate returns correct ratio', () => {
      cache.set('k', 'v');
      cache.get('k'); // hit
      cache.get('missing'); // miss
      cache.get('missing'); // miss
      expect(cache.hitRate()).toBeCloseTo(1 / 3);
    });
  });

  describe('clear', () => {
    it('removes all entries and resets counters', () => {
      cache.set('k1', 1);
      cache.set('k2', 2);
      cache.get('k1');
      cache.clear();

      expect(cache.stats().size).toBe(0);
      expect(cache.stats().hits).toBe(0);
      expect(cache.get('k1')).toBeUndefined();
    });
  });

  describe('full cache workflow', () => {
    it('caches and retrieves outline content via key', () => {
      const outline = makeOutline({ title: 'Biology 101' });
      const key = cache.buildKey(outline, { directive: 'en' });

      const content = { elements: [], background: { color: '#fff' } };
      cache.set(`${key}:content`, content);

      const restored = cache.get<typeof content>(`${key}:content`);
      expect(restored).toEqual(content);
    });

    it('similar requests hit cache, different requests miss', () => {
      const sameOutline = makeOutline({
        title: 'Introduction to Calculus',
        description: 'Limits, derivatives, and integrals',
        keyPoints: ['limits', 'chain rule', 'integration'],
      });
      const differentOutline = makeOutline({
        title: 'World History: Ancient Civilizations',
        description: 'Mesopotamia, Egypt, Greece, and Rome',
        keyPoints: ['cuneiform', 'hieroglyphs', 'democracy'],
      });

      const key1 = cache.buildKey(sameOutline);
      cache.set(key1, 'math-content');

      // Same outline with different id should hit
      const key2 = cache.buildKey({ ...sameOutline, id: 'different-id', order: 99 });
      expect(cache.get(key2)).toBe('math-content');

      // Different outline should miss
      const key3 = cache.buildKey(differentOutline);
      expect(cache.get(key3)).toBeUndefined();
    });
  });
});
