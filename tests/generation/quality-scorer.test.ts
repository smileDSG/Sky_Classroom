import { describe, expect, it } from 'vitest';
import {
  scoreSlideContent,
  scoreQuizContent,
  scoreInteractiveContent,
  scorePBLContent,
  scoreContent,
  isAcceptable,
} from '@/lib/generation/quality-scorer';
import type {
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
} from '@/lib/types/generation';

describe('scoreSlideContent', () => {
  it('scores a well-formed slide highly', () => {
    const content: GeneratedSlideContent = {
      elements: [
        { id: 't1', type: 'text', left: 80, top: 50, width: 840, height: 80, content: 'Title' },
        { id: 's1', type: 'shape', left: 100, top: 150, width: 200, height: 200, fill: '#5b9bd5' },
        { id: 'img1', type: 'image', left: 400, top: 150, width: 300, height: 200, src: 'img_1' },
      ] as GeneratedSlideContent['elements'],
      background: { type: 'solid', color: '#ffffff' },
      remark: 'This slide introduces the topic with a diagram and supporting image.',
    };

    const score = scoreSlideContent(content);

    expect(score.overall).toBeGreaterThan(0.6);
    expect(score.completeness).toBeGreaterThan(0.7);
    expect(score.elementDiversity).toBeGreaterThan(0);
    expect(score.issues).toHaveLength(0);
  });

  it('flags empty elements', () => {
    const content: GeneratedSlideContent = {
      elements: [],
      background: { type: 'solid', color: '#fff' },
      remark: 'Some remark text for the slide content',
    };

    const score = scoreSlideContent(content);
    expect(score.issues).toContain('No slide elements generated');
    expect(score.completeness).toBeLessThan(1);
  });

  it('flags missing or short remark', () => {
    const content: GeneratedSlideContent = {
      elements: [
        { id: 't1', type: 'text', left: 80, top: 50, width: 840, height: 80, content: 'Hi' },
      ] as GeneratedSlideContent['elements'],
      background: { type: 'solid', color: '#fff' },
      remark: '',
    };

    const score = scoreSlideContent(content);
    expect(score.warnings).toContain('Remark is missing or too short');
  });

  it('flags off-canvas elements', () => {
    const content: GeneratedSlideContent = {
      elements: [
        { id: 't1', type: 'text', left: -200, top: 50, width: 100, height: 50, content: 'Off' },
        { id: 't2', type: 'text', left: 1200, top: 50, width: 100, height: 50, content: 'Far' },
      ] as GeneratedSlideContent['elements'],
      background: { type: 'solid', color: '#fff' },
      remark: 'Off-canvas test slide content for verification',
    };

    const score = scoreSlideContent(content);
    expect(score.coherence).toBeLessThan(0.8);
    expect(score.issues.some((i) => i.includes('off-canvas'))).toBe(true);
  });

  it('flags elements with nearly identical positions as overlapping', () => {
    const elements = Array.from({ length: 4 }, (_, i) => ({
      id: `e${i}`,
      type: 'text' as const,
      left: 100,
      top: 100,
      width: 50,
      height: 50,
      content: `Item ${i}`,
    }));

    const content: GeneratedSlideContent = {
      elements: elements as GeneratedSlideContent['elements'],
      background: { type: 'solid', color: '#fff' },
      remark: 'Overlapping elements test slide content here',
    };

    const score = scoreSlideContent(content);
    expect(score.coherence).toBeLessThan(0.8);
    expect(score.issues.some((i) => i.includes('identical positions'))).toBe(true);
  });
});

describe('scoreQuizContent', () => {
  it('scores a well-formed quiz highly', () => {
    const content: GeneratedQuizContent = {
      questions: [
        {
          id: 'q1',
          question: 'What is 2+2?',
          type: 'single',
          options: [
            { label: '3', value: 'A' },
            { label: '4', value: 'B' },
            { label: '5', value: 'C' },
            { label: '6', value: 'D' },
          ],
          answer: ['B'],
        },
        {
          id: 'q2',
          question: 'Which are prime?',
          type: 'multiple',
          options: [
            { label: '2', value: 'A' },
            { label: '3', value: 'B' },
            { label: '4', value: 'C' },
            { label: '5', value: 'D' },
          ],
          answer: ['A', 'B', 'D'],
        },
      ],
    };

    const score = scoreQuizContent(content);
    expect(score.overall).toBeGreaterThan(0.6);
    expect(score.completeness).toBe(1);
    expect(score.issues).toHaveLength(0);
  });

  it('flags empty questions', () => {
    const content: GeneratedQuizContent = { questions: [] };
    const score = scoreQuizContent(content);

    expect(score.completeness).toBe(0);
    expect(score.issues).toContain('No quiz questions generated');
  });

  it('flags questions with too few options', () => {
    const content: GeneratedQuizContent = {
      questions: [
        {
          id: 'q1',
          question: 'True or false?',
          type: 'single',
          options: [{ label: 'True', value: 'A' }],
          answer: ['A'],
        },
      ],
    };

    const score = scoreQuizContent(content);
    expect(score.coherence).toBeLessThan(0.9);
    expect(score.issues.some((i) => i.includes('fewer than 2 options'))).toBe(true);
  });

  it('flags missing answers', () => {
    const content: GeneratedQuizContent = {
      questions: [
        {
          id: 'q1',
          question: 'Test question with no answer',
          type: 'short_answer',
          options: [
            { label: 'a', value: 'A' },
            { label: 'b', value: 'B' },
          ],
          answer: [],
        },
      ],
    };

    const score = scoreQuizContent(content);
    expect(score.coherence).toBeLessThan(0.9);
    expect(score.issues.some((i) => i.includes('missing correct answer'))).toBe(true);
  });
});

describe('scoreInteractiveContent', () => {
  it('scores well-formed interactive content highly', () => {
    const content: GeneratedInteractiveContent = {
      html: '<!DOCTYPE html><html><head></head><body><div id="app">Simulation widget with interactive controls and detailed content</div></body></html>',
      widgetType: 'simulation',
      widgetConfig: {
        type: 'simulation' as const,
        concept: 'physics',
        description: 'A simulation of gravity',
        variables: [],
      },
      teacherActions: [{ id: 'a1', type: 'speech' as const, content: 'Welcome' }],
    };

    const score = scoreInteractiveContent(content);
    expect(score.overall).toBeGreaterThan(0.5);
    expect(score.completeness).toBeGreaterThan(0.7);
  });

  it('flags minimal or missing HTML', () => {
    const content: GeneratedInteractiveContent = {
      html: '<p>short</p>',
      widgetType: 'game',
      widgetConfig: {
        type: 'game' as const,
        gameType: 'quiz' as const,
        description: 'A test game',
        scoring: { correctPoints: 10 },
      },
      teacherActions: [],
    };

    const score = scoreInteractiveContent(content);
    expect(score.completeness).toBeLessThan(0.7);
    expect(score.issues.some((i) => i.includes('minimal HTML'))).toBe(true);
  });

  it('flags missing widget config', () => {
    const content = {
      html: '<!DOCTYPE html><html><head></head><body>Long enough content for the interactive widget test validation</body></html>',
    } as GeneratedInteractiveContent;

    const score = scoreInteractiveContent(content);

    expect(score.warnings.some((w) => w.includes('widgetType'))).toBe(true);
    expect(score.warnings.some((w) => w.includes('widgetConfig'))).toBe(true);
  });
});

describe('scorePBLContent', () => {
  it('scores well-formed PBL content highly', () => {
    const content: GeneratedPBLContent = {
      projectConfig: {
        projectInfo: { title: 'Build a Bridge', description: 'Engineering challenge' },
        agents: [
          {
            name: 'Engineer',
            actor_role: 'specialist',
            role_division: 'development' as const,
            system_prompt: 'You are an engineer',
            default_mode: 'chat',
            delay_time: 0,
            env: {},
            is_user_role: false,
            is_active: true,
            is_system_agent: false,
          },
          {
            name: 'PM',
            actor_role: 'coordinator',
            role_division: 'management' as const,
            system_prompt: 'You are a PM',
            default_mode: 'chat',
            delay_time: 0,
            env: {},
            is_user_role: false,
            is_active: true,
            is_system_agent: false,
          },
        ],
        issueboard: {
          agent_ids: ['Engineer', 'PM'],
          issues: [],
          current_issue_id: null,
        },
        chat: { messages: [] },
      },
    };

    const score = scorePBLContent(content);
    expect(score.completeness).toBeGreaterThan(0.5);
    expect(score.issues).toHaveLength(0);
  });

  it('flags missing projectConfig entirely', () => {
    const content = {} as GeneratedPBLContent;
    const score = scorePBLContent(content);

    expect(score.completeness).toBe(0);
    expect(score.issues).toContain('No projectConfig in PBL content');
  });

  it('flags missing agents', () => {
    const content = {
      projectConfig: {
        projectInfo: { title: 'Solo Project', description: '' },
        agents: [],
      },
    } as unknown as GeneratedPBLContent;

    const score = scorePBLContent(content);
    expect(score.issues.some((i) => i.includes('no agents'))).toBe(true);
  });
});

describe('scoreContent (dispatcher)', () => {
  it('routes to slide scorer for slide type', () => {
    const content: GeneratedSlideContent = {
      elements: [],
      background: { type: 'solid', color: '#fff' },
      remark: 'Test remark text',
    };
    const score = scoreContent({ type: 'slide', content });
    expect(score.issues).toContain('No slide elements generated');
  });

  it('routes to quiz scorer for quiz type', () => {
    const content: GeneratedQuizContent = { questions: [] };
    const score = scoreContent({ type: 'quiz', content });
    expect(score.completeness).toBe(0);
  });
});

describe('isAcceptable', () => {
  it('accepts scores above threshold', () => {
    const score = {
      overall: 0.8,
      completeness: 0.9,
      coherence: 0.7,
      elementDiversity: 0.5,
      issues: [],
      warnings: [],
    };
    expect(isAcceptable(score)).toBe(true);
  });

  it('rejects scores below default threshold (0.4)', () => {
    const score = {
      overall: 0.3,
      completeness: 0.2,
      coherence: 0.5,
      elementDiversity: 0.1,
      issues: ['major issues'],
      warnings: [],
    };
    expect(isAcceptable(score)).toBe(false);
  });

  it('respects custom threshold', () => {
    const score = {
      overall: 0.5,
      completeness: 0.5,
      coherence: 0.5,
      elementDiversity: 0.5,
      issues: [],
      warnings: [],
    };
    expect(isAcceptable(score, 0.6)).toBe(false);
    expect(isAcceptable(score, 0.4)).toBe(true);
  });

  it('rejects when completeness is below threshold even if overall is OK', () => {
    const score = {
      overall: 0.7,
      completeness: 0.1,
      coherence: 0.9,
      elementDiversity: 0.9,
      issues: [],
      warnings: [],
    };
    expect(isAcceptable(score)).toBe(false);
  });
});
