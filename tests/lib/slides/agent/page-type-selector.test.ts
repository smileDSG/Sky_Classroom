import { describe, test, expect } from 'vitest';
import { getSubjectContext, buildPageTypeList } from '@/lib/slides/agent/page-type-selector';

describe('getSubjectContext', () => {
  test('detects biology from 光合作用', () => {
    const ctx = getSubjectContext('光合作用的过程');
    expect(ctx.subject).toBe('biology');
    expect(ctx.pageTypes).toContain('concept');
    expect(ctx.pageTypes).toContain('compare');
    expect(ctx.pageTypes).toContain('table');
  });

  test('detects chemistry from 化学反应', () => {
    const ctx = getSubjectContext('酸碱中和反应');
    expect(ctx.subject).toBe('chemistry');
    expect(ctx.pageTypes).toContain('formula');
    expect(ctx.pageTypes).toContain('table');
  });

  test('detects physics from 牛顿力学', () => {
    const ctx = getSubjectContext('牛顿三大定律');
    expect(ctx.subject).toBe('physics');
    expect(ctx.pageTypes).toContain('formula');
    expect(ctx.pageTypes).toContain('compare');
  });

  test('detects math from 函数', () => {
    const ctx = getSubjectContext('二次函数图像');
    expect(ctx.subject).toBe('math');
    expect(ctx.pageTypes).toContain('formula');
    expect(ctx.pageTypes).toContain('case');
  });

  test('falls back to general for unknown topic', () => {
    const ctx = getSubjectContext('如何煮一碗完美的泡面');
    expect(ctx.subject).toBe('general');
    expect(ctx.pageTypes).toContain('concept');
    expect(ctx.pageTypes).toContain('case');
  });

  test('biology preference mentions concept > compare > process', () => {
    const ctx = getSubjectContext('细胞结构');
    expect(ctx.preference).toContain('concept');
    expect(ctx.preference).toContain('compare');
  });

  test('chemistry preference mentions formula and table', () => {
    const ctx = getSubjectContext('氧化还原反应');
    expect(ctx.preference).toContain('formula');
    expect(ctx.preference).toContain('table');
  });
});

describe('buildPageTypeList', () => {
  test('formats page types with labels', () => {
    const list = buildPageTypeList(['cover', 'concept', 'formula']);
    expect(list).toContain('cover: 封面');
    expect(list).toContain('concept: 概念讲解');
    expect(list).toContain('formula: 公式推导');
  });

  test('handles unknown page types gracefully', () => {
    const list = buildPageTypeList(['cover', 'unknown_type']);
    expect(list).toContain('cover: 封面');
    expect(list).toContain('unknown_type: unknown_type');
  });
});
