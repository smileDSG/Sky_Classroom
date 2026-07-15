import { describe, it, expect } from 'vitest';
import { matchAnswers, normalizeAnswer } from '@/lib/solve/agents/answer-matcher';

describe('normalizeAnswer', () => {
  it('strips LaTeX delimiters', () => {
    expect(normalizeAnswer('$3$')).toBe('3');
    expect(normalizeAnswer('$$\\frac{1}{2}$$')).toBe('\\frac{1}{2}');
  });

  it('strips option prefixes', () => {
    expect(normalizeAnswer('A')).toBe('a');
    expect(normalizeAnswer('选项B')).toBe('b');
    expect(normalizeAnswer('(C)')).toBe('c');
    expect(normalizeAnswer('（D）')).toBe('d');
  });

  it('normalizes whitespace', () => {
    expect(normalizeAnswer('  3  ')).toBe('3');
    expect(normalizeAnswer('1, 2, 3')).toBe('1,2,3');
  });
});

describe('matchAnswers', () => {
  it('matches identical answers', () => {
    expect(matchAnswers('3', '3').match).toBe(true);
  });

  it('matches LaTeX vs plain', () => {
    expect(matchAnswers('$3$', '3').match).toBe(true);
    expect(matchAnswers('$\\frac{1}{2}$', '1/2').match).toBe(true);
  });

  it('matches option formats', () => {
    expect(matchAnswers('C', '选项C').match).toBe(true);
    expect(matchAnswers('(A)', 'A').match).toBe(true);
  });

  it('matches numeric equivalence', () => {
    expect(matchAnswers('3.0', '3').match).toBe(true);
    expect(matchAnswers('0.5', '1/2').match).toBe(true);
  });

  it('rejects different answers', () => {
    expect(matchAnswers('3', '4').match).toBe(false);
    expect(matchAnswers('A', 'B').match).toBe(false);
  });

  it('handles empty answers', () => {
    expect(matchAnswers('', '').match).toBe(true);
    expect(matchAnswers('', '3').match).toBe(false);
  });
});
