import { describe, it, expect } from 'vitest';
import { CONTENT_SCHEMAS, autoFixContent, SCHEMA_DESCRIPTIONS } from '@/lib/slides/agent/content-schemas';

describe('Content Schemas', () => {
  describe('Schema Registry', () => {
    it('has schemas for all core page types', () => {
      const required = ['cover', 'toc', 'end', 'chapter', 'concept', 'case', 'compare', 'process', 'table', 'formula', 'timeline', 'summary', 'quiz'];
      for (const t of required) {
        expect(CONTENT_SCHEMAS[t], `Missing schema for ${t}`).toBeDefined();
      }
    });

    it('has descriptions for all page types', () => {
      for (const key of Object.keys(CONTENT_SCHEMAS)) {
        if (key === 'content') continue; // generic fallback
        expect(SCHEMA_DESCRIPTIONS[key], `Missing description for ${key}`).toBeDefined();
      }
    });
  });

  describe('Individual Schemas', () => {
    it('validates valid concept content', () => {
      const content = { title: '电路三要素', cards: [{ title: '电流', desc: '电荷定向移动形成的物理量，单位安培' }, { title: '电压', desc: '电路两点间的电势差，单位伏特' }], summary: '核心要点总结' };
      const result = CONTENT_SCHEMAS.concept!.safeParse(content);
      expect(result.success).toBe(true);
    });

    it('validates valid case content', () => {
      const content = { title: '欧姆定律例题', scenarios: [{ problem: '已知R=10Ω, I=2A, 求U', solution: 'U=IR=20V' }], highlight: '牢记公式' };
      const result = CONTENT_SCHEMAS.case!.safeParse(content);
      expect(result.success).toBe(true);
    });

    it('validates valid compare content', () => {
      const content = { title: '串联vs并联', left: { title: '串联', items: ['电流处处相等'] }, right: { title: '并联', items: ['电压处处相等'] }, conclusion: '两种电路各有特点' };
      const result = CONTENT_SCHEMAS.compare!.safeParse(content);
      expect(result.success).toBe(true);
    });

    it('validates valid end content', () => {
      const content = { slogan: '学以致用', subtitle: '探索数学的奥秘' };
      const result = CONTENT_SCHEMAS.end!.safeParse(content);
      expect(result.success).toBe(true);
    });

    it('rejects oversize title', () => {
      const content = { title: '这是一个超级超级超级超级超级长的标题', cards: [{ title: 't', desc: 'd' }], summary: 's' };
      const result = CONTENT_SCHEMAS.concept!.safeParse(content);
      expect(result.success).toBe(false);
    });

    it('rejects empty cards array', () => {
      const content = { title: 'test', cards: [], summary: 's' };
      const result = CONTENT_SCHEMAS.concept!.safeParse(content);
      expect(result.success).toBe(false);
    });
  });

  describe('autoFixContent', () => {
    it('truncates oversize title', () => {
      const content = { title: '超过十五字的超长标题测试一下看看', cards: [{ title: 't', desc: 'd' }], summary: 's' };
      const fixed = autoFixContent('concept', content);
      expect((fixed.title as string).length).toBeLessThanOrEqual(15);
    });

    it('caps cards array at 6', () => {
      const cards = Array.from({ length: 10 }, (_, i) => ({ title: `c${i}`, desc: `d${i}` }));
      const fixed = autoFixContent('concept', { title: 't', cards, summary: 's' });
      expect((fixed.cards as unknown[]).length).toBe(6);
    });

    it('fills missing summary for concept', () => {
      const fixed = autoFixContent('concept', { title: 't', cards: [{ title: 'c', desc: 'd' }] });
      expect(fixed.summary).toBeTruthy();
    });

    it('fills missing slogan for end page', () => {
      const fixed = autoFixContent('end', { subtitle: 'sub' } as Record<string, unknown>);
      expect(fixed.slogan).toBe('谢谢');
    });

    it('preserves valid content unchanged', () => {
      const content = { title: 'test', cards: [{ title: 'c', desc: 'valid desc here yes' }], summary: 'good summary' };
      const fixed = autoFixContent('concept', content);
      expect(fixed).toEqual(content);
    });
  });
});
