import { describe, expect, it } from 'vitest';
import {
  buildQuizUserPrompt,
  restoreConsumedLatexEscapes,
} from '@/lib/agents/cloud-mind/quiz-agent';

describe('cloud mind quiz agent prompt', () => {
  it('grounds generated questions in the requested topic', () => {
    const prompt = buildQuizUserPrompt({
      subjectLabel: '数学',
      difficultyLabel: '进阶',
      topic: '二次函数顶点式',
      count: 6,
    });

    expect(prompt).toContain('围绕“二次函数顶点式”知识点');
    expect(prompt).toContain('- 指定主题/知识点：二次函数顶点式');
    expect(prompt).toContain('- 数量：6道');
    expect(prompt).toContain('- 难度：进阶');
    expect(prompt).toContain('每一道题都必须围绕“二次函数顶点式”');
    expect(prompt).toContain('不要生成与“二次函数顶点式”无关');
    expect(prompt).toContain('JSON 顶层 topic 字段必须写为“二次函数顶点式”');
    expect(prompt).toContain('LaTeX 反斜杠必须写成双反斜杠');
    expect(prompt).toContain('$\\\\triangle ABC$');
    expect(prompt).not.toContain('{count}');
    expect(prompt).not.toContain('{difficultyLabel}');
  });

  it('requires a focused core topic even when no topic is provided', () => {
    const prompt = buildQuizUserPrompt({
      subjectLabel: '物理',
      difficultyLabel: '基础',
      topic: '',
      count: 3,
    });

    expect(prompt).toContain('生成3道基础难度的选择题');
    expect(prompt).toContain('请先为本次测验选定一个清晰的核心考点');
    expect(prompt).toContain('所有题目围绕该考点展开');
  });

  it('repairs LaTeX commands whose backslashes were consumed by JSON escaping', () => {
    const repaired = restoreConsumedLatexEscapes(
      '在 riangleABC 中，angleA=50 circ，angleB=60 circ，则 angleC 的度数为多少？',
    );

    expect(repaired).toContain('\\triangle ABC');
    expect(repaired).toContain('\\angle A=50^\\circ');
    expect(repaired).toContain('\\angle B=60^\\circ');
    expect(repaired).toContain('\\angle C');
    expect(repaired).not.toContain('riangleABC');
  });
});
