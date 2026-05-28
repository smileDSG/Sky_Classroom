import { describe, it, expect } from 'vitest';
import { getSubjectContext } from '@/lib/slides/agent/page-type-selector';

describe('PageTypeSelector', () => {
  it('infers math from 勾股定理', () => {
    const ctx = getSubjectContext('勾股定理');
    expect(ctx.subject).toBe('math');
    expect(ctx.pageTypes).toContain('formula');
    expect(ctx.pageTypes).not.toContain('timeline');
    expect(ctx.pageTypes).not.toContain('quiz');
  });

  it('infers physics from 牛顿定律', () => {
    const ctx = getSubjectContext('牛顿定律');
    expect(ctx.subject).toBe('physics');
  });

  it('infers biology from 蒸腾作用', () => {
    const ctx = getSubjectContext('蒸腾作用');
    expect(ctx.subject).toBe('biology');
    expect(ctx.pageTypes).toContain('concept');
    expect(ctx.pageTypes).toContain('compare');
    expect(ctx.pageTypes).not.toContain('formula');
    expect(ctx.pageTypes).not.toContain('quiz');
  });

  it('infers literature from 项脊轩志', () => {
    const ctx = getSubjectContext('项脊轩志');
    expect(ctx.subject).toBe('literature');
    expect(ctx.pageTypes).not.toContain('formula');
  });

  it('infers cs from SpringCloud', () => {
    const ctx = getSubjectContext('SpringCloud微服务');
    expect(ctx.subject).toBe('cs');
    expect(ctx.pageTypes).toContain('process');
    expect(ctx.pageTypes).toContain('table');
  });

  it('infers cs from 消息队列', () => {
    const ctx = getSubjectContext('消息队列');
    expect(ctx.subject).toBe('cs');
  });

  it('falls back to general for unknown topics', () => {
    const ctx = getSubjectContext('如何做好时间管理');
    expect(ctx.subject).toBe('general');
    expect(ctx.pageTypes.length).toBeGreaterThan(5);
  });

  it('always includes core structural pages', () => {
    for (const topic of ['勾股定理', '蒸腾作用', '项脊轩志', '未知主题']) {
      const ctx = getSubjectContext(topic);
      expect(ctx.pageTypes).toContain('cover');
      expect(ctx.pageTypes).toContain('toc');
      expect(ctx.pageTypes).toContain('end');
      expect(ctx.pageTypes).toContain('chapter');
      expect(ctx.pageTypes).toContain('summary');
    }
  });

  it('returns a non-empty preference string', () => {
    const ctx = getSubjectContext('蒸腾作用');
    expect(ctx.preference.length).toBeGreaterThan(5);
  });
});
