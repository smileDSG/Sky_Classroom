import { describe, test, expect } from 'vitest';
import { buildSolverPrompt } from '@/lib/solve/solver-prompts';

describe('buildSolverPrompt', () => {
  test('returns prompt for universal agent', () => {
    const prompt = buildSolverPrompt('universal', '解方程: 2x + 3 = 7');
    expect(prompt).toContain('解题');
    expect(prompt).toContain('2x + 3 = 7');
  });

  test('returns prompt for science agent', () => {
    const prompt = buildSolverPrompt('science', '计算物体自由落体时间');
    expect(prompt).toContain('理科');
    expect(prompt).toContain('自由落体');
  });

  test('returns prompt for humanities agent', () => {
    const prompt = buildSolverPrompt('humanities', '分析《红楼梦》的主题思想');
    expect(prompt).toContain('文科');
    expect(prompt).toContain('红楼梦');
  });

  test('includes image context when problemImage is provided', () => {
    const prompt = buildSolverPrompt(
      'universal',
      '这道题是什么？',
      'data:image/png;base64,abc123',
    );
    expect(prompt).toContain('图片');
  });

  test('includes user answer for grade mode', () => {
    const prompt = buildSolverPrompt(
      'grading',
      '2+2=?',
      undefined,
      '4',
    );
    expect(prompt).toContain('4');
    expect(prompt).toContain('批改');
  });

  test('includes knowledge points context when provided', () => {
    const prompt = buildSolverPrompt(
      'universal',
      '求导: f(x) = x^2',
      undefined,
      undefined,
      ['微积分', '导数'],
    );
    expect(prompt).toContain('微积分');
  });
});
