/**
 * POST /api/sky/teaching/[jobId]/adapt — block-tail adaptive supplementation tests.
 *
 * The route re-runs the adaptive decision on collected quiz results / feedback and,
 * for weak knowledge points, generates supplemental sections and appends them to the
 * plan so subsequent content adjusts to demonstrated gaps.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { TeachingJob } from '@/lib/server/teaching-job-store';
import type { LessonPlan } from '@/lib/teaching/lesson-types';
import type { AdaptiveDecision } from '@/lib/teaching/adaptive-engine';

const boundary = vi.hoisted(() => ({
  userId: 'user-1',
  job: null as TeachingJob | null,
  decide: {
    shouldSupplement: false,
    weakKnowledgePoints: [] as string[],
    supplementalSections: [] as LessonPlan['sections'],
  },
  generateResult: null as 'fail-all' | 'fail-first' | null,
  generateCount: 0 as number,
  persistPatches: [] as Array<Partial<TeachingJob>>,
}));

vi.mock('@/lib/server/teaching-job-store', () => ({
  readTeachingJob: vi.fn(async () => boundary.job),
  updateTeachingJob: vi.fn(async (_id: string, patch: Partial<TeachingJob>) => {
    boundary.persistPatches.push(patch);
    return boundary.job as TeachingJob;
  }),
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));

vi.mock('@/lib/student/profile-builder', () => ({
  buildStudentProfile: vi.fn(async () => ({ masteryByKnowledge: {} })),
}));

vi.mock('@/lib/teaching/adaptive-engine', () => ({
  decideAdaptiveAdjustment: vi.fn(
    (): AdaptiveDecision => ({
      shouldSupplement: boundary.decide.shouldSupplement,
      weakKnowledgePoints: boundary.decide.weakKnowledgePoints,
      supplementalSections: boundary.decide.supplementalSections,
    }),
  ),
}));

vi.mock('@/lib/teaching/content-generator', () => ({
  extractContentSummary: vi.fn(() => 'summary'),
  generateSectionContent: vi.fn(async () => {
    const call = boundary.generateCount;
    boundary.generateCount += 1;
    const shouldFail =
      boundary.generateResult === 'fail-all' ||
      (boundary.generateResult === 'fail-first' && call === 0);
    if (shouldFail) throw new Error('llm down');
    return { chunks: [{ id: 'c', type: 'text', content: 'x', order: 0 }] };
  }),
}));

import { POST } from '@/app/api/sky/teaching/[jobId]/adapt/route';

const weakPointSection = {
  id: 'section-supplement-1',
  title: '补充强化：一元二次方程',
  contentType: 'example',
  depth: 'basic',
  knowledgePoints: ['一元二次方程'],
  estimatedDuration: 5,
  hasQuiz: true,
};

const originalSection = {
  id: 's1',
  title: '导入',
  contentType: 'explanation',
  depth: 'basic',
  knowledgePoints: ['一次函数'],
  estimatedDuration: 5,
  hasQuiz: true,
};

function makeJob(overrides?: Partial<TeachingJob>): TeachingJob {
  return {
    id: 'job-1',
    userId: boundary.userId,
    topic: '二次函数',
    status: 'succeeded',
    step: 'done',
    progress: 100,
    message: '完成',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plan: { title: '二次函数', sections: [originalSection], estimatedDuration: 5 },
    sections: [
      { section: originalSection, chunks: [{ id: 'c1', type: 'text', content: 'x', order: 0 }] },
    ],
    sectionFeedbacks: [],
    quizResults: [
      {
        sectionId: 's1',
        chunkOrder: 0,
        knowledgePoints: ['一次函数'],
        isCorrect: false,
        timestamp: 1,
      },
    ],
    ...overrides,
  };
}

function post(jobId = 'job-1') {
  return POST(
    new NextRequest(`http://localhost/api/sky/teaching/${jobId}/adapt`, { method: 'POST' }),
    { params: Promise.resolve({ jobId }) },
  );
}

beforeEach(() => {
  boundary.job = makeJob();
  boundary.decide = { shouldSupplement: false, weakKnowledgePoints: [], supplementalSections: [] };
  boundary.generateResult = null;
  boundary.generateCount = 0;
  boundary.persistPatches = [];
});

describe('POST /api/sky/teaching/[jobId]/adapt', () => {
  it('403 when the job belongs to another user', async () => {
    boundary.job = makeJob({ userId: 'other-user' });
    const res = await post();
    expect(res.status).toBe(403);
  });

  it('404 when the job does not exist', async () => {
    boundary.job = null;
    const res = await post();
    expect(res.status).toBe(404);
  });

  it('no-ops when there is nothing to supplement', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.hasSupplement).toBe(false);
    expect(payload.data.supplemental).toEqual([]);
    expect(boundary.persistPatches).toEqual([]);
    expect(boundary.generateCount).toBe(0);
  });

  it('generates and appends a supplemental section for weak points', async () => {
    boundary.decide = {
      shouldSupplement: true,
      weakKnowledgePoints: ['一元二次方程'],
      supplementalSections: [weakPointSection],
    };

    const res = await post();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.hasSupplement).toBe(true);
    expect(payload.data.supplemental).toHaveLength(1);
    expect(payload.data.weakKnowledgePoints).toEqual(['一元二次方程']);
    expect(boundary.generateCount).toBe(1);

    // Persisted plan has the supplemental section appended.
    const planPatch = boundary.persistPatches.find((p) => p.plan !== undefined);
    const appendedPlan = planPatch?.plan as LessonPlan;
    expect(appendedPlan.sections.map((s) => s.id)).toEqual(['s1', 'section-supplement-1']);

    // Persisted sections include the generated content.
    const sectionsPatch = boundary.persistPatches.find((p) => p.sections !== undefined);
    expect(sectionsPatch?.sections).toHaveLength(2);
  });

  it('no-ops and persists nothing when all LLM generations fail', async () => {
    boundary.decide = {
      shouldSupplement: true,
      weakKnowledgePoints: ['一元二次方程'],
      supplementalSections: [weakPointSection],
    };
    boundary.generateResult = 'fail-all';

    const res = await post();
    // Generation fails → gracefully no-op, nothing persisted.
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.hasSupplement).toBe(false);
    expect(boundary.generateCount).toBe(1);
    expect(boundary.persistPatches).toEqual([]);
  });

  it('persists only the supplemental section that succeeded when some fail', async () => {
    boundary.decide = {
      shouldSupplement: true,
      weakKnowledgePoints: ['a', 'b'],
      supplementalSections: [
        { ...weakPointSection, id: 'supp-a', title: 'A' },
        { ...weakPointSection, id: 'supp-b', title: 'B' },
      ],
    };
    boundary.generateResult = 'fail-first';

    const res = await post();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(boundary.generateCount).toBe(2);
    // Only the second succeeded → appended once.
    expect(payload.data.supplemental).toHaveLength(1);
    expect(payload.data.supplemental[0].section.id).toBe('supp-b');
    const sectionsPatch = boundary.persistPatches.find((p) => p.sections !== undefined);
    expect(sectionsPatch?.sections).toHaveLength(2);
    expect((sectionsPatch?.sections as { section: { id: string } }[])[1].section.id).toBe('supp-b');
  });

  it('returns 500 when profile building fails', async () => {
    const { buildStudentProfile } = await import('@/lib/student/profile-builder');
    const mockBuild = buildStudentProfile as ReturnType<typeof vi.fn>;
    mockBuild.mockRejectedValueOnce(new Error('profile unavailable'));

    const res = await post();
    expect(res.status).toBe(500);
    expect(boundary.persistPatches).toEqual([]);
  });
});
