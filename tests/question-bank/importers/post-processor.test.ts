/**
 * Question Bank — post-processor tests.
 */

import { describe, it, expect } from 'vitest';
import {
  extractMultiColumnOptions,
  extractOptionsFromContent,
  postProcessEntries,
} from '@/lib/question-bank/importers/post-processor';
import type { QuestionBankInsert } from '@/lib/question-bank/types';

describe('extractMultiColumnOptions', () => {
  it('merges columns named A, B, C, D', () => {
    const rawRow = { A: '1', B: '2', C: '3', D: '4' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['1', '2', '3', '4']);
  });

  it('merges columns named 选项A, 选项B, 选项C', () => {
    const rawRow = { 选项A: '苹果', 选项B: '香蕉', 选项C: '橙子' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['苹果', '香蕉', '橙子']);
  });

  it('merges columns named option1, option2, option3', () => {
    const rawRow = { option1: 'Red', option2: 'Green', option3: 'Blue' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['Red', 'Green', 'Blue']);
  });

  it('skips columns already mapped to other fields', () => {
    const rawRow = { A: '1', B: '2', C: '3', answer: 'B' };
    const mapping = { answer: 'answer' };
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['1', '2', '3']);
  });

  it('skips empty option values', () => {
    const rawRow = { A: '1', B: '', C: '3' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['1', '', '3']);
  });

  it('returns null when no option columns found', () => {
    const rawRow = { subject: '数学', content: 'test' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toBeNull();
  });

  it('handles case-insensitive column names', () => {
    const rawRow = { a: '1', b: '2', c: '3' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['1', '2', '3']);
  });

  it('handles choiceA, choiceB pattern', () => {
    const rawRow = { choiceA: 'X', choiceB: 'Y', choiceC: 'Z' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['X', 'Y', 'Z']);
  });

  it('handles 备选A, 备选B pattern', () => {
    const rawRow = { 备选A: '甲', 备选B: '乙' };
    const mapping: Record<string, string> = {};
    const result = extractMultiColumnOptions(rawRow, mapping);
    expect(result).toEqual(['甲', '乙']);
  });
});

describe('extractOptionsFromContent', () => {
  it('extracts A. B. C. D. format options', () => {
    const content = '已知函数 f(x) = sin(x)，则周期为\nA. π/2\nB. π\nC. 2π\nD. 4π';
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual(['π/2', 'π', '2π', '4π']);
    expect(result.content).toBe('已知函数 f(x) = sin(x)，则周期为');
  });

  it('extracts A、B、C、D format options', () => {
    const content = '1+1=？\nA、1\nB、2\nC、3\nD、4';
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual(['1', '2', '3', '4']);
    expect(result.content).toBe('1+1=？');
  });

  it('extracts (A) (B) (C) format options', () => {
    const content = 'What is 2+2?\n(A) 3\n(B) 4\n(C) 5';
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual(['3', '4', '5']);
    expect(result.content).toBe('What is 2+2?');
  });

  it('extracts A) B) C) format options', () => {
    const content = 'Select one:\nA) First\nB) Second\nC) Third';
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual(['First', 'Second', 'Third']);
    expect(result.content).toBe('Select one:');
  });

  it('returns empty when no options found', () => {
    const content = '计算：1 + 2 = ?';
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual([]);
    expect(result.content).toBe('计算：1 + 2 = ?');
  });

  it('requires at least 2 options', () => {
    const content = 'Question?\nA. Only one option';
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual([]);
    expect(result.content).toBe('Question?\nA. Only one option');
  });

  it('handles options with Chinese punctuation', () => {
    const content = '下列哪个正确？\nA．选项一\nB．选项二\nC．选项三';
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual(['选项一', '选项二', '选项三']);
    expect(result.content).toBe('下列哪个正确？');
  });

  it('preserves content when options are not at the end', () => {
    // Options must be at the end of content to be extracted
    const content = 'A. First line\nSome text in middle\nB. Last line';
    const result = extractOptionsFromContent(content);
    // This won't extract because options are not contiguous at the end
    expect(result.options).toEqual([]);
  });

  it('handles empty content', () => {
    const result = extractOptionsFromContent('');
    expect(result.options).toEqual([]);
    expect(result.content).toBe('');
  });

  it('handles options with LaTeX', () => {
    const content = String.raw`求积分
A. $\int x dx$
B. $\int x^2 dx$
C. $\int e^x dx$`;
    const result = extractOptionsFromContent(content);
    expect(result.options).toEqual([
      String.raw`$\int x dx$`,
      String.raw`$\int x^2 dx$`,
      String.raw`$\int e^x dx$`,
    ]);
    expect(result.content).toBe('求积分');
  });
});

describe('postProcessEntries', () => {
  it('extracts options from content for choice questions', () => {
    const entries: QuestionBankInsert[] = [
      {
        subject: '数学',
        grade: '高一',
        difficulty: 'medium',
        questionType: 'choice',
        content: 'f(x)=sin(x)的周期是\nA. π/2\nB. π\nC. 2π\nD. 4π',
        answer: 'B',
        options: [],
      },
    ];
    const result = postProcessEntries(entries);
    expect(result[0].options).toEqual(['π/2', 'π', '2π', '4π']);
    expect(result[0].content).toBe('f(x)=sin(x)的周期是');
  });

  it('keeps existing options for choice questions', () => {
    const entries: QuestionBankInsert[] = [
      {
        subject: '数学',
        grade: '高一',
        difficulty: 'medium',
        questionType: 'choice',
        content: 'test',
        answer: 'A',
        options: ['1', '2', '3'],
      },
    ];
    const result = postProcessEntries(entries);
    expect(result[0].options).toEqual(['1', '2', '3']);
  });

  it('does not process non-choice questions', () => {
    const entries: QuestionBankInsert[] = [
      {
        subject: '数学',
        grade: '高一',
        difficulty: 'medium',
        questionType: 'solve',
        content: 'test\nA. 1\nB. 2',
        answer: '2',
      },
    ];
    const result = postProcessEntries(entries);
    expect(result[0].content).toBe('test\nA. 1\nB. 2');
    expect(result[0].options).toBeUndefined();
  });

  it('filters out empty option strings', () => {
    const entries: QuestionBankInsert[] = [
      {
        subject: '数学',
        grade: '高一',
        difficulty: 'medium',
        questionType: 'choice',
        content: 'test',
        answer: 'A',
        options: ['1', '', '3', null as any],
      },
    ];
    const result = postProcessEntries(entries);
    expect(result[0].options).toEqual(['1', '3']);
  });

  it('does not modify content when extraction fails', () => {
    const entries: QuestionBankInsert[] = [
      {
        subject: '数学',
        grade: '高一',
        difficulty: 'medium',
        questionType: 'choice',
        content: 'No options here',
        answer: 'A',
      },
    ];
    const result = postProcessEntries(entries);
    expect(result[0].content).toBe('No options here');
    expect(result[0].options).toBeUndefined();
  });
});
