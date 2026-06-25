import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { Action } from '@/lib/types/action';
import type {
  GeneratedQuizContent,
  GeneratedSlideContent,
  SceneOutline,
} from '@/lib/types/generation';
import type { Scene } from '@/lib/types/stage';

const sceneGeneratorMocks = vi.hoisted(() => ({
  generateSceneContent: vi.fn(),
  generateSceneActions: vi.fn(),
  createSceneWithActions: vi.fn(),
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  isProviderKeyRequired: vi.fn(() => false),
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModel: vi.fn(async () => ({
    model: {},
    modelInfo: { outputWindow: 4096 },
    modelString: 'mock:model',
    providerId: 'mock',
    apiKey: undefined,
    keyPool: [],
  })),
}));

vi.mock('@/lib/generation/outline-generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/generation/outline-generator')>(
    '@/lib/generation/outline-generator',
  );

  return {
    ...actual,
    generateSceneOutlinesFromRequirements: vi.fn(),
  };
});

vi.mock('@/lib/generation/scene-generator', () => sceneGeneratorMocks);

vi.mock('@/lib/server/classroom-storage', () => ({
  persistClassroom: vi.fn(async ({ id }: { id: string }) => ({
    id,
    url: `http://localhost/classroom/${id}`,
    createdAt: '2026-06-24T00:00:00.000Z',
  })),
}));

import {
  generateClassroomContinue,
  type ClassroomGenerationProgress,
  type OutlineOnlyResult,
} from '@/lib/server/classroom-generation';

const outlines: SceneOutline[] = [
  {
    id: 'scene-1',
    type: 'slide',
    title: 'Intro',
    description: 'Intro scene',
    keyPoints: ['A'],
    order: 1,
  },
  {
    id: 'scene-2',
    type: 'quiz',
    title: 'Check',
    description: 'Check scene',
    keyPoints: ['B'],
    order: 2,
    quizConfig: { questionCount: 1, difficulty: 'easy', questionTypes: ['single'] },
  },
];

const slideContent: GeneratedSlideContent = {
  elements: [],
  background: undefined,
  remark: '',
};

const quizContent: GeneratedQuizContent = {
  questions: [],
  knowledgePoints: [],
};

function savedOutlineResult(): OutlineOnlyResult {
  return {
    outlines,
    languageDirective: 'Use English.',
    agents: [],
    stage: {
      id: 'stage-1',
      name: 'Test stage',
      style: 'interactive',
      createdAt: 1,
      updatedAt: 1,
    },
    requirement: 'Teach a test lesson',
    enableImageGeneration: false,
    enableVideoGeneration: false,
    enableTTS: false,
  };
}

describe('classroom generation progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sceneGeneratorMocks.generateSceneContent.mockImplementation(async (outline: SceneOutline) =>
      outline.type === 'quiz' ? quizContent : slideContent,
    );
    sceneGeneratorMocks.generateSceneActions.mockResolvedValue([]);
    sceneGeneratorMocks.createSceneWithActions.mockImplementation(
      (
        outline: SceneOutline,
        _content: unknown,
        actions: Action[],
        api: { scene: { create: (scene: Partial<Scene>) => { success: boolean; data?: string } } },
      ) => {
        const result = api.scene.create({
          type: outline.type,
          title: outline.title,
          order: outline.order,
          content:
            outline.type === 'quiz'
              ? { type: 'quiz', questions: [], knowledgePoints: [] }
              : {
                  type: 'slide',
                  canvas: {
                    id: `slide-${outline.id}`,
                    viewportSize: 1000,
                    viewportRatio: 0.5625,
                    elements: [],
                  },
                },
          actions,
        } as Partial<Scene>);

        return result.success ? (result.data ?? null) : null;
      },
    );
  });

  test('reports second-stage progress before the first scene is created', async () => {
    const onProgress = vi.fn((_progress: ClassroomGenerationProgress) => {});

    await generateClassroomContinue(savedOutlineResult(), {
      baseUrl: 'http://localhost',
      onProgress,
    });

    const firstSceneCreateOrder =
      sceneGeneratorMocks.createSceneWithActions.mock.invocationCallOrder[0];
    const progressBeforeFirstScene = onProgress.mock.calls
      .map(([progress], index) => ({
        progress,
        order: onProgress.mock.invocationCallOrder[index],
      }))
      .filter((entry) => entry.order < firstSceneCreateOrder)
      .map((entry) => entry.progress.progress);

    expect(progressBeforeFirstScene).toContain(31);
    expect(progressBeforeFirstScene.some((progress) => progress > 31)).toBe(true);
  });
});
