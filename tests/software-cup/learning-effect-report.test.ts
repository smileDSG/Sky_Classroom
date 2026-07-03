import { describe, expect, it } from 'vitest';

import { buildLearningEffectReport } from '@/lib/software-cup/learning-effect';

describe('learning effect report', () => {
  it('summarizes mastery change and resource effectiveness', () => {
    const report = buildLearningEffectReport({
      results: [
        {
          questionId: 'q1',
          knowledgePoint: 'vector retrieval',
          correct: false,
          errorTag: 'concept boundary',
        },
        {
          questionId: 'q2',
          knowledgePoint: 'RAG workflow',
          correct: true,
        },
      ],
      resourceUsage: [
        {
          resourceId: 'r1',
          resourceType: 'code_case',
          action: 'complete',
          completionRate: 0.95,
          durationSeconds: 420,
        },
        {
          resourceId: 'r2',
          resourceType: 'video_script',
          action: 'skip',
          completionRate: 0.2,
          durationSeconds: 18,
        },
      ],
    });

    expect(report.accuracy).toBe(50);
    expect(report.masteryDelta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          knowledgePoint: 'vector retrieval',
          delta: -18,
        }),
        expect.objectContaining({
          knowledgePoint: 'RAG workflow',
          delta: 12,
        }),
      ]),
    );
    expect(report.resourceEffectiveness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: 'r1',
          status: 'effective',
        }),
        expect.objectContaining({
          resourceId: 'r2',
          status: 'mismatch',
        }),
      ]),
    );
    expect(report.nextResourceStrategy).toContain('push targeted review for vector retrieval');
  });
});
