import { describe, test, expect } from 'vitest';
import { buildSolverPrompt } from '@/lib/solve/solver-prompts';
import type { ProblemSpec } from '@/lib/solve/types';

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
      undefined,
      '2+2=4',
    );
    expect(prompt).toContain('4');
    expect(prompt).toContain('批改');
    expect(prompt).toContain('2+2=4');
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

  test('non-grading agents do not include user answer fields', () => {
    const prompt = buildSolverPrompt('universal', 'test', 'img.png', 'wrong');
    expect(prompt).not.toContain('用户答案');
    expect(prompt).not.toContain('标准答案');
  });

  test('grading mode uses standardAnswer parameter', () => {
    const prompt = buildSolverPrompt(
      'grading',
      '2+2=?',
      undefined,
      '5',
      undefined,
      '等于4',
    );
    expect(prompt).toContain('等于4');
    expect(prompt).toContain('5');
  });

  test('grading without standardAnswer shows 未提供', () => {
    const prompt = buildSolverPrompt(
      'grading',
      '2+2=?',
      undefined,
      '5',
    );
    expect(prompt).toContain('标准答案：未提供');
  });

  test('empty knowledge points array does not add context', () => {
    const prompt = buildSolverPrompt(
      'universal',
      'test',
      undefined,
      undefined,
      [],
    );
    expect(prompt).not.toContain('附加信息');
  });

  test('grounds the solver with structured recognition context', () => {
    const problemSpec: ProblemSpec = {
      id: 'p1',
      stage: '高中',
      subject: '物理',
      questionType: '选择题',
      stem: '小球从斜面顶端静止释放',
      options: [{ key: 'A', content: '2 m/s' }],
      givens: [{ name: '高度', symbol: 'h', value: '5', unit: 'm' }],
      asks: ['求末速度'],
      formulas: ['v^2=2gh'],
      diagram: { type: '斜面图', description: '小球沿斜面下滑', labels: ['A', 'B'], relations: ['A高于B'] },
      ambiguities: [{ field: 'g', candidates: ['9.8', '10'], reason: '题图不清晰' }],
      materials: [],
      subQuestions: [],
      confidence: 0.88,
    };

    const prompt = buildSolverPrompt('science', problemSpec.stem, 'data:image/png;base64,abc', undefined, undefined, undefined, undefined, problemSpec);

    for (const expected of ['高中', '物理', '选择题', '小球从斜面顶端静止释放', 'A: 2 m/s', '高度(h)=5 m', '求末速度', 'v^2=2gh', '斜面图', '题图不清晰']) {
      expect(prompt).toContain(expected);
    }
    expect(prompt).toContain('原始题图优先');
  });

});
