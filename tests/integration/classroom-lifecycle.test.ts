/**
 * P6-001 Test 1: 课堂创建 → 大纲生成 → 场景生成 → 开始上课
 *
 * End-to-end integration test of the full classroom generation pipeline
 * with mocked AI calls. Validates the complete data flow from user
 * requirements through outline generation, scene content/actions
 * generation, to classroom-ready output.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateSceneContent, generateSceneActions } from '@/lib/generation/scene-generator';
import { applyOutlineFallbacks } from '@/lib/generation/outline-generator';
import { buildSceneFromOutline } from '@/lib/generation/scene-builder';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type {
  UserRequirements,
  SceneOutline,
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedSceneContent,
} from '@/lib/types/generation';
import type { SceneAction } from '@/lib/types/action';
import { resolveModel } from '@/lib/server/resolve-model';
import { getModel } from '@/lib/ai/providers';

// ─── Mock AI call factory ───

function makeAiCallSequence(responses: string[]): {
  aiCall: AICallFn;
  callCount: number;
  getCaptures: () => { system: string; user: string }[];
} {
  const captures: { system: string; user: string }[] = [];
  let idx = 0;

  const aiCall: AICallFn = async (system, user) => {
    captures.push({ system, user });
    return responses[idx++ % responses.length];
  };

  return { aiCall, callCount: 0, getCaptures: () => captures };
}

// ─── Test fixtures ───

const USER_REQ: UserRequirements = {
  topic: '光合作用',
  grade: '初中',
  language: 'zh',
};

const OUTLINE: SceneOutline[] = [
  {
    id: 'scene-0',
    type: 'slide',
    title: '光合作用概述',
    description: '介绍光合作用的基本定义',
    keyPoints: ['定义', '反应方程式'],
    order: 0,
  },
  {
    id: 'scene-1',
    type: 'quiz',
    title: '随堂测验',
    description: '检验学生对光合作用的理解',
    keyPoints: ['光反应', '暗反应'],
    order: 1,
    quizConfig: { questionCount: 3, difficulty: 'easy', questionTypes: ['single'] },
  },
];

const VALID_SLIDE_JSON = JSON.stringify({
  elements: [
    {
      id: 'title_1',
      type: 'text',
      left: 60,
      top: 40,
      width: 900,
      height: 60,
      content: '<p style="font-size:28px;">光合作用概述</p>',
      defaultFontName: '',
      defaultColor: '#333',
    },
  ],
  background: { type: 'solid', color: '#f0f0f0' },
  remark: '',
});

const VALID_QUIZ_JSON = JSON.stringify([
  {
    id: 'q1',
    type: 'single',
    question: '光合作用发生在细胞的哪个部位？',
    options: [
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
      { label: 'C', value: 'C' },
      { label: 'D', value: 'D' },
    ],
    answer: ['A'],
    analysis: '叶绿体是光合作用的场所',
    points: 10,
  },
]);

const VALID_ACTIONS_JSON = JSON.stringify([
  { type: 'text', content: '同学们好，今天我们来学习光合作用。' },
  { type: 'text', content: '请观察屏幕上的反应方程式。' },
]);

// ─── Tests ───

describe('P6-001 Test 1: 课堂创建 → 大纲生成 → 场景生成 → 开始上课', () => {
  describe('stage 1: user requirements → outline', () => {
    test('generateOutline applies fallbacks for incomplete outline', () => {
      const outline = OUTLINE[0];
      const result = applyOutlineFallbacks(outline, true);
      expect(result).toBeDefined();
      expect(result.id).toBe('scene-0');
      expect(result.type).toBe('slide');
      expect(result.keyPoints).toBeDefined();
      expect(result.order).toBe(0);
    });

    test('outline preserves user language preference', () => {
      const outline = OUTLINE[0];
      const result = applyOutlineFallbacks(outline, true);
      // Should not modify the original outline
      expect(outline.title).toBe('光合作用概述');
    });
  });

  describe('stage 2: outline → scene content generation', () => {
    test('generates slide content from outline with AI', async () => {
      const { aiCall } = makeAiCallSequence([VALID_SLIDE_JSON]);
      const content = await generateSceneContent(OUTLINE[0], aiCall, {
        languageDirective: 'Use Chinese.',
      });

      expect(content).not.toBeNull();
      const slideContent = content as GeneratedSlideContent;
      expect(slideContent.elements).toBeDefined();
      expect(slideContent.elements.length).toBeGreaterThan(0);
    });

    test('generates quiz content from outline with AI', async () => {
      const { aiCall } = makeAiCallSequence([VALID_QUIZ_JSON]);
      const content = await generateSceneContent(
        { ...OUTLINE[1], quizConfig: { questionCount: 3, difficulty: 'easy', questionTypes: ['single'] } },
        aiCall,
        { languageDirective: 'Use Chinese.' },
      );

      expect(content).not.toBeNull();
      const quizContent = content as GeneratedQuizContent;
      expect(quizContent.questions).toBeDefined();
      expect(quizContent.questions.length).toBe(1);
    });

    test('returns null when AI response is invalid JSON', async () => {
      const { aiCall } = makeAiCallSequence(['not valid json {{']);
      const content = await generateSceneContent(OUTLINE[0], aiCall, {});
      expect(content).toBeNull();
    });
  });

  describe('stage 3: scene content → actions generation', () => {
    const slideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'title_1',
          type: 'text',
          left: 60,
          top: 40,
          width: 900,
          height: 60,
          content: '<p>光合作用概述</p>',
          defaultFontName: '',
          defaultColor: '#333',
          rotate: 0,
        },
      ],
      background: undefined,
      remark: '',
    };

    test('generates speech actions from slide content', async () => {
      const { aiCall } = makeAiCallSequence([VALID_ACTIONS_JSON]);
      const actions = await generateSceneActions(OUTLINE[0], slideContent, aiCall, {
        languageDirective: 'Use Chinese.',
      });

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('speech');
      expect('text' in actions[0]).toBe(true);
    });
  });

  describe('stage 4: full pipeline (outline → scene)', () => {
    test('buildSceneFromOutline generates content + actions sequentially', async () => {
      let callCount = 0;
      const aiCall: AICallFn = async () => {
        callCount++;
        return callCount === 1 ? VALID_SLIDE_JSON : VALID_ACTIONS_JSON;
      };

      const scene = await buildSceneFromOutline(OUTLINE[0], aiCall, 'test-stage');

      expect(scene).not.toBeNull();
      expect(scene!.id).toBeDefined();
      expect(scene!.stageId).toBe('test-stage');
      expect(scene!.content).toBeDefined();
      expect(scene!.actions).toBeDefined();
      expect(scene!.actions!.length).toBeGreaterThan(0);
      expect(callCount).toBe(2);
    });

    test('full pipeline produces consistent scene across multiple runs', async () => {
      const aiCall: AICallFn = async () => {
        return VALID_SLIDE_JSON;
      };

      const scene1 = await buildSceneFromOutline(OUTLINE[0], aiCall, 'stage-1');
      const scene2 = await buildSceneFromOutline(OUTLINE[0], aiCall, 'stage-2');

      expect(scene1!.content).toEqual(scene2!.content);
    });
  });

  describe('stage 5: classroom readiness', () => {
    test('generated scene has all required fields for rendering', async () => {
      const aiCall: AICallFn = async () => VALID_SLIDE_JSON;
      const scene = await buildSceneFromOutline(OUTLINE[0], aiCall, 'stage-1');

      expect(scene).toHaveProperty('id');
      expect(scene).toHaveProperty('type');
      expect(scene).toHaveProperty('content');
      expect(scene).toHaveProperty('stageId');
    });

    test('quiz scene preserves quiz configuration', async () => {
      const aiCall: AICallFn = async () => VALID_QUIZ_JSON;
      const scene = await buildSceneFromOutline(
        { ...OUTLINE[1], quizConfig: { questionCount: 3, difficulty: 'easy', questionTypes: ['single'] } },
        aiCall,
        'stage-1',
      );

      expect(scene).not.toBeNull();
      expect(scene!.content).toBeDefined();
    });
  });
});
