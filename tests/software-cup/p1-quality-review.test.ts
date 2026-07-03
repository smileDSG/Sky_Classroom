import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('software cup P1 quality review', () => {
  it('adds per-resource QA checks for citations, difficulty, and profile fit', async () => {
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');
    const result = await runSoftwareCupGeneration(
      'Please build RAG resources for vector retrieval.',
      {
        profileSignals: [
          {
            id: 'weak',
            userId: 'student-1',
            dimension: 'knowledgeBase',
            value: {
              strongPoints: ['Python'],
              weakPoints: ['vector retrieval'],
            },
            source: 'onboarding_chat',
            confidence: 0.9,
            evidence: ['vector retrieval is hard'],
            createdAt: 1000,
          },
          {
            id: 'pref',
            userId: 'student-1',
            dimension: 'resourcePreference',
            value: ['code cases', 'diagrams'],
            source: 'onboarding_chat',
            confidence: 0.9,
            evidence: ['prefers code and diagrams'],
            createdAt: 1001,
          },
        ],
      },
    );

    expect(result.resources[0].qualityReview).toMatchObject({
      resourceId: result.resources[0].id,
      citationCoverage: 'pass',
      personalizationFit: 'pass',
    });
    expect(result.reviewResult.resourceChecks).toHaveLength(result.resources.length);
    expect(result.reviewResult.suggestions.join(' ')).toContain('profile');
  });
});
