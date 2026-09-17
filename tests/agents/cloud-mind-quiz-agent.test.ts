import { describe, expect, it } from 'vitest';
import {
  buildQuizUserPrompt,
  normalizeQuizOutput,
  restoreConsumedLatexEscapes,
} from '@/lib/agents/cloud-mind/quiz-agent';
import type { RawQuizOutput } from '@/lib/agents/cloud-mind/quiz-schema';

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

describe('cloud mind quiz agent multi-type prompts', () => {
  it('emits fill-type requirements when questionType is fill', () => {
    const prompt = buildQuizUserPrompt({
      subjectLabel: '数学',
      difficultyLabel: '进阶',
      topic: '二次函数顶点式',
      count: 3,
      questionType: 'fill',
    });

    expect(prompt).toContain('生成3道进阶难度的填空题');
    expect(prompt).toContain('填空题：题干中留空的位置使用 ____ 或 ( ) 表示');
    expect(prompt).toContain('"type" 字段必须为 "fill"');
  });

  it('emits judge-type requirements when questionType is judge', () => {
    const prompt = buildQuizUserPrompt({
      subjectLabel: '数学',
      difficultyLabel: '基础',
      topic: '质数',
      count: 2,
      questionType: 'judge',
    });

    expect(prompt).toContain('生成2道基础难度的判断题');
    expect(prompt).toContain('answer 只能是 "正确" 或 "错误" 两个值之一');
    expect(prompt).toContain('"type" 字段必须为 "judge"');
  });
});

describe('cloud mind quiz agent multi-type normalization', () => {
  it('normalizes a fill question into the fill shape', () => {
    const raw: RawQuizOutput = {
      subject: '生物',
      topic: '光合作用',
      difficulty: 'medium',
      questions: [
        {
          id: 1,
          type: 'fill',
          question: '光合作用的场所是 ____。',
          answer: '叶绿体',
          explanation: '叶绿体是光合作用进行的场所。',
        },
      ],
    };

    const out = normalizeQuizOutput(raw, 1);
    expect(out.questions[0]).toMatchObject({
      questionType: 'fill',
      question: '光合作用的场所是 ____。',
      options: [],
      answer: 0,
      answerText: '叶绿体',
    });
  });

  it('throws when a fill question misses its standard answer', () => {
    const raw: RawQuizOutput = {
      subject: '数学',
      topic: '勾股定理',
      difficulty: 'easy',
      questions: [
        {
          id: 1,
          type: 'fill',
          question: '直角三角形的两条直角边为 3 和 4，斜边为 ____。',
          answer: '',
          explanation: '解析',
        },
      ],
    };

    expect(() => normalizeQuizOutput(raw, 1)).toThrow(/Invalid fill question/);
  });

  it('normalizes judge answers into 正确/错误 options', () => {
    const raw: RawQuizOutput = {
      subject: '物理',
      topic: '牛顿第一定律',
      difficulty: 'easy',
      questions: [
        {
          id: 1,
          type: 'judge',
          question: '力是维持物体运动的原因。',
          answer: '错误',
          explanation: '解析',
        },
        {
          id: 2,
          type: 'judge',
          question: '质量是物体的固有属性。',
          answer: '正确',
          explanation: '解析',
        },
      ],
    };

    const out = normalizeQuizOutput(raw, 2);
    expect(out.questions[0]).toMatchObject({
      questionType: 'judge',
      options: ['正确', '错误'],
      answer: 1,
      answerText: '错误',
    });
    expect(out.questions[1].answer).toBe(0);
    expect(out.questions[1].answerText).toBe('正确');
  });

  it('throws on an ambiguous judge answer', () => {
    const raw: RawQuizOutput = {
      subject: '化学',
      topic: '氧化还原',
      difficulty: 'easy',
      questions: [
        {
          id: 1,
          type: 'judge',
          question: '氧化反应一定伴随还原反应。',
          answer: '不确定',
          explanation: '解析',
        },
      ],
    };

    expect(() => normalizeQuizOutput(raw, 1)).toThrow(/Invalid judge answer/);
  });

  it('normalizes a choice question and derives answerText from the option', () => {
    const raw: RawQuizOutput = {
      subject: '数学',
      topic: '二次函数顶点式',
      difficulty: 'medium',
      questions: [
        {
          id: 1,
          type: 'choice',
          question: '$y=(x-2)^2+3$ 的顶点是？',
          options: ['(2, 3)', '(3, 2)', '(-2, 3)', '(2, -3)'],
          answer: 0,
          explanation: '顶点式 $y=a(x-h)^2+k$ 的顶点为 $(h, k)$。',
        },
      ],
    };

    const out = normalizeQuizOutput(raw, 1);
    expect(out.questions[0]).toMatchObject({
      questionType: 'choice',
      options: ['(2, 3)', '(3, 2)', '(-2, 3)', '(2, -3)'],
      answer: 0,
      answerText: '(2, 3)',
    });
  });
});
