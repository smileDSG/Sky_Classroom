/**
 * Phase 2 (B-003): Generation pipeline integration tests
 *
 * Tests the full outline→content→actions pipeline with mocked AICallFn.
 * Validates that language directives flow through and that generated
 * content can be parsed correctly at each stage.
 */
import { describe, test, expect } from 'vitest';
import { generateSceneContent, generateSceneActions } from '@/lib/generation/scene-generator';
import { applyOutlineFallbacks } from '@/lib/generation/outline-generator';
import { buildSceneFromOutline } from '@/lib/generation/scene-builder';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type {
  SceneOutline,
  GeneratedSlideContent,
  GeneratedQuizContent,
} from '@/lib/types/generation';

// ─── Helpers ───

function makeAiCall(response: string): {
  aiCall: AICallFn;
  capturedSystem: () => string;
  capturedUser: () => string;
} {
  let sys = '';
  let usr = '';
  const aiCall: AICallFn = async (system, user) => {
    sys = system;
    usr = user;
    return response;
  };
  return {
    aiCall,
    capturedSystem: () => sys,
    capturedUser: () => usr,
  };
}

function baseSlideOutline(overrides: Partial<SceneOutline> = {}): SceneOutline {
  return {
    id: 'scene-1',
    type: 'slide',
    title: 'Test Slide',
    description: 'A test slide scene.',
    keyPoints: ['point a', 'point b'],
    order: 0,
    ...overrides,
  };
}

const VALID_SLIDE_JSON = JSON.stringify({
  elements: [
    {
      id: 'text_1',
      type: 'text',
      left: 60,
      top: 80,
      width: 880,
      height: 76,
      content: '<p style="font-size:24px;">Test Title</p>',
      defaultFontName: '',
      defaultColor: '#333',
    },
  ],
  background: { type: 'solid', color: '#ffffff' },
  remark: '',
});

const VALID_QUIZ_JSON = JSON.stringify([
  {
    id: 'q1',
    type: 'single',
    question: 'What is the answer?',
    options: [
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
    ],
    answer: ['A'],
    analysis: 'Explanation',
    points: 10,
  },
]);

const VALID_ACTIONS_JSON = JSON.stringify([
  { type: 'text', content: 'Welcome to this lesson.' },
  { type: 'text', content: 'Let us begin.' },
]);

// ─── Content Generation ───

describe('generate pipeline: content', () => {
  test('generates slide content from outline', async () => {
    const { aiCall, capturedSystem, capturedUser } = makeAiCall(VALID_SLIDE_JSON);
    const content = await generateSceneContent(
      baseSlideOutline({ type: 'slide' }),
      aiCall,
      { languageDirective: 'Use Chinese.' },
    );

    expect(content).not.toBeNull();
    const slideContent = content as GeneratedSlideContent;
    expect(slideContent.elements).toBeDefined();
    expect(slideContent.elements.length).toBeGreaterThan(0);
    expect(slideContent.elements[0].type).toBe('text');

    // Language directive should be in the prompt
    const combined = capturedSystem() + capturedUser();
    expect(combined).toContain('Use Chinese');
  });

  test('generates quiz content from outline', async () => {
    const { aiCall } = makeAiCall(VALID_QUIZ_JSON);
    const content = await generateSceneContent(
      baseSlideOutline({
        type: 'quiz',
        quizConfig: { questionCount: 1, difficulty: 'easy', questionTypes: ['single'] },
      }),
      aiCall,
      { languageDirective: 'Use Chinese.' },
    );

    expect(content).not.toBeNull();
    const quizContent = content as GeneratedQuizContent;
    expect(quizContent.questions).toBeDefined();
    expect(quizContent.questions.length).toBe(1);
  });

  test('returns null for invalid AI response', async () => {
    const { aiCall } = makeAiCall('not valid json {{');
    const content = await generateSceneContent(
      baseSlideOutline(),
      aiCall,
      {},
    );
    expect(content).toBeNull();
  });

  test('applyOutlineFallbacks does not throw for valid outline', () => {
    const outline = baseSlideOutline();
    const result = applyOutlineFallbacks(outline, true);
    expect(result).toBeDefined();
    expect(result.id).toBe('scene-1');
  });
});

// ─── Actions Generation ───

describe('generate pipeline: actions', () => {
  const slideContent: GeneratedSlideContent = {
    elements: [
      {
        id: 'text_1',
        type: 'text',
        left: 60,
        top: 80,
        width: 880,
        height: 76,
        content: '<p>Test</p>',
        defaultFontName: '',
        defaultColor: '#333',
        rotate: 0,
      },
    ],
    background: undefined,
    remark: '',
  };

  test('generates slide actions', async () => {
    const { aiCall, capturedSystem, capturedUser } = makeAiCall(VALID_ACTIONS_JSON);
    const actions = await generateSceneActions(
      baseSlideOutline({ type: 'slide' }),
      slideContent,
      aiCall,
      { languageDirective: 'Use Chinese.' },
    );

    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].type).toBe('speech');
    expect('text' in actions[0]).toBe(true);

    const combined = capturedSystem() + capturedUser();
    expect(combined).toContain('Use Chinese');
  });

  test('generates quiz actions', async () => {
    const { aiCall } = makeAiCall(VALID_ACTIONS_JSON);
    const quizData: GeneratedQuizContent = {
      questions: [
        {
          id: 'q1',
          type: 'single',
          question: 'x?',
          options: [{ value: 'A', label: 'yes' }],
          answer: ['A'],
          hasAnswer: true,
        },
      ],
    };

    const actions = await generateSceneActions(
      baseSlideOutline({ type: 'quiz' }),
      quizData,
      aiCall,
      { languageDirective: 'Use Chinese.' },
    );

    expect(actions.length).toBeGreaterThan(0);
  });
});

// ─── Scene Builder (high-level) ───

describe('generate pipeline: buildSceneFromOutline', () => {
  test('builds complete slide scene with mocked AI', async () => {
    let callCount = 0;
    const aiCall: AICallFn = async () => {
      callCount++;
      return callCount === 1 ? VALID_SLIDE_JSON : VALID_ACTIONS_JSON;
    };

    const scene = await buildSceneFromOutline(
      baseSlideOutline({ type: 'slide' }),
      aiCall,
      'stage-1',
    );

    expect(scene).not.toBeNull();
    expect(scene!.id).toBeDefined();
    expect(scene!.stageId).toBe('stage-1');
    expect(scene!.actions).toBeDefined();
    expect(scene!.actions!.length).toBeGreaterThan(0);
    expect(callCount).toBe(2); // content + actions
  });
});
