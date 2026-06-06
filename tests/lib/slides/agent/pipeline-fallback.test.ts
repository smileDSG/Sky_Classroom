import { describe, test, expect } from 'vitest';
import { buildFallbackContent } from '@/lib/slides/agent/pipeline';

describe('buildFallbackContent — still exists for direct callers', () => {
  test('builds cover fallback', () => {
    const result = buildFallbackContent('cover', '光合作用', { focus: '探索光能到化学能', keyConcepts: [] });
    expect(result.title).toBe('光合作用');
    expect(result.subtitle).toBe('探索光能到化学能');
  });

  test('builds end fallback', () => {
    const result = buildFallbackContent('end', '', { focus: '谢谢观看', notes: '本章结束' });
    expect(result.slogan).toBe('谢谢观看');
    expect(result.subtitle).toBe('本章结束');
  });

  test('builds concept fallback with cards', () => {
    const result = buildFallbackContent('concept', '核心概念', {
      focus: '光合作用本质',
      keyConcepts: ['光反应', '暗反应', '卡尔文循环'],
    });
    expect(result.title).toBe('核心概念');
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].title).toBe('光反应');
  });

  test('builds formula fallback with mainFormula', () => {
    const result = buildFallbackContent('formula', '总反应式', {
      focus: '6CO2 + 6H2O -> C6H12O6 + 6O2',
      keyConcepts: [],
    });
    expect(result.title).toBe('总反应式');
    expect(result.mainFormula).toBe('6CO2 + 6H2O -> C6H12O6 + 6O2');
  });
});
