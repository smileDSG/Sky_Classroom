/**
 * Slide repairer tests — degenerate page detection + LLM regeneration.
 * Dependency injection: aiCall is a capturing mock, prompts are real.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  repairDegenerateSlides,
  findDegenerateSlides,
  slideTextLength,
} from '@/lib/slides/slide-repairer';
import type { Slide, PPTTextElement } from '@/lib/types/slides';
import type { AICallFn } from '@/lib/generation/pipeline-types';

const RICH_TEXT =
  '这是一段足够长的正文内容，用于通过内容健康检测的阈值判定，包含定义、要点与示例。';

function textEl(content: string, overrides: Partial<PPTTextElement> = {}): PPTTextElement {
  return {
    id: `t_${Math.random().toString(36).slice(2, 8)}`,
    type: 'text',
    left: 60,
    top: 45,
    width: 600,
    height: 76,
    rotate: 0,
    content,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#333333',
    ...overrides,
  };
}

function slide(type: Slide['type'], elements: PPTTextElement[]): Slide {
  return {
    id: `s_${Math.random().toString(36).slice(2, 8)}`,
    viewportSize: 1000,
    viewportRatio: 0.5625,
    theme: {
      backgroundColor: '#ffffff',
      themeColors: ['#ffffff'],
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
    },
    elements,
    background: { type: 'solid', color: '#ffffff' },
    type,
  };
}

function healthyContentSlide(title: string): Slide {
  return slide('content', [
    textEl(`<p style="font-size:32px;">${title}</p>`),
    textEl(`<p style="font-size:16px;">${RICH_TEXT}</p>`, { top: 200 }),
  ]);
}

function degenerateContentSlide(title: string): Slide {
  return slide('content', [textEl(`<p style="font-size:32px;">${title}</p>`)]);
}

function repairResponse(title: string): string {
  return JSON.stringify({
    slides: [
      {
        type: 'content',
        background: { type: 'solid', color: '#E8F0E0' },
        elements: [
          {
            type: 'text',
            left: 60,
            top: 40,
            width: 880,
            height: 70,
            content: `<p style="font-size:32px;">${title}</p>`,
            defaultFontName: 'Microsoft YaHei',
            defaultColor: '#333333',
          },
          {
            type: 'text',
            left: 60,
            top: 140,
            width: 880,
            height: 120,
            content: `<p style="font-size:16px;">${RICH_TEXT}</p>`,
            defaultFontName: 'Microsoft YaHei',
            defaultColor: '#333333',
          },
        ],
      },
    ],
  });
}

describe('slideTextLength / findDegenerateSlides', () => {
  it('counts CJK chars and detects title-only content slides', () => {
    const healthy = healthyContentSlide('植物如何捕获光能');
    const broken = degenerateContentSlide('光反应 vs 暗反应对比');
    const cover = slide('cover', [textEl('光合作用与能量转化')]);

    expect(slideTextLength(healthy)).toBeGreaterThanOrEqual(30);
    expect(slideTextLength(broken)).toBeLessThan(30);
    expect(findDegenerateSlides([healthy, broken, cover])).toEqual([1]);
  });

  it('ignores empty pages that are cover or end type', () => {
    const end = slide('end', [textEl('谢谢')]);
    expect(findDegenerateSlides([end])).toEqual([]);
  });
});

describe('repairDegenerateSlides', () => {
  it('regenerates only the degenerate slide and keeps deck order', async () => {
    const aiCall = vi.fn(async () => repairResponse('光反应 vs 暗反应对比')) as unknown as AICallFn;
    const deck = [
      slide('cover', [textEl('光合作用')]),
      healthyContentSlide('植物如何捕获光能'),
      degenerateContentSlide('光反应 vs 暗反应对比'),
      slide('end', [textEl('核心结论回顾')]),
    ];

    const result = await repairDegenerateSlides('光合作用', 'senior', deck, aiCall);

    expect(result.repaired).toBe(1);
    expect(result.dropped).toBe(0);
    expect(result.slides).toHaveLength(4);
    expect(result.slides[2].type).toBe('content');
    expect(slideTextLength(result.slides[2])).toBeGreaterThanOrEqual(30);
    expect(aiCall).toHaveBeenCalledTimes(1);
  });

  it('passes the style directive into the system prompt and topic context into the user prompt', async () => {
    let capturedSystem = '';
    let capturedUser = '';
    const aiCall = vi.fn(async (system: string, user: string) => {
      capturedSystem = system;
      capturedUser = user;
      return repairResponse('对比');
    }) as unknown as AICallFn;
    const deck = [degenerateContentSlide('光反应 vs 暗反应对比')];

    await repairDegenerateSlides('光合作用', 'senior', deck, aiCall, {
      stylePrompt: 'Preferred palette: cover #2C5F2D, accent #97BC62.',
    });

    expect(capturedSystem).toContain('Preferred palette: cover #2C5F2D');
    expect(capturedUser).toContain('REGENERATE THIS ONE');
    expect(capturedUser).toContain('光反应 vs 暗反应对比');
    expect(capturedUser).toContain('Senior High');
  });

  it('retries and then drops a slide that stays degenerate', async () => {
    const aiCall = vi.fn(async () => repairResponse('还是空的')) as unknown as AICallFn;
    // Response body text is rich... make it degenerate instead by returning empty elements
    (aiCall as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      JSON.stringify({ slides: [{ type: 'content', elements: [] }] }),
    );
    const deck = [degenerateContentSlide('空页面')];

    const result = await repairDegenerateSlides('光合作用', 'senior', deck, aiCall, {
      maxAttempts: 2,
    });

    expect(result.repaired).toBe(0);
    expect(result.dropped).toBe(1);
    expect(result.slides).toHaveLength(0);
    expect(aiCall).toHaveBeenCalledTimes(2);
  });

  it('does not call the LLM for a healthy deck', async () => {
    const aiCall = vi.fn() as unknown as AICallFn;
    const deck = [
      slide('cover', [textEl('光合作用')]),
      healthyContentSlide('概念讲解'),
      slide('end', [textEl('总结')]),
    ];

    const result = await repairDegenerateSlides('光合作用', 'senior', deck, aiCall);

    expect(result).toEqual({ slides: deck, repaired: 0, dropped: 0 });
    expect(aiCall).not.toHaveBeenCalled();
  });

  it('respects maxRepairs when many slides are degenerate', async () => {
    const aiCall = vi.fn(async () =>
      JSON.stringify({ slides: [{ type: 'content', elements: [] }] }),
    ) as unknown as AICallFn;
    const deck = [
      degenerateContentSlide('第一页'),
      degenerateContentSlide('第二页'),
      degenerateContentSlide('第三页'),
      degenerateContentSlide('第四页'),
      degenerateContentSlide('第五页'),
    ];

    const result = await repairDegenerateSlides('光合作用', 'senior', deck, aiCall, {
      maxRepairs: 2,
      maxAttempts: 1,
    });

    expect(aiCall).toHaveBeenCalledTimes(2);
    expect(result.dropped).toBe(2);
    expect(result.slides).toHaveLength(3);
  });

  it('treats a thrown aiCall error as a failed attempt and drops the slide', async () => {
    const aiCall = vi.fn(async () => {
      throw new Error('provider down');
    }) as unknown as AICallFn;
    const deck = [degenerateContentSlide('会失败的页面')];

    const result = await repairDegenerateSlides('光合作用', 'senior', deck, aiCall, {
      maxAttempts: 1,
    });

    expect(result.dropped).toBe(1);
    expect(result.repaired).toBe(0);
    expect(result.slides).toHaveLength(0);
  });
});
