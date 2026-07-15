import { describe, it, expect } from 'vitest';
import { postProcessMathContent, postProcessFourPartOutput } from '@/lib/solve/math-postprocessor';
import type { FourPartOutput } from '@/lib/solve/types';

describe('postProcessMathContent', () => {
  it('normalizes double backslashes', () => {
    // JSON escaping produces \\\\frac; normalize to \\frac
    expect(postProcessMathContent('\\\\frac{1}{2}')).toBe('\\frac{1}{2}');
  });

  it('normalizes Unicode superscripts', () => {
    expect(postProcessMathContent('A²')).toContain('^2');
  });

  it('converts Unicode math symbols to LaTeX', () => {
    const result = postProcessMathContent('α × β ÷ γ ≤ δ ≥ ε ≠ ζ ≈ η');
    expect(result).toContain('\\alpha');
    expect(result).toContain('\\times');
    expect(result).toContain('\\div');
    expect(result).toContain('\\gamma');
    expect(result).toContain('\\leq');
    expect(result).toContain('\\geq');
    expect(result).toContain('\\neq');
    expect(result).toContain('\\approx');
  });

  it('does not modify already-wrapped math', () => {
    expect(postProcessMathContent('$x=5$')).toBe('$x=5$');
  });

  it('preserves block math $$...$$', () => {
    const input = '$$\\frac{1}{2}kA^2$$';
    expect(postProcessMathContent(input)).toBe(input);
  });

  it('processes mixed Chinese text with math', () => {
    const result = postProcessMathContent('将振幅减小为原来的一半，α = A²');
    expect(result).toContain('\\alpha');
    expect(result).toContain('^2');
  });
});

describe('postProcessFourPartOutput', () => {
  const mockOutput: FourPartOutput = {
    solution: '解：α = A²，所以 β = γ × δ',
    answer: "α = A²",
    steps: [
      {
        label: '步骤1',
        content: "α = A²，然后 β = γ × δ",
        keyPoints: ['注意 α 变化，β²'],
      },
    ],
    knowledgePoints: [
      {
        name: 'α² = β',
        description: 'α² = β，γ = δ × ε',
        difficulty: 'easy',
      },
    ],
    similarQuestions: [
      {
        problem: 'α = A²，β = γ × δ',
        difficulty: 3,
        knowledgePoint: 'α²',
      },
    ],
  };

  it('processes answer field', () => {
    const result = postProcessFourPartOutput(mockOutput);
    expect(result.answer).toContain('\\alpha');
    expect(result.answer).toContain('^2');
  });

  it('processes step content', () => {
    const result = postProcessFourPartOutput(mockOutput);
    expect(result.steps[0]?.content).toContain('\\alpha');
    expect(result.steps[0]?.content).toContain('\\times');
  });

  it('processes keyPoints', () => {
    const result = postProcessFourPartOutput(mockOutput);
    const keyPoint = result.steps[0]?.keyPoints?.[0];
    expect(keyPoint).toContain('\\alpha');
    expect(keyPoint).toContain('^2');
  });

  it('processes knowledgePoints', () => {
    const result = postProcessFourPartOutput(mockOutput);
    expect(result.knowledgePoints[0]?.name).toContain('\\alpha');
    expect(result.knowledgePoints[0]?.name).toContain('^2');
    expect(result.knowledgePoints[0]?.description).toContain('\\times');
  });

  it('processes similarQuestions', () => {
    const result = postProcessFourPartOutput(mockOutput);
    expect(result.similarQuestions[0]?.problem).toContain('\\alpha');
    expect(result.similarQuestions[0]?.problem).toContain('\\times');
  });
});
