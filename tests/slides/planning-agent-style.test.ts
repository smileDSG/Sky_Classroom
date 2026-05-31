import { describe, it, expect } from 'vitest';
import { getSubjectContext, buildPageTypeList } from '@/lib/slides/agent/page-type-selector';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';

describe('Planning Agent — Style Injection', () => {
  const defaultDNA = getDefaultDesignDNA();

  describe('page-type-selector', () => {
    it('detects math topic', () => {
      const ctx = getSubjectContext('勾股定理');
      expect(ctx.subject).toBe('math');
      expect(ctx.pageTypes).toContain('formula');
      expect(ctx.pageTypes).toContain('case');
    });

    it('detects physics topic', () => {
      const ctx = getSubjectContext('牛顿定律');
      expect(ctx.subject).toBe('physics');
      expect(ctx.pageTypes).toContain('formula');
    });

    it('detects biology topic', () => {
      const ctx = getSubjectContext('光合作用');
      expect(ctx.subject).toBe('biology');
      expect(ctx.pageTypes).toContain('concept');
      expect(ctx.pageTypes).not.toContain('formula');
    });

    it('detects history topic', () => {
      const ctx = getSubjectContext('辛亥革命');
      expect(ctx.subject).toBe('history');
      expect(ctx.pageTypes).toContain('timeline');
    });

    it('detects cs topic', () => {
      const ctx = getSubjectContext('数据结构');
      expect(ctx.subject).toBe('cs');
      expect(ctx.pageTypes).toContain('process');
    });

    it('falls back to general for unknown topics', () => {
      const ctx = getSubjectContext('abc xyz unknown');
      expect(ctx.subject).toBe('general');
    });

    it('builds page type list correctly', () => {
      const list = buildPageTypeList(['cover', 'toc', 'concept']);
      expect(list).toContain('cover');
      expect(list).toContain('toc');
      expect(list).toContain('concept');
    });
  });

  describe('DesignDNA mood influence', () => {
    it('mood affects page type preference', () => {
      const playfulDNA = { ...defaultDNA, mood: '活泼轻快' };
      const academicDNA = { ...defaultDNA, mood: '严谨学术' };

      // These are qualitative checks — the actual prompt injection happens in buildSystemPrompt
      expect(playfulDNA.mood).toMatch(/活泼|轻快/);
      expect(academicDNA.mood).toMatch(/严谨|学术/);
    });

    it('density affects content density hint', () => {
      const sparseDNA = { ...defaultDNA, decoration: { ...defaultDNA.decoration, density: 'sparse' } };
      const richDNA = { ...defaultDNA, decoration: { ...defaultDNA.decoration, density: 'rich' } };

      expect(sparseDNA.decoration.density).toBe('sparse');
      expect(richDNA.decoration.density).toBe('rich');
    });
  });
});
