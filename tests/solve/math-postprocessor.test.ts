import { describe, it, expect } from 'vitest';
import { postProcessMathContent, postProcessFourPartOutput } from '@/lib/solve/math-postprocessor';
import type { FourPartOutput } from '@/lib/solve/types';

describe('postProcessMathContent', () => {
  it('wraps single fractions', () => {
    expect(postProcessMathContent('面积变为原来的1/4')).toContain('\\frac{1}{4}');
  });

  it('wraps variable fractions', () => {
    expect(postProcessMathContent('A/2')).toContain('\\frac{A}{2}');
  });

  it('wraps variables with primes', () => {
    expect(postProcessMathContent("A'")).toContain("$A'$");
  });

  it('wraps double primes', () => {
    expect(postProcessMathContent("E''")).toContain("$E''$");
  });

  it('handles chained expressions', () => {
    const result = postProcessMathContent("E'=1/4·1/2kA^2=1/4E");
    expect(result).toContain('\\frac{1}{4}');
    expect(result).toContain('\\cdot');
    expect(result.startsWith('$')).toBe(true);
  });

  it('does not modify already-wrapped math', () => {
    expect(postProcessMathContent('$x=5$')).toBe('$x=5$');
  });

  it('normalizes Unicode superscripts', () => {
    expect(postProcessMathContent('A²')).toContain('^2');
  });

  it('converts Unicode middle dot', () => {
    // The chained expression handler should convert · to \cdot
    const result = postProcessMathContent('1/4·1/2');
    expect(result).toContain('\\frac{1}{4}');
    expect(result).toContain('\\cdot');
  });

  it('handles mixed Chinese text with math', () => {
    const result = postProcessMathContent("将振幅减小为原来的一半，A'=A/2");
    expect(result).toContain('\\frac{A}{2}');
  });

  it('preserves block math $$...$$', () => {
    const input = '$$\\frac{1}{2}kA^2$$';
    expect(postProcessMathContent(input)).toBe(input);
  });

  it('wraps bare equations', () => {
    const result = postProcessMathContent('x=5');
    expect(result).toContain('$x=5$');
  });
});

describe('postProcessFourPartOutput', () => {
  const mockOutput: FourPartOutput = {
    answer: "A'=A/2",
    steps: [
      {
        label: '步骤1',
        content: "将振幅减小为原来的一半，A'=A/2",
        keyPoints: ['注意振幅变化1/4'],
      },
    ],
    knowledgePoints: [],
    similarQuestions: [],
  };

  it('processes answer field', () => {
    const result = postProcessFourPartOutput(mockOutput);
    expect(result.answer).toContain('\\frac{A}{2}');
  });

  it('processes step content', () => {
    const result = postProcessFourPartOutput(mockOutput);
    expect(result.steps[0].content).toContain("\\frac{A}{2}");
  });

  it('processes keyPoints', () => {
    const result = postProcessFourPartOutput(mockOutput);
    expect(result.steps[0].keyPoints?.[0]).toContain('\\frac{1}{4}');
  });
});
