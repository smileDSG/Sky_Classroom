import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ingestGeneratedResources,
  retrieveCourseStudioContext,
} from '@/lib/server/resource-generation-kb';
import type { SoftwareCupGenerationResult } from '@/lib/software-cup/demo-service';

vi.mock('server-only', () => ({}));

const searchMock = vi.fn();
const writeMock = vi.fn();

vi.mock('@/lib/knowledge-base/kb-manager', () => ({
  write: (...args: unknown[]) => writeMock(...args),
  search: (...args: unknown[]) => searchMock(...args),
}));

beforeEach(() => {
  searchMock.mockReset();
  writeMock.mockReset();
});

function makeResult(
  overrides: Partial<SoftwareCupGenerationResult> = {},
): SoftwareCupGenerationResult {
  return {
    demoId: 'demo',
    jobId: 'job',
    status: 'completed',
    progress: 100,
    generationMode: 'llm_rag',
    courseId: 'ai-intro',
    generatedAt: new Date().toISOString(),
    studentProfile: {} as never,
    safety: { passed: true, riskLevel: 'low', categories: [], action: 'allow', message: 'ok' },
    courseHits: [],
    agentTrace: [],
    resources: [],
    learningPath: [],
    reviewResult: { passed: true, confidence: 0.9, issues: [], suggestions: [] },
    p2Enhancements: {} as never,
    ...overrides,
  };
}

describe('ingestGeneratedResources', () => {
  it('writes each generated resource content into the shared course KB', async () => {
    const write = vi.fn().mockResolvedValue({ docId: 'doc', chunks: 2 });
    const result = makeResult({
      jobId: 'job-1',
      resources: [
        {
          id: 'r1',
          type: 'markdown_lecture',
          title: '过拟合个性化讲义',
          content: '# 过拟合讲义\n正文内容。',
          qualityReview: {
            passed: true,
            score: 0.9,
            issues: [],
            suggestions: [],
          } as never,
        },
        {
          id: 'r2',
          type: 'mind_map',
          title: 'RAG 知识导图',
          contentPreview: '仅有预览，无完整内容。',
        } as never,
      ] as any,
    });

    const summary = await ingestGeneratedResources({ jobId: 'job-1', result, write });

    expect(summary.documents).toBe(2);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        kbType: 'course',
        title: '过拟合个性化讲义',
        content: '# 过拟合讲义\n正文内容。',
        tags: expect.arrayContaining(['course_studio', 'markdown_lecture']),
        sourceId: expect.stringContaining('resource-job-1-r1'),
        verified: true,
      }),
    );
    // 质量校验未通过时不得标记为 verified。
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'RAG 知识导图',
        verified: false,
      }),
    );
  });

  it('skips resources without any content', async () => {
    const write = vi.fn().mockResolvedValue({ docId: 'doc', chunks: 1 });
    const result = makeResult({
      resources: [
        {
          id: 'r1',
          type: 'learning_path',
          title: '空资源',
        } as never,
      ] as any,
    });

    const summary = await ingestGeneratedResources({ jobId: 'job-2', result, write });

    expect(summary.documents).toBe(0);
    expect(write).not.toHaveBeenCalled();
  });

  it('tolerates a failing write without aborting the rest', async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ docId: 'doc', chunks: 3 });
    const result = makeResult({
      resources: [
        { id: 'r1', type: 'markdown_lecture', title: '讲义', content: '讲义内容' } as never,
        { id: 'r2', type: 'mind_map', title: '导图', content: '导图内容' } as never,
      ] as any,
    });

    const summary = await ingestGeneratedResources({ jobId: 'job-3', result, write });

    expect(summary.documents).toBe(1);
    expect(write).toHaveBeenCalledTimes(2);
  });
});

describe('retrieveCourseStudioContext', () => {
  it('searches the shared course KB with the topic query', async () => {
    searchMock.mockResolvedValueOnce([
      {
        chunk: {
          docTitle: '过拟合个性化讲义',
          content: '过拟合是指模型在训练集表现好，但在新数据上表现差。',
        },
        score: 0.85,
      },
      {
        chunk: { docTitle: 'RAG 知识导图', content: 'RAG 包括检索、生成与引用复核。' },
        score: 0.6,
      },
    ]);

    const context = await retrieveCourseStudioContext('过拟合', { topK: 2, maxChars: 200 });

    expect(searchMock).toHaveBeenCalledWith({
      kbType: 'course',
      query: '过拟合',
      topK: 2,
    });
    expect(context).toContain('【过拟合个性化讲义】');
    expect(context).toContain('【RAG 知识导图】');
    expect(context).toContain('过拟合是指模型');
  });

  it('returns an empty string when no course resources match', async () => {
    searchMock.mockResolvedValueOnce([]);

    await expect(retrieveCourseStudioContext('无关主题')).resolves.toBe('');
  });

  it('returns an empty string when the KB search fails', async () => {
    searchMock.mockRejectedValueOnce(new Error('kb down'));

    await expect(retrieveCourseStudioContext('主题')).resolves.toBe('');
  });
});
