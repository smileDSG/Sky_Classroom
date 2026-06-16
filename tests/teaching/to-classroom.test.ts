/**
 * Teaching → Classroom Converter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  convertTeachingJobToStage,
  convertSectionToScenes,
} from '@/lib/teaching/to-classroom';
import type { TeachingJob, GeneratedSectionData } from '@/lib/server/teaching-job-store';
import type { LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';

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
      focusPoints: ['二次函数'],
    },
    sections: [],
    ...overrides,
  };
}

function makeSection(
  title: string,
  contentType: LessonSection['contentType'],
  chunks: ContentChunk[],
): GeneratedSectionData {
  return {
    section: {
      id: `sec-${title}`,
      title,
      contentType,
      depth: 'intermediate',
      knowledgePoints: ['二次函数'],
      estimatedDuration: 5,
      hasQuiz: contentType === 'quiz',
    },
    chunks,
  };
}

describe('convertTeachingJobToStage', () => {
  it('creates stage with cover and end slides for empty job', () => {
    const job = makeJob();
    const { stage, scenes } = convertTeachingJobToStage(job);

    expect(stage.name).toBe('二次函数精讲');
    expect(scenes.length).toBeGreaterThanOrEqual(2); // cover + end
    expect(scenes[0].type).toBe('slide');
    expect(scenes[scenes.length - 1].type).toBe('slide');
    expect(scenes[scenes.length - 1].title).toBe('结束');
  });

  it('converts text sections to slide scenes', () => {
    const job = makeJob({
      sections: [
        makeSection('基础概念', 'explanation', [
          {
            sectionId: 'sec-1',
            type: 'text',
            content: '二次函数的一般形式为 y = ax² + bx + c。',
            order: 0,
          },
        ]),
      ],
    });
    const { scenes } = convertTeachingJobToStage(job);
    expect(scenes.length).toBeGreaterThanOrEqual(3); // cover + content + end
    const contentScene = scenes.find((s) => s.title === '基础概念');
    expect(contentScene).toBeDefined();
    expect(contentScene?.type).toBe('slide');
  });

  it('converts quiz sections to quiz scenes', () => {
    const job = makeJob({
      sections: [
        makeSection('随堂检测', 'quiz', [
          {
            sectionId: 'sec-1',
            type: 'quiz',
            content: '以下哪个是二次函数？',
            order: 0,
            question: '以下哪个是二次函数？',
            options: ['y = x', 'y = x²', 'y = 1/x'],
            correctAnswer: 1,
          },
        ]),
      ],
    });
    const { scenes } = convertTeachingJobToStage(job);
    const quizScene = scenes.find((s) => s.title === '随堂检测');
    expect(quizScene).toBeDefined();
    expect(quizScene?.type).toBe('quiz');
    if (quizScene && quizScene.content.type === 'quiz') {
      expect(quizScene.content.questions.length).toBe(1);
      expect(quizScene.content.questions[0].options?.length).toBe(3);
      expect(quizScene.content.questions[0].answer).toContain('B');
    }
  });

  it('converts formula chunks to latex elements', () => {
    const job = makeJob({
      sections: [
        makeSection('公式推导', 'explanation', [
          {
            sectionId: 'sec-1',
            type: 'formula',
            content: '顶点坐标公式：\\\\(x = -\\frac{b}{2a}\\\\)',
            order: 0,
          },
        ]),
      ],
    });
    const { scenes } = convertTeachingJobToStage(job);
    const formulaScene = scenes.find((s) => s.title === '公式推导');
    expect(formulaScene).toBeDefined();
    if (formulaScene && formulaScene.content.type === 'slide') {
      const hasLatex = formulaScene.content.canvas.elements.some((el) => el.type === 'latex');
      expect(hasLatex).toBe(true);
    }
  });

  it('paginates long text into multiple slides', () => {
    const longText = '这是一个很长的句子。'.repeat(30);
    const job = makeJob({
      sections: [
        makeSection('长篇讲解', 'explanation', [
          {
            sectionId: 'sec-1',
            type: 'text',
            content: longText,
            order: 0,
          },
        ]),
      ],
    });
    const { scenes } = convertTeachingJobToStage(job);
    // Should have cover + at least 2 content slides + end
    const contentScenes = scenes.filter((s) => s.title.startsWith('长篇讲解'));
    expect(contentScenes.length).toBeGreaterThanOrEqual(2);
  });

  it('converts example chunks with styled box', () => {
    const job = makeJob({
      sections: [
        makeSection('例题精讲', 'example', [
          {
            sectionId: 'sec-1',
            type: 'example',
            content: '已知二次函数 y = x² - 4x + 3，求顶点坐标。',
            order: 0,
          },
        ]),
      ],
    });
    const { scenes } = convertTeachingJobToStage(job);
    const exampleScene = scenes.find((s) => s.title === '例题精讲');
    expect(exampleScene).toBeDefined();
    if (exampleScene && exampleScene.content.type === 'slide') {
      const exampleEl = exampleScene.content.canvas.elements.find(
        (el) => el.type === 'text' && (el as any).fill === '#f0f9ff',
      );
      expect(exampleEl).toBeDefined();
    }
  });
});

describe('convertSectionToScenes', () => {
  it('returns empty array for empty chunks', () => {
    const section = makeSection('空章节', 'explanation', []);
    const scenes = convertSectionToScenes(section, 'stage-1', 0);
    // Title-only slides are skipped, so empty chunks produce nothing
    expect(scenes.length).toBe(0);
  });

  it('skips failed chunks', () => {
    const section = makeSection('含失败', 'explanation', [
      {
        sectionId: 'sec-1',
        type: 'text',
        content: '正常内容',
        order: 0,
      },
      {
        sectionId: 'sec-1',
        type: 'text',
        content: '失败内容',
        order: 1,
        failed: true,
      },
    ]);
    const scenes = convertSectionToScenes(section, 'stage-1', 0);
    expect(scenes.length).toBeGreaterThan(0);
    if (scenes[0].content.type === 'slide') {
      const textEls = scenes[0].content.canvas.elements.filter((el) => el.type === 'text');
      // Title + one body element
      expect(textEls.length).toBe(2);
    }
  });
});
