import { describe, test, expect } from 'vitest';
import { buildSolverPrompt } from '@/lib/solve/solver-prompts';

/**
 * 验证解题步骤质量强约束已注入每个 solver 分支，
 * 且 JSON schema 示例带 type/summary 字段（步骤模型扩展的配套）。
 */
describe('buildSolverPrompt 步骤质量约束', () => {
  const types = ['universal', 'science', 'humanities'] as const;

  test('每个 solver 分支都包含步骤质量强约束块', () => {
    for (const t of types) {
      const prompt = buildSolverPrompt(t, '题目文本');
      expect(prompt, `${t} 缺少步骤质量约束`).toContain('【步骤质量 — 强制】');
      expect(prompt, `${t} 缺少空步骤约束`).toContain('严禁空步骤');
    }
  });

  test('每个分支 JSON schema 示例带 type 与 summary 字段', () => {
    for (const t of types) {
      const prompt = buildSolverPrompt(t, '题目文本');
      expect(prompt, `${t} 缺 type 字段`).toContain('"type":"idea"');
      expect(prompt, `${t} 缺 summary 字段`).toContain('"summary":"明确已知与所求"');
    }
  });

  test('质量约束要求步骤量级（选择 2-4、解答 3-8）', () => {
    const prompt = buildSolverPrompt('science', '题目文本');
    expect(prompt).toContain('选择题 2-4 步');
    expect(prompt).toContain('3-8 步');
  });

  test('grading 分支不受步骤质量约束影响', () => {
    const prompt = buildSolverPrompt('grading', '题目文本');
    expect(prompt).not.toContain('【步骤质量 — 强制】');
  });
});
