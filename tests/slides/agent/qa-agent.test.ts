import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('@/lib/ai/llm', () => ({ callLLM: (...args: unknown[]) => mockCallLLM(...args) }));

import { runQA } from '@/lib/slides/agent/qa-agent';
import type { Outline } from '@/lib/slides/agent/planning-agent';
import type { SectionOutput } from '@/lib/slides/agent/section-agent';
import type { LanguageModel } from 'ai';

const mockModel = { modelId: 'test' } as unknown as LanguageModel;

function makeValidOutline(): Outline {
  return {
    sections: [
      {
        sectionId: 1, title: 'Intro',
        pages: [
          { pageNum: 1, type: 'cover', title: '封面', contentOutline: { focus: '封面' } },
          { pageNum: 2, type: 'toc', title: '目录', contentOutline: { focus: '目录' } },
          { pageNum: 3, type: 'chapter', title: 'Ch1', contentOutline: { focus: 'Ch1' } },
          { pageNum: 4, type: 'concept', title: '概念', contentOutline: { focus: '概念', keyConcepts: ['a'] } },
          { pageNum: 5, type: 'end', title: '结束', contentOutline: { focus: '结束' } },
        ],
      },
    ],
  };
}

function makeValidContent(): SectionOutput {
  return {
    sectionId: 1,
    pages: [
      { pageNum: 1, pageType: 'cover', content: { title: '封' } },
      { pageNum: 2, pageType: 'toc', content: { title: '目录', items: [] } },
      { pageNum: 3, pageType: 'chapter', content: { title: 'Ch1', num: '01', subtitle: 'sub' } },
      { pageNum: 4, pageType: 'concept', content: { title: '概念', cards: [], summary: 'sum' } },
      { pageNum: 5, pageType: 'end', content: { slogan: 'end', subtitle: 'sub' } },
    ],
  };
}

describe('QAAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes a well-structured valid PPT', async () => {
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify({ contentScore: 95, issues: [] }) });
    const result = await runQA('测试', '高中', makeValidOutline(), [makeValidContent()], 5, mockModel);
    expect(result.pass).toBe(true);
    expect(result.totalScore).toBe(95);
  });

  it('detects missing cover page', async () => {
    const outline = makeValidOutline();
    outline.sections[0].pages[0] = { pageNum: 1, type: 'content' as never, title: 'not cover', contentOutline: { focus: 'x' } };

    const result = await runQA('测试', '高中', outline, [makeValidContent()], 5, mockModel);
    expect(result.issues.some((i) => i.type === 'missing_cover')).toBe(true);
    expect(result.pass).toBe(false);
  });

  it('detects missing end page', async () => {
    const outline = makeValidOutline();
    outline.sections[0].pages[4] = { pageNum: 5, type: 'content' as never, title: 'not end', contentOutline: { focus: 'x' } };

    const result = await runQA('测试', '高中', outline, [makeValidContent()], 5, mockModel);
    expect(result.issues.some((i) => i.type === 'missing_end')).toBe(true);
  });

  it('detects empty content', async () => {
    mockCallLLM.mockResolvedValueOnce({ text: JSON.stringify({ contentScore: 90, issues: [] }) });
    const content = makeValidContent();
    content.pages[0].content = {};

    const result = await runQA('测试', '高中', makeValidOutline(), [content], 5, mockModel);
    expect(result.issues.some((i) => i.type === 'empty_content')).toBe(true);
  });
});
