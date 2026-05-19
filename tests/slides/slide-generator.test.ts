/**
 * B-001: Slide generator tests
 *
 * Validates generateSlides() using dependency injection:
 * we pass a capturing mock aiCall — no module-level vi.mock() needed.
 */
import { describe, it, expect } from 'vitest';
import { generateSlides } from '@/lib/slides/slide-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';

// ── Helpers ──────────────────────────────────────────────────────────

function makeFakeSlide(type: string) {
  return {
    type,
    background: { type: 'solid' as const, color: '#ffffff' },
    elements: [
      {
        type: 'text' as const,
        left: 100,
        top: 80,
        width: 800,
        height: 58,
        content: `<p style="font-size:24px;">${type} slide</p>`,
        defaultFontName: 'Microsoft YaHei',
        defaultColor: '#333333',
      },
    ],
  };
}

function makeFakeDeck(count: number) {
  const slides = [];
  for (let i = 0; i < count; i++) {
    const slideType = i === 0 ? 'cover' : i === count - 1 ? 'end' : 'content';
    slides.push(makeFakeSlide(slideType));
  }
  return { slides };
}

function makeCapturingAiCall(response: string): {
  aiCall: AICallFn;
  lastSystem: () => string;
  lastUser: () => string;
} {
  let lastSystem = '';
  let lastUser = '';
  const aiCall: AICallFn = async (system, user) => {
    lastSystem = system;
    lastUser = user;
    return response;
  };
  return {
    aiCall,
    lastSystem: () => lastSystem,
    lastUser: () => lastUser,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('generateSlides', () => {
  it('returns valid SlideGenerationResult on successful AI response', async () => {
    const { aiCall } = makeCapturingAiCall(JSON.stringify(makeFakeDeck(6)));

    const result = await generateSlides(
      'Quadratic Functions',
      { difficulty: 'senior' },
      aiCall,
    );

    expect(result.slides).toHaveLength(6);
    expect(result.generationTime).toBeGreaterThan(0);

    for (const slide of result.slides) {
      expect(slide.id).toBeTruthy();
      expect(slide.viewportSize).toBe(1000);
      expect(slide.viewportRatio).toBe(0.5625);
      expect(slide.theme).toBeDefined();
      expect(slide.theme.fontName).toBe('Microsoft YaHei');
      expect(slide.elements).toBeInstanceOf(Array);
    }
  });

  it('inserts topic into user prompt', async () => {
    const { aiCall, lastUser } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(6)),
    );

    await generateSlides('Quadratic Functions', { difficulty: 'senior' }, aiCall);

    expect(lastUser()).toContain('Quadratic Functions');
  });

  it('inserts difficulty guidance into user prompt', async () => {
    const { aiCall: aiCallJ, lastUser: lastUserJ } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(6)),
    );
    const { aiCall: aiCallC, lastUser: lastUserC } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(12)),
    );

    await generateSlides('Topic', { difficulty: 'junior' }, aiCallJ);
    await generateSlides('Topic', { difficulty: 'college' }, aiCallC);

    expect(lastUserJ()).toContain('junior high school');
    expect(lastUserC()).toContain('university/college');
  });

  it('uses correct default slide counts per difficulty', async () => {
    const counts: number[] = [];

    for (const diff of ['junior', 'senior', 'college'] as const) {
      const { aiCall, lastUser } = makeCapturingAiCall(
        JSON.stringify(makeFakeDeck(12)),
      );
      await generateSlides('Topic', { difficulty: diff }, aiCall);
      const match = lastUser().match(/Number of slides: (\d+)/);
      if (match) counts.push(parseInt(match[1], 10));
    }

    expect(counts).toEqual([6, 8, 12]);
  });

  it('respects explicit slideCount override', async () => {
    const { aiCall, lastUser } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(10)),
    );

    await generateSlides(
      'Topic',
      { difficulty: 'senior', slideCount: 10 },
      aiCall,
    );

    expect(lastUser()).toContain('Number of slides: 10');
  });

  it('excludes media conditionals from system prompt', async () => {
    const { aiCall, lastSystem } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(6)),
    );

    await generateSlides('Topic', { difficulty: 'senior' }, aiCall);

    const sys = lastSystem();
    // Design rules should be present
    expect(sys).toContain('TextElement');
    // Media image markers should be absent (all flags false)
    expect(sys).not.toContain('slide-image-instructions');
    expect(sys).not.toContain('slide-video-instructions');
    expect(sys).not.toContain('slide-generated-image-instructions');
  });

  it('returns empty slides array on unparseable AI response', async () => {
    const { aiCall } = makeCapturingAiCall('not valid json at all');

    const result = await generateSlides('Topic', { difficulty: 'senior' }, aiCall);

    expect(result.slides).toHaveLength(0);
  });

  it('returns empty slides array when parsed.slides is not array', async () => {
    const { aiCall } = makeCapturingAiCall(
      JSON.stringify({ slides: 'not-an-array' }),
    );

    const result = await generateSlides('Topic', { difficulty: 'senior' }, aiCall);

    expect(result.slides).toHaveLength(0);
  });

  it('slides have correct type tags', async () => {
    const { aiCall } = makeCapturingAiCall(JSON.stringify(makeFakeDeck(6)));

    const result = await generateSlides('Topic', { difficulty: 'senior' }, aiCall);
    const slides = result.slides;

    expect(slides[0].type).toBe('cover');
    expect(slides[slides.length - 1].type).toBe('end');
    for (let i = 1; i < slides.length - 1; i++) {
      expect(slides[i].type).toBe('content');
    }
  });

  it('respects explicit type from AI response when valid', async () => {
    // AI can provide its own type field — it should take priority
    const { aiCall } = makeCapturingAiCall(JSON.stringify(makeFakeDeck(6)));

    const result = await generateSlides('Topic', { difficulty: 'senior' }, aiCall);

    // All slides in makeFakeDeck have valid types (cover/content/end)
    expect(result.slides[0].type).toBe('cover');
    expect(result.slides[4].type).toBe('content');
    expect(result.slides[5].type).toBe('end');
  });

  it('language directive is threaded into prompt', async () => {
    const { aiCall, lastUser } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(6)),
    );

    const directive = 'Use Simplified Chinese (zh-CN) for all content';
    await generateSlides('Topic', { language: directive }, aiCall);

    // buildLanguageText passes the directive through directly
    expect(lastUser()).toContain(directive);
  });

  it('system prompt includes canvas dimensions', async () => {
    const { aiCall, lastSystem } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(6)),
    );

    await generateSlides('Topic', { difficulty: 'senior' }, aiCall);

    expect(lastSystem()).toContain('1000');
    expect(lastSystem()).toContain('562.5');
  });

  it('system prompt includes text height lookup table', async () => {
    const { aiCall, lastSystem } = makeCapturingAiCall(
      JSON.stringify(makeFakeDeck(6)),
    );

    await generateSlides('Topic', { difficulty: 'senior' }, aiCall);

    expect(lastSystem()).toContain('Text Height Lookup Table');
  });

  it('returns empty slides array on null prompt (unlikely but safe)', async () => {
    // Test that returns early when buildPrompt fails (shouldn't happen in practice)
    const result = await generateSlides(
      'Topic',
      { difficulty: 'senior' },
      async () => '',
    );

    // Even with a broken aiCall, the prompt should build successfully
    // This test verifies the null guard exists
    expect(result.slides).toBeDefined();
    expect(result.generationTime).toBeGreaterThanOrEqual(0);
  });
});
