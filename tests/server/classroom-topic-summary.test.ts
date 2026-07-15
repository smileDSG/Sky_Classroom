import { describe, expect, test } from 'vitest';
import { generateTopicSummary } from '@/lib/server/classroom-generation';
import type { SceneOutline } from '@/lib/types/generation';

function outline(title: string): SceneOutline {
  return {
    id: title,
    title,
    type: 'slide',
    order: 1,
    description: '',
    keyPoints: [],
  } as SceneOutline;
}

describe('generateTopicSummary', () => {
  test('uses the first outline title without calling an LLM', () => {
    const summary = generateTopicSummary('请生成一节关于二次函数的互动课', [
      outline('二次函数的图像与性质'),
    ]);

    expect(summary).toBe('二次函数的图像与性质');
  });

  test('falls back to a compact requirement when outlines are empty', () => {
    const summary = generateTopicSummary('  生成一个 Redis 数据结构入门课程，包含练习和总结  ', []);

    expect(summary).toBe('生成一个 Redis 数据结构入门课程，包含练习和总结');
  });
});
