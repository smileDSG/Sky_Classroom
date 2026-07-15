/**
 * Unit tests for TeachingJob → OutlineOnlyResult adapter.
 */

import { describe, it, expect } from 'vitest';
import { buildOutlineOnlyResultFromTeachingJob } from '@/lib/server/teaching-to-classroom-outline';
import {
  recommendAgentsFromLessonPlan,
  type TeachingToClassroomConfig,
} from '@/lib/teaching/classroom-config-recommendation';
import type { TeachingJob, GeneratedSectionData } from '@/lib/server/teaching-job-store';
import type { LessonPlan } from '@/lib/teaching/lesson-types';

function makeMockJob(sections: GeneratedSectionData[]): TeachingJob {
  const plan: LessonPlan = {
    title: '二次函数入门',
    sections: sections.map((s) => s.section),
    estimatedDuration: 30,
    focusPoints: ['顶点坐标', '开口方向'],
  };

  return {
    id: 'job_123',
    userId: 'user_1',
    topic: '二次函数入门',
    status: 'succeeded',
    step: 'completed',
    progress: 100,
    message: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plan,
    sections,
    sectionsCompleted: sections.length,
    totalSections: sections.length,
  };
}

const baseConfig: TeachingToClassroomConfig = {
  selectedTeacherId: 'default-1',
  selectedStudentIds: ['default-3', 'default-4'],
  enableTTS: true,
  enableImageGeneration: true,
  enableVideoGeneration: false,
  enableWebSearch: false,
};

describe('buildOutlineOnlyResultFromTeachingJob', () => {
  it('maps sections to scene outlines 1:1', () => {
    const sections: GeneratedSectionData[] = [
      {
        section: {
          id: 'sec_1',
          title: '什么是二次函数',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['定义', '标准形式'],
          estimatedDuration: 5,
          hasQuiz: false,
        },
        chunks: [{ sectionId: 'sec_1', type: 'text', content: '二次函数是...', order: 0 }],
      },
      {
        section: {
          id: 'sec_2',
          title: '随堂测验',
          contentType: 'quiz',
          depth: 'intermediate',
          knowledgePoints: ['判断开口方向'],
          estimatedDuration: 5,
          hasQuiz: true,
        },
        chunks: [
          {
            sectionId: 'sec_2',
            type: 'quiz',
            content: '开口向上？',
            order: 0,
            question: '下列哪个函数开口向上？',
            options: ['y=x²', 'y=-x²'],
            correctAnswer: 0,
          },
        ],
      },
    ];

    const job = makeMockJob(sections);
    const result = buildOutlineOnlyResultFromTeachingJob(job, baseConfig);

    expect(result.outlines).toHaveLength(2);
    expect(result.outlines[0].type).toBe('slide');
    expect(result.outlines[1].type).toBe('quiz');
    expect(result.outlines[1].quizConfig).toBeDefined();
    expect(result.outlines[1].quizConfig!.questionCount).toBeGreaterThanOrEqual(1);
    expect(result.outlines[1].quizConfig!.difficulty).toBe('medium');
  });

  it('merges adjacent sparse teaching sections before classroom generation', () => {
    const sections: GeneratedSectionData[] = [
      {
        section: {
          id: 'sec_1',
          title: 'Definition',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['Core form'],
          estimatedDuration: 2,
          hasQuiz: false,
        },
        chunks: [{ sectionId: 'sec_1', type: 'text', content: 'Define the concept.', order: 0 }],
      },
      {
        section: {
          id: 'sec_2',
          title: 'Example',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['One example'],
          estimatedDuration: 2,
          hasQuiz: false,
        },
        chunks: [{ sectionId: 'sec_2', type: 'text', content: 'Show one example.', order: 0 }],
      },
    ];

    const job = makeMockJob(sections);
    const result = buildOutlineOnlyResultFromTeachingJob(job, baseConfig);

    expect(result.outlines).toHaveLength(1);
    expect(result.outlines[0].title).toBe('Definition / Example');
    expect(result.outlines[0].keyPoints).toEqual(['Core form', 'One example']);
    expect(result.outlines[0].order).toBe(1);
  });

  it('carries multimedia flags from config', () => {
    const sections: GeneratedSectionData[] = [
      {
        section: {
          id: 'sec_1',
          title: 'A',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['kp'],
          estimatedDuration: 3,
          hasQuiz: false,
        },
        chunks: [{ sectionId: 'sec_1', type: 'text', content: 'text', order: 0 }],
      },
    ];
    const job = makeMockJob(sections);
    const result = buildOutlineOnlyResultFromTeachingJob(job, {
      ...baseConfig,
      enableTTS: true,
      enableImageGeneration: true,
      enableVideoGeneration: true,
    });

    expect(result.enableTTS).toBe(true);
    expect(result.enableImageGeneration).toBe(true);
    expect(result.enableVideoGeneration).toBe(true);
  });

  it('sets stage agentIds from selected teacher and students', () => {
    const sections: GeneratedSectionData[] = [
      {
        section: {
          id: 'sec_1',
          title: 'A',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['kp'],
          estimatedDuration: 3,
          hasQuiz: false,
        },
        chunks: [],
      },
    ];
    const job = makeMockJob(sections);
    const result = buildOutlineOnlyResultFromTeachingJob(job, {
      ...baseConfig,
      selectedStudentIds: ['default-3', 'default-4', 'default-5'],
    });

    expect(result.stage.agentIds).toEqual(['default-1', 'default-3', 'default-4', 'default-5']);
    expect(result.agents.map((a) => a.id)).toEqual([
      'default-1',
      'default-3',
      'default-4',
      'default-5',
    ]);
  });

  it('falls back description to title when no text chunk exists', () => {
    const sections: GeneratedSectionData[] = [
      {
        section: {
          id: 'sec_1',
          title: '只有标题的节',
          contentType: 'diagram',
          depth: 'intermediate',
          knowledgePoints: ['kp'],
          estimatedDuration: 3,
          hasQuiz: false,
        },
        chunks: [{ sectionId: 'sec_1', type: 'diagram', content: 'diagram content', order: 0 }],
      },
    ];
    const job = makeMockJob(sections);
    const result = buildOutlineOnlyResultFromTeachingJob(job, baseConfig);
    expect(result.outlines[0].description).toBe('只有标题的节');
  });

  it('enriches outline keyPoints from structured content', () => {
    const sections: GeneratedSectionData[] = [
      {
        section: {
          id: 'sec_1',
          title: '概念讲解',
          contentType: 'explanation',
          depth: 'intermediate',
          knowledgePoints: ['原知识点'],
          estimatedDuration: 3,
          hasQuiz: false,
        },
        chunks: [{ sectionId: 'sec_1', type: 'text', content: 'text', order: 0 }],
        structured: {
          type: 'concept',
          title: '概念',
          cards: [
            { title: '定义', desc: '这是定义说明' },
            { title: '性质', desc: '这是性质说明' },
          ],
        },
      },
    ];
    const job = makeMockJob(sections);
    const result = buildOutlineOnlyResultFromTeachingJob(job, baseConfig);
    expect(result.outlines[0].keyPoints).toContain('定义：这是定义说明');
    expect(result.outlines[0].keyPoints).toContain('性质：这是性质说明');
  });
});

describe('recommendAgentsFromLessonPlan', () => {
  it('defaults to teacher-1 + curious + analytical students', () => {
    const rec = recommendAgentsFromLessonPlan(
      { title: '未知主题', sections: [], estimatedDuration: 10, focusPoints: [] },
      [],
    );
    expect(rec.teacherId).toBe('default-1');
    expect(rec.studentIds).toContain('default-3');
    expect(rec.studentIds).toContain('default-4');
  });

  it('adds creative student for math/science/code topics', () => {
    const rec = recommendAgentsFromLessonPlan(
      { title: 'Python 编程', sections: [], estimatedDuration: 10, focusPoints: [] },
      [],
    );
    expect(rec.studentIds).toContain('default-5');
  });

  it('adds note-taker for language/humanities topics', () => {
    const rec = recommendAgentsFromLessonPlan(
      { title: '英语语法', sections: [], estimatedDuration: 10, focusPoints: [] },
      [],
    );
    expect(rec.studentIds).toContain('default-6');
  });

  it('adds cool student for long lessons', () => {
    const sections = Array.from({ length: 6 }, (_, i) => ({
      section: {
        id: `s${i}`,
        title: `节 ${i}`,
        contentType: 'explanation' as const,
        depth: 'intermediate' as const,
        knowledgePoints: ['kp'],
        estimatedDuration: 5,
        hasQuiz: false,
      },
      chunks: [],
    }));
    const rec = recommendAgentsFromLessonPlan(
      { title: '长课程', sections: [], estimatedDuration: 10, focusPoints: [] },
      sections,
    );
    expect(rec.studentIds).toContain('default-7');
  });
});
