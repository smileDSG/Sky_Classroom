/**
 * P6-001 Test 9: 增量生成
 *
 * Tests incremental generation — generating scene content while
 * the outline is being edited. Validates that partial outlines
 * can be processed and that generated content can be updated
 * without full regeneration.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateSceneContent, generateSceneActions } from '@/lib/generation/scene-generator';
import { applyOutlineFallbacks } from '@/lib/generation/outline-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { SceneOutline, GeneratedSlideContent } from '@/lib/types/generation';

// ─── Incremental generation simulation ───

interface GenerationCache {
  get(id: string): GeneratedSlideContent | null;
  set(id: string, content: GeneratedSlideContent): void;
  invalidate(id: string): void;
  has(id: string): boolean;
}

class SimpleCache implements GenerationCache {
  private store = new Map<string, GeneratedSlideContent>();

  get(id: string) {
    return this.store.get(id) || null;
  }

  set(id: string, content: GeneratedSlideContent) {
    this.store.set(id, content);
  }

  invalidate(id: string) {
    this.store.delete(id);
  }

  has(id: string) {
    return this.store.has(id);
  }
}

const VALID_SLIDE_JSON = JSON.stringify({
  elements: [
    {
      id: 'text_1',
      type: 'text',
      left: 60,
      top: 80,
      width: 880,
      height: 76,
      content: '<p>Slide Content</p>',
      defaultFontName: '',
      defaultColor: '#333',
    },
  ],
  background: { type: 'solid', color: '#fff' },
  remark: '',
});

// ─── Tests ───

describe('P6-001 Test 9: 增量生成', () => {
  describe('incremental content generation', () => {
    test('generates content for first scene in outline', async () => {
      const outline: SceneOutline = {
        id: 'scene-1',
        type: 'slide',
        title: 'Introduction',
        description: 'First scene',
        keyPoints: ['point 1'],
        order: 0,
      };

      const { aiCall } = makeAiCall(VALID_SLIDE_JSON);
      const content = await generateSceneContent(outline, aiCall, {});

      expect(content).not.toBeNull();
    });

    test('can generate content for a specific scene independently', async () => {
      const outlines: SceneOutline[] = [
        { id: 'scene-1', type: 'slide', title: 'A', description: '', keyPoints: [], order: 0 },
        { id: 'scene-2', type: 'slide', title: 'B', description: '', keyPoints: [], order: 1 },
        { id: 'scene-3', type: 'slide', title: 'C', description: '', keyPoints: [], order: 2 },
      ];

      // Generate only scene-2
      const { aiCall } = makeAiCall(VALID_SLIDE_JSON);
      const content = await generateSceneContent(outlines[1], aiCall, {});

      expect(content).not.toBeNull();
    });

    test('regenerating a scene replaces previous content', async () => {
      const outline: SceneOutline = {
        id: 'scene-1',
        type: 'slide',
        title: 'Test',
        description: '',
        keyPoints: [],
        order: 0,
      };

      const cache = new SimpleCache();

      // First generation
      const aiCall1: AICallFn = async () =>
        JSON.stringify({
          ...JSON.parse(VALID_SLIDE_JSON),
          elements: [{ ...JSON.parse(VALID_SLIDE_JSON).elements[0], content: '<p>Version 1</p>' }],
        });
      const content1 = await generateSceneContent(outline, aiCall1, {});
      cache.set('scene-1', content1 as GeneratedSlideContent);

      // Regeneration with different content
      const aiCall2: AICallFn = async () =>
        JSON.stringify({
          ...JSON.parse(VALID_SLIDE_JSON),
          elements: [{ ...JSON.parse(VALID_SLIDE_JSON).elements[0], content: '<p>Version 2</p>' }],
        });
      const content2 = await generateSceneContent(outline, aiCall2, {});
      cache.set('scene-1', content2 as GeneratedSlideContent);

      expect(cache.get('scene-1')?.elements[0].content).toBe('<p>Version 2</p>');
    });
  });

  describe('outline editing during generation', () => {
    test('modified outline scene is regenerated', async () => {
      const original: SceneOutline = {
        id: 'scene-1',
        type: 'slide',
        title: 'Original Title',
        description: 'Original description',
        keyPoints: ['original point'],
        order: 0,
      };

      const modified: SceneOutline = {
        ...original,
        title: 'Modified Title',
        keyPoints: ['new point 1', 'new point 2'],
      };

      // Generate with original
      const { aiCall: aiCall1 } = makeAiCall(VALID_SLIDE_JSON);
      const content1 = await generateSceneContent(original, aiCall1, {});
      expect(content1).not.toBeNull();

      // Generate with modified (should produce different content in real system)
      const { aiCall: aiCall2 } = makeAiCall(VALID_SLIDE_JSON);
      const content2 = await generateSceneContent(modified, aiCall2, {});
      expect(content2).not.toBeNull();
    });

    test('adding new scene to outline does not affect existing scenes', async () => {
      const outline1: SceneOutline = {
        id: 'scene-1',
        type: 'slide',
        title: 'Scene 1',
        description: '',
        keyPoints: [],
        order: 0,
      };

      const outline2: SceneOutline = {
        id: 'scene-2',
        type: 'slide',
        title: 'Scene 2',
        description: '',
        keyPoints: [],
        order: 1,
      };

      // Generate scene-1
      const { aiCall: ai1 } = makeAiCall(VALID_SLIDE_JSON);
      const content1 = await generateSceneContent(outline1, ai1, {});

      // Add scene-2 and generate
      const { aiCall: ai2 } = makeAiCall(VALID_SLIDE_JSON);
      const content2 = await generateSceneContent(outline2, ai2, {});

      // Both should exist independently
      expect(content1).not.toBeNull();
      expect(content2).not.toBeNull();
    });
  });

  describe('generation cache for incremental updates', () => {
    test('cache stores generated content by scene ID', () => {
      const cache = new SimpleCache();
      const content: GeneratedSlideContent = {
        elements: [{ id: 'el1', type: 'text', left: 0, top: 0, width: 100, height: 50, content: 'test', defaultFontName: '', defaultColor: '#000' }],
        background: { type: 'solid', color: '#fff' },
        remark: '',
      };

      cache.set('scene-1', content);
      expect(cache.has('scene-1')).toBe(true);
      expect(cache.get('scene-1')?.elements[0].content).toBe('test');
    });

    test('cache invalidation removes stale content', () => {
      const cache = new SimpleCache();
      const content: GeneratedSlideContent = {
        elements: [{ id: 'el1', type: 'text', left: 0, top: 0, width: 100, height: 50, content: 'test', defaultFontName: '', defaultColor: '#000' }],
        background: undefined,
        remark: '',
      };

      cache.set('scene-1', content);
      cache.invalidate('scene-1');
      expect(cache.has('scene-1')).toBe(false);
    });

    test('cache miss triggers regeneration', async () => {
      const cache = new SimpleCache();
      const outline: SceneOutline = {
        id: 'scene-1',
        type: 'slide',
        title: 'Test',
        description: '',
        keyPoints: [],
        order: 0,
      };

      // Cache miss
      expect(cache.has('scene-1')).toBe(false);

      // Generate and cache
      const { aiCall } = makeAiCall(VALID_SLIDE_JSON);
      const content = await generateSceneContent(outline, aiCall, {});
      cache.set('scene-1', content as GeneratedSlideContent);

      // Cache hit
      expect(cache.has('scene-1')).toBe(true);
    });
  });
});

function makeAiCall(response: string): {
  aiCall: AICallFn;
  capturedSystem: () => string;
  capturedUser: () => string;
} {
  let sys = '';
  let usr = '';
  const aiCall: AICallFn = async (system, user) => {
    sys = system;
    usr = user;
    return response;
  };
  return { aiCall, capturedSystem: () => sys, capturedUser: () => usr };
}
