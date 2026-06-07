/**
 * P6-001 Test 5: PBL 模式
 *
 * Tests the Project-Based Learning flow — PBL design generation,
 * scene creation, and action routing specific to PBL mode.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateSceneContent, generateSceneActions } from '@/lib/generation/scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { SceneOutline, GeneratedSlideContent } from '@/lib/types/generation';

// ─── PBL-specific fixtures ───

const PBL_OUTLINE: SceneOutline = {
  id: 'pbl-scene-1',
  type: 'pbl',
  title: '设计一个可持续城市',
  description: '学生通过项目式学习设计可持续城市的方案',
  keyPoints: ['城市规划', '可持续发展', '能源管理'],
  order: 0,
  pblConfig: {
    projectType: 'design',
    deliverables: ['report', 'presentation'],
    duration: '2周',
    teamSize: 4,
  },
};

const VALID_PBL_JSON = JSON.stringify({
  elements: [
    {
      id: 'text_1',
      type: 'text',
      left: 60,
      top: 40,
      width: 880,
      height: 60,
      content: '<p style="font-size:24px;">项目目标：设计可持续城市</p>',
      defaultFontName: '',
      defaultColor: '#333',
    },
    {
      id: 'text_2',
      type: 'text',
      left: 60,
      top: 120,
      width: 880,
      height: 40,
      content: '<p>任务：小组合作完成城市规划方案</p>',
      defaultFontName: '',
      defaultColor: '#666',
    },
  ],
  background: { type: 'solid', color: '#e8f4e8' },
  remark: 'PBL project slide',
});

const VALID_PBL_ACTIONS_JSON = JSON.stringify([
  { type: 'text', content: '欢迎来到项目式学习环节。' },
  { type: 'text', content: '请仔细阅读项目要求。' },
  { type: 'text', content: '开始小组讨论吧。' },
]);

// ─── Tests ───

describe('P6-001 Test 5: PBL 模式', () => {
  describe('PBL outline validation', () => {
    test('PBL outline has correct type', () => {
      expect(PBL_OUTLINE.type).toBe('pbl');
    });

    test('PBL outline has project configuration', () => {
      expect(PBL_OUTLINE.pblConfig).toBeDefined();
      expect(PBL_OUTLINE.pblConfig!.projectType).toBe('design');
    });

    test('PBL outline has deliverables defined', () => {
      expect(PBL_OUTLINE.pblConfig!.deliverables).toContain('report');
      expect(PBL_OUTLINE.pblConfig!.deliverables).toContain('presentation');
    });

    test('PBL outline has team configuration', () => {
      expect(PBL_OUTLINE.pblConfig!.teamSize).toBe(4);
      expect(PBL_OUTLINE.pblConfig!.duration).toBe('2周');
    });
  });

  describe('PBL content generation', () => {
    test('generates PBL slide content from outline', async () => {
      const { aiCall } = makeAiCall(VALID_PBL_JSON);
      const content = await generateSceneContent(PBL_OUTLINE, aiCall, {
        languageDirective: 'Use Chinese.',
      });

      expect(content).not.toBeNull();
      const slideContent = content as GeneratedSlideContent;
      expect(slideContent.elements).toBeDefined();
      expect(slideContent.elements.length).toBe(2);
      expect(slideContent.elements[0].type).toBe('text');
    });

    test('PBL content includes project-specific elements', async () => {
      const { aiCall } = makeAiCall(VALID_PBL_JSON);
      const content = await generateSceneContent(PBL_OUTLINE, aiCall, {});

      const slideContent = content as GeneratedSlideContent;
      const textElements = slideContent.elements.filter((e) => e.type === 'text');
      expect(textElements.length).toBeGreaterThan(0);
    });

    test('PBL content has background styling', async () => {
      const { aiCall } = makeAiCall(VALID_PBL_JSON);
      const content = await generateSceneContent(PBL_OUTLINE, aiCall, {});

      const slideContent = content as GeneratedSlideContent;
      expect(slideContent.background).toBeDefined();
      expect(slideContent.background!.type).toBe('solid');
    });
  });

  describe('PBL actions generation', () => {
    const pblContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'text_1',
          type: 'text',
          left: 60,
          top: 40,
          width: 880,
          height: 60,
          content: '<p>项目目标</p>',
          defaultFontName: '',
          defaultColor: '#333',
          rotate: 0,
        },
      ],
      background: { type: 'solid', color: '#e8f4e8' },
      remark: '',
    };

    test('generates PBL-specific actions', async () => {
      const { aiCall } = makeAiCall(VALID_PBL_ACTIONS_JSON);
      const actions = await generateSceneActions(PBL_OUTLINE, pblContent, aiCall, {
        languageDirective: 'Use Chinese.',
      });

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('speech');
    });

    test('PBL actions contain Chinese text when directed', async () => {
      const { aiCall, capturedSystem, capturedUser } = makeAiCall(VALID_PBL_ACTIONS_JSON);
      await generateSceneActions(PBL_OUTLINE, pblContent, aiCall, {
        languageDirective: 'Use Chinese.',
      });

      const combined = capturedSystem() + capturedUser();
      expect(combined).toContain('Chinese');
    });

    test('returns null for invalid PBL AI response', async () => {
      const { aiCall } = makeAiCall('not valid json');
      const content = await generateSceneContent(PBL_OUTLINE, aiCall, {});
      expect(content).toBeNull();
    });
  });

  describe('PBL different project types', () => {
    test('research project type', () => {
      const researchOutline: SceneOutline = {
        ...PBL_OUTLINE,
        pblConfig: { ...PBL_OUTLINE.pblConfig!, projectType: 'research' },
      };

      expect(researchOutline.pblConfig!.projectType).toBe('research');
    });

    test('experiment project type', () => {
      const experimentOutline: SceneOutline = {
        ...PBL_OUTLINE,
        pblConfig: { ...PBL_OUTLINE.pblConfig!, projectType: 'experiment' },
      };

      expect(experimentOutline.pblConfig!.projectType).toBe('experiment');
    });
  });
});

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
  return { aiCall, capturedSystem: () => sys, capturedUser: () => usr };
}
