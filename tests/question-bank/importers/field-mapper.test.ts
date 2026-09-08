import { describe, it, expect } from 'vitest';
import {
  detectFieldMapping,
  applyFieldMapping,
  mergeMappings,
} from '@/lib/question-bank/importers/field-mapper';

describe('detectFieldMapping', () => {
  it('maps exact English column names', () => {
    const result = detectFieldMapping(['subject', 'content', 'answer']);
    expect(result.mapping).toEqual({
      subject: 'subject',
      content: 'content',
      answer: 'answer',
    });
    expect(result.unmapped).toEqual([]);
  });

  it('maps exact Chinese column names', () => {
    const result = detectFieldMapping(['学科', '题目', '答案', '解析']);
    expect(result.mapping).toEqual({
      学科: 'subject',
      题目: 'content',
      答案: 'answer',
      解析: 'explanation',
    });
    expect(result.unmapped).toEqual([]);
  });

  it('maps mixed Chinese and English columns', () => {
    const result = detectFieldMapping(['学科', 'content', '难度', 'answer']);
    expect(result.mapping).toEqual({
      学科: 'subject',
      content: 'content',
      难度: 'difficulty',
      answer: 'answer',
    });
  });

  it('uses substring fallback for fuzzy match', () => {
    const result = detectFieldMapping(['题目内容', '正确答案', '答案解析']);
    expect(result.mapping['题目内容']).toBe('content');
    expect(result.mapping['正确答案']).toBe('answer');
    expect(result.mapping['答案解析']).toBe('explanation');
  });

  it('collects unmapped columns', () => {
    const result = detectFieldMapping(['subject', 'unknown_col', 'content']);
    expect(result.unmapped).toContain('unknown_col');
    expect(result.mapping['subject']).toBe('subject');
    expect(result.mapping['content']).toBe('content');
  });

  it('detects conflicts when multiple columns map to same field', () => {
    const result = detectFieldMapping(['学科', '科目', 'content']);
    expect(result.conflicts).toContain('subject');
  });

  it('is case-insensitive', () => {
    const result = detectFieldMapping(['SUBJECT', 'Content', 'ANSWER']);
    expect(result.mapping['SUBJECT']).toBe('subject');
    expect(result.mapping['Content']).toBe('content');
    expect(result.mapping['ANSWER']).toBe('answer');
  });

  it('handles empty columns gracefully', () => {
    const result = detectFieldMapping([]);
    expect(result.mapping).toEqual({});
    expect(result.unmapped).toEqual([]);
  });
});

describe('applyFieldMapping', () => {
  it('maps raw row to canonical fields', () => {
    const mapping = { 学科: 'subject', 题目: 'content' };
    const row = { 学科: '数学', 题目: '1+1=?', 答案: '2' };
    const result = applyFieldMapping(row, mapping);
    expect(result.subject).toBe('数学');
    expect(result.content).toBe('1+1=?');
    expect(result).not.toHaveProperty('答案');
  });

  it('applies default values for missing fields', () => {
    const mapping = { subject: 'subject' };
    const row = { subject: '数学' };
    const result = applyFieldMapping(row, mapping, { defaultValues: { difficulty: 'medium' } });
    expect(result.subject).toBe('数学');
    expect(result.difficulty).toBe('medium');
  });

  it('does not override existing values with defaults', () => {
    const mapping = { subject: 'subject', difficulty: 'difficulty' };
    const row = { subject: '数学', difficulty: 'hard' };
    const result = applyFieldMapping(row, mapping, { defaultValues: { difficulty: 'medium' } });
    expect(result.difficulty).toBe('hard');
  });
});

describe('mergeMappings', () => {
  it('overrides auto-detected with custom mapping', () => {
    const auto = detectFieldMapping(['学科', '题目']);
    const merged = mergeMappings(auto, { 学科: 'grade' });
    expect(merged.mapping['学科']).toBe('grade');
    expect(merged.mapping['题目']).toBe('content');
  });

  it('removes overridden columns from unmapped', () => {
    const auto = detectFieldMapping(['学科', 'unknown']);
    const merged = mergeMappings(auto, { unknown: 'source' });
    expect(merged.unmapped).not.toContain('unknown');
    expect(merged.mapping['unknown']).toBe('source');
  });
});
