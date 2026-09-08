/**
 * Study Group Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildStudyGroupContext,
  createStudyGroupAgents,
  buildDiscussionPrompt,
  buildStudyGroupSetup,
} from '@/lib/teaching/study-group';
import type { TeachingJob } from '@/lib/server/teaching-job-store';

function makeJob(overrides?: Partial<TeachingJob>): TeachingJob {
  return {
    id: 'job-test-1',
    userId: 'user-1',
    topic: '二次函数',
    status: 'succeeded',
    step: 'done',
    progress: 100,
    message: '完成',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plan: {
      title: '二次函数精讲',
      sections: [],
      estimatedDuration: 20,
      focusPoints: ['二次函数', '一元二次方程'],
    },
    sections: [
      {
        section: {
          id: 's1',
          title: '二次函数的定义',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['二次函数'],
          estimatedDuration: 5,
          hasQuiz: false,
        },
        chunks: [
          {
            sectionId: 's1',
            type: 'text',
            content: '二次函数是形如 y = ax² + bx + c 的函数，其中 a ≠ 0。',
            order: 0,
          },
          { sectionId: 's1', type: 'formula', content: '\\( y = ax^2 + bx + c \\)', order: 1 },
        ],
      },
      {
        section: {
          id: 's2',
          title: '求根公式',
          contentType: 'example',
          depth: 'intermediate',
          knowledgePoints: ['一元二次方程'],
          estimatedDuration: 10,
          hasQuiz: false,
        },
        chunks: [
          { sectionId: 's2', type: 'example', content: '例：解方程 x² - 5x + 6 = 0', order: 0 },
          { sectionId: 's2', type: 'text', content: '使用求根公式可得 x = 2 或 x = 3。', order: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('buildStudyGroupContext', () => {
  it('extracts topic and summary from a job', () => {
    const job = makeJob();
    const ctx = buildStudyGroupContext(job);

    expect(ctx.topic).toBe('二次函数精讲');
    expect(ctx.focusPoints).toContain('二次函数');
    expect(ctx.sectionTitles).toEqual(['二次函数的定义', '求根公式']);
    expect(ctx.summary).toContain('二次函数');
    expect(ctx.summary).toContain('二次函数的定义');
  });

  it('truncates long summaries', () => {
    const job = makeJob({
      sections: Array.from({ length: 20 }, (_, i) => ({
        section: {
          id: `s${i}`,
          title: `章节${i}`,
          contentType: 'explanation' as const,
          depth: 'basic' as const,
          knowledgePoints: ['kp'],
          estimatedDuration: 5,
          hasQuiz: false,
        },
        chunks: [{ sectionId: `s${i}`, type: 'text' as const, content: 'a'.repeat(500), order: 0 }],
      })),
    });
    const ctx = buildStudyGroupContext(job);
    expect(ctx.summary.length).toBeLessThanOrEqual(1503); // 1500 + '...'
  });

  it('falls back to job topic when plan title is missing', () => {
    const job = makeJob({ plan: undefined });
    const ctx = buildStudyGroupContext(job);
    expect(ctx.topic).toBe('二次函数');
  });
});

describe('createStudyGroupAgents', () => {
  it('creates 3 student personas', () => {
    const agents = createStudyGroupAgents('三角函数');
    expect(agents.length).toBe(3);
  });

  it('assigns distinct names and colors', () => {
    const agents = createStudyGroupAgents('三角函数');
    const names = agents.map((a) => a.name);
    const colors = agents.map((a) => a.color);

    expect(new Set(names).size).toBe(3);
    expect(new Set(colors).size).toBe(3);
  });

  it('includes topic in persona text', () => {
    const agents = createStudyGroupAgents('三角函数');
    for (const agent of agents) {
      expect(agent.persona).toContain('三角函数');
    }
  });

  it('marks agents as generated', () => {
    const agents = createStudyGroupAgents('三角函数');
    for (const agent of agents) {
      expect(agent.isGenerated).toBe(true);
      expect(agent.role).toBe('student');
    }
  });
});

describe('buildDiscussionPrompt', () => {
  it('includes topic and summary', () => {
    const ctx = buildStudyGroupContext(makeJob());
    const prompt = buildDiscussionPrompt(ctx);

    expect(prompt).toContain(ctx.topic);
    expect(prompt).toContain(ctx.summary);
    expect(prompt).toContain('讨论规则');
  });
});

describe('buildStudyGroupSetup', () => {
  it('returns a complete setup', () => {
    const job = makeJob();
    const setup = buildStudyGroupSetup(job);

    expect(setup.sessionId).toBeDefined();
    expect(setup.context.topic).toBe('二次函数精讲');
    expect(setup.agents.length).toBe(3);
    expect(setup.discussionTopic).toBe('二次函数精讲');
    expect(setup.discussionPrompt).toContain('二次函数');
  });
});
