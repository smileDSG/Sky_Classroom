/**
 * Personalized Highlighter — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeHighlights,
  splitHighlightedText,
  HIGHLIGHT_STYLES,
  getHighlightTooltip,
} from '@/lib/teaching/personalized-highlighter';
import type { StudentProfile } from '@/lib/student/profile-types';

function makeProfile(overrides?: Partial<StudentProfile>): StudentProfile {
  return {
    userId: 'test-user',
    masteryBySubject: {
      math: 60,
      physics: 40,
      chemistry: 0,
      biology: 0,
      chinese: 0,
      english: 0,
      history: 0,
      geography: 0,
      politics: 0,
      unknown: 0,
    },
    masteryByKnowledge: {},
    weakPoints: [],
    strongPoints: [],
    errorPatterns: [],
    totalQuestions: 10,
    totalCorrect: 5,
    lastUpdated: new Date(),
    ...overrides,
  };
}

describe('analyzeHighlights', () => {
  it('returns empty when profile is null', () => {
    expect(analyzeHighlights('二次函数', null)).toEqual([]);
    expect(analyzeHighlights('二次函数', undefined)).toEqual([]);
  });

  it('returns empty when no knowledge points match', () => {
    const profile = makeProfile({
      masteryByKnowledge: { 导数: 50 },
    });
    expect(analyzeHighlights('二次函数', profile)).toEqual([]);
  });

  it('marks weak points (mastery < 30) as weak', () => {
    const profile = makeProfile({
      masteryByKnowledge: { 二次函数: 20 },
    });
    const result = analyzeHighlights('二次函数的图像', profile);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      point: '二次函数',
      level: 'weak',
      mastery: 20,
    });
  });

  it('marks strong points (mastery > 80) as strong', () => {
    const profile = makeProfile({
      masteryByKnowledge: { 二次函数: 90 },
    });
    const result = analyzeHighlights('二次函数的图像', profile);
    expect(result[0]).toMatchObject({
      point: '二次函数',
      level: 'strong',
      mastery: 90,
    });
  });

  it('marks error-prone points (30-80 with errors)', () => {
    const profile = makeProfile({
      masteryByKnowledge: { 二次函数: 50 },
      errorPatterns: [
        {
          knowledgePoint: '二次函数',
          errorType: 'calculation-error',
          frequency: 2,
          lastOccurrence: new Date(),
        },
      ],
    });
    const result = analyzeHighlights('二次函数的图像', profile);
    expect(result[0]).toMatchObject({
      point: '二次函数',
      level: 'error-prone',
      errorCount: 2,
    });
  });

  it('marks normal points (30-80 without errors)', () => {
    const profile = makeProfile({
      masteryByKnowledge: { 二次函数: 50 },
    });
    const result = analyzeHighlights('二次函数的图像', profile);
    expect(result[0]).toMatchObject({
      point: '二次函数',
      level: 'normal',
    });
  });

  it('matches multiple points and sorts by length descending', () => {
    const profile = makeProfile({
      masteryByKnowledge: { 二次函数: 20, 函数: 90 },
    });
    const result = analyzeHighlights('二次函数和函数的概念', profile);
    expect(result).toHaveLength(2);
    expect(result[0].point).toBe('二次函数'); // longer first
    expect(result[1].point).toBe('函数');
  });
});

describe('splitHighlightedText', () => {
  it('returns single part when no highlights', () => {
    const result = splitHighlightedText('hello world', []);
    expect(result).toEqual([{ text: 'hello world' }]);
  });

  it('splits text by highlight points', () => {
    const highlights = [{ point: '二次函数', level: 'weak' as const, mastery: 20, errorCount: 0 }];
    const result = splitHighlightedText('二次函数的图像性质', highlights);
    expect(result).toEqual([
      { text: '' },
      { text: '二次函数', highlight: highlights[0] },
      { text: '的图像性质' },
    ]);
  });

  it('handles text without matches', () => {
    const highlights = [{ point: '导数', level: 'weak' as const, mastery: 20, errorCount: 0 }];
    const result = splitHighlightedText('二次函数', highlights);
    expect(result).toEqual([{ text: '二次函数' }]);
  });
});

describe('getHighlightTooltip', () => {
  it('returns weak tooltip', () => {
    const h = { point: '二次函数', level: 'weak' as const, mastery: 20, errorCount: 0 };
    expect(getHighlightTooltip(h)).toContain('20%');
    expect(getHighlightTooltip(h)).toContain('薄弱点');
  });

  it('returns error-prone tooltip', () => {
    const h = { point: '二次函数', level: 'error-prone' as const, mastery: 50, errorCount: 3 };
    expect(getHighlightTooltip(h)).toContain('3 次');
  });

  it('returns strong tooltip', () => {
    const h = { point: '二次函数', level: 'strong' as const, mastery: 90, errorCount: 0 };
    expect(getHighlightTooltip(h)).toContain('90%');
  });
});

describe('HIGHLIGHT_STYLES', () => {
  it('has styles for all levels', () => {
    expect(HIGHLIGHT_STYLES.weak).toContain('red');
    expect(HIGHLIGHT_STYLES['error-prone']).toContain('yellow');
    expect(HIGHLIGHT_STYLES.strong).toContain('emerald');
  });
});
