import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('software cup P2 long-term learning', () => {
  it('adds video handoff, weekly plan, spaced review, mastery estimates, and class trends', async () => {
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');
    const result = await runSoftwareCupGeneration('Build a long-term RAG learning plan.', {
      profileSignals: [
        {
          id: 'weak',
          userId: 'student-1',
          dimension: 'knowledgeBase',
          value: {
            strongPoints: ['Python'],
            weakPoints: ['vector retrieval', 'evaluation metrics'],
          },
          source: 'onboarding_chat',
          confidence: 0.9,
          evidence: ['weak points for P2'],
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
    });

    expect(result.p2Enhancements.videoHandoff).toMatchObject({
      status: 'ready_for_generation',
      providerHint: 'script_to_video',
    });
    expect(result.p2Enhancements.videoHandoff.scenes.length).toBeGreaterThanOrEqual(3);
    expect(result.p2Enhancements.weeklyPlan).toHaveLength(4);
    expect(result.p2Enhancements.spacedReviews[0]).toMatchObject({
      knowledgePoint: 'vector retrieval',
    });
    expect(result.p2Enhancements.masteryEstimates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          knowledgePoint: 'vector retrieval',
          nextReviewInDays: 1,
        }),
      ]),
    );
    expect(result.p2Enhancements.classGroupProfile.teacherActions.length).toBeGreaterThan(0);
    expect(result.p2Enhancements.classGroupProfile.tierRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tier: 'support',
        }),
      ]),
    );
  });
});
