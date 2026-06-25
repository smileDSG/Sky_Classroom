import { describe, expect, it } from 'vitest';

import { generateSlideContent } from '@/lib/generation/scene-content/slide-generator';
import { createSceneWithActions } from '@/lib/generation/scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { GeneratedSlideContent, SceneOutline } from '@/lib/types/generation';

function makeOutline(): SceneOutline {
  return {
    id: 'outline_1',
    type: 'slide',
    title: 'Gradient Descent',
    description: 'Introduce the basic update rule and intuition.',
    keyPoints: ['Loss surface', 'Gradient direction', 'Step size'],
    order: 1,
  };
}

function makeAiCall(response: string): {
  aiCall: AICallFn;
  lastSystem: () => string;
  lastUser: () => string;
} {
  let lastSystem = '';
  let lastUser = '';
  const aiCall: AICallFn = async (system, user) => {
    lastSystem = system;
    lastUser = user;
    return response;
  };
  return {
    aiCall,
    lastSystem: () => lastSystem,
    lastUser: () => lastUser,
  };
}

describe('OpenMAIC-first classroom slide generation', () => {
  it('does not inject theme directives, template data, or polish-generated layout elements', async () => {
    const aiResponse = JSON.stringify({
      background: { type: 'solid', color: '#ffffff' },
      elements: [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 50,
          width: 880,
          height: 76,
          content: '<p style="font-size:32px;"><strong>Gradient Descent</strong></p>',
          defaultFontName: '',
          defaultColor: '#333333',
        },
        {
          id: 'body',
          type: 'text',
          left: 60,
          top: 150,
          width: 880,
          height: 130,
          content:
            '<p style="font-size:18px;">- Loss surface</p><p style="font-size:18px;">- Gradient direction</p>',
          defaultFontName: '',
          defaultColor: '#333333',
        },
      ],
      remark: 'Explain gradient descent intuition.',
    });
    const { aiCall, lastSystem, lastUser } = makeAiCall(aiResponse);

    const result = await generateSlideContent(makeOutline(), aiCall);

    expect(result).not.toBeNull();
    expect(result?.templateData).toBeUndefined();
    expect(result?.elements).toHaveLength(2);
    expect(result?.elements.some((element) => element.id.startsWith('polish_'))).toBe(false);
    expect(lastUser()).not.toContain('Course Theme');
    expect(lastUser()).not.toContain('themeDirective');
    expect(lastSystem()).not.toContain('Slide Richness Contract');
  });

  it('creates classroom slide scenes with OpenMAIC defaults instead of template metadata', () => {
    type CreatedSlideScene = {
      content: {
        canvas: {
          theme: Record<string, unknown>;
          templateData?: unknown;
          layoutVersion?: unknown;
        };
      };
    };
    const createdScenes: CreatedSlideScene[] = [];
    const api = {
      scene: {
        create: (scene: CreatedSlideScene) => {
          createdScenes.push(scene);
          return { success: true, data: 'scene_1' };
        },
      },
    } as unknown as Parameters<typeof createSceneWithActions>[3];
    const content: GeneratedSlideContent = {
      background: { type: 'solid', color: '#ffffff' },
      elements: [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 50,
          width: 880,
          height: 76,
          content: '<p>Gradient Descent</p>',
        },
      ] as GeneratedSlideContent['elements'],
      templateData: {
        templateName: 'legacy-template',
        pageName: 'legacy-page',
        page: { elements: [] },
      } as unknown as GeneratedSlideContent['templateData'],
    };

    const sceneId = createSceneWithActions(makeOutline(), content, [], api);

    expect(sceneId).toBe('scene_1');
    const slide = createdScenes[0].content.canvas;
    expect(slide.theme).toMatchObject({
      backgroundColor: '#ffffff',
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
    });
    expect(slide.templateData).toBeUndefined();
    expect(slide.layoutVersion).toBeUndefined();
  });
});
