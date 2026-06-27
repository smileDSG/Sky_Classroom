import { describe, expect, it } from 'vitest';

import { generateSlideContent } from '@/lib/generation/scene-content/slide-generator';
import { generateSceneContent as generateOpenMaicMainSceneContent } from '@/lib/generation/openmaic-main-scene-generator';
import { createSceneWithActions } from '@/lib/generation/scene-generator';
import { auditSlideLayout } from '@/lib/slides/agent/layout-guard-agent';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { GeneratedSlideContent, SceneOutline } from '@/lib/types/generation';

function elementHeight(element: GeneratedSlideContent['elements'][number]): number {
  return Number((element as { height?: unknown }).height ?? 0);
}

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
  callCount: () => number;
} {
  let lastSystem = '';
  let lastUser = '';
  let callCount = 0;
  const aiCall: AICallFn = async (system, user) => {
    callCount += 1;
    lastSystem = system;
    lastUser = user;
    return response;
  };
  return {
    aiCall,
    lastSystem: () => lastSystem,
    lastUser: () => lastUser,
    callCount: () => callCount,
  };
}

function makeAiCallSequence(responses: string[]): {
  aiCall: AICallFn;
  users: () => string[];
  callCount: () => number;
} {
  const users: string[] = [];
  let callCount = 0;
  const aiCall: AICallFn = async (_system, user) => {
    users.push(user);
    const response = responses[Math.min(callCount, responses.length - 1)];
    callCount += 1;
    return response;
  };
  return {
    aiCall,
    users: () => users,
    callCount: () => callCount,
  };
}

function directElementsResponse(backgroundColor = '#ffffff'): string {
  return JSON.stringify({
    background: { type: 'solid', color: backgroundColor },
    elements: [
      {
        id: 'title_001',
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
        id: 'divider_001',
        type: 'shape',
        left: 60,
        top: 132,
        width: 880,
        height: 3,
        fill: '#5b9bd5',
      },
      {
        id: 'body_001',
        type: 'text',
        left: 60,
        top: 160,
        width: 430,
        height: 130,
        content:
          '<p style="font-size:18px;">- Loss surface</p><p style="font-size:18px;">- Gradient direction</p><p style="font-size:18px;">- Step size</p>',
        defaultFontName: '',
        defaultColor: '#333333',
      },
      {
        id: 'formula_001',
        type: 'latex',
        left: 535,
        top: 185,
        width: 360,
        height: 90,
        latex: '\\theta_{t+1}=\\theta_t-\\eta\\nabla J(\\theta_t)',
      },
    ],
    remark: 'Explain gradient descent intuition.',
  });
}

function planShapedResponse(): string {
  return JSON.stringify({
    title: 'Gradient Descent',
    layout: 'formula',
    bullets: ['Read the loss surface', 'Move opposite the gradient', 'Tune step size'],
    visual: {
      kind: 'formula',
      latex: '\\theta_{t+1}=\\theta_t-\\eta\\nabla J(\\theta_t)',
    },
    takeaway: 'Step size controls update stability.',
  });
}

function messySummaryResponse(): string {
  return JSON.stringify({
    background: { type: 'solid', color: '#ffffff' },
    elements: [
      {
        id: 'title',
        type: 'text',
        left: 108,
        top: 68,
        width: 500,
        height: 48,
        content: '<p style="font-size:32px;"><strong>总结与拓展</strong></p>',
      },
      {
        id: 'rule',
        type: 'shape',
        left: 70,
        top: 145,
        width: 860,
        height: 3,
        fill: '#5b9bd5',
      },
      {
        id: 'section-1',
        type: 'text',
        left: 112,
        top: 213,
        width: 280,
        height: 38,
        content: '<p style="font-size:14px;"><strong>关键知识点回顾</strong></p>',
      },
      {
        id: 'card-a',
        type: 'shape',
        left: 54,
        top: 274,
        width: 347,
        height: 158,
        fill: '#dff2ff',
      },
      {
        id: 'card-b',
        type: 'shape',
        left: 425,
        top: 274,
        width: 348,
        height: 158,
        fill: '#ecfbf1',
      },
      {
        id: 'card-c',
        type: 'shape',
        left: 798,
        top: 274,
        width: 347,
        height: 158,
        fill: '#fff9de',
      },
      {
        id: 'card-a-text',
        type: 'text',
        left: 175,
        top: 322,
        width: 130,
        height: 70,
        content:
          '<p style="font-size:15px;text-align:center;"><strong>定义与图像</strong><br/>y = ax<sup>2</sup>+bx+c</p>',
      },
      {
        id: 'card-b-text',
        type: 'text',
        left: 558,
        top: 337,
        width: 140,
        height: 46,
        content: '<p style="font-size:15px;text-align:center;"><strong>开口方向</strong></p>',
      },
      {
        id: 'card-c-text',
        type: 'text',
        left: 913,
        top: 337,
        width: 130,
        height: 46,
        content: '<p style="font-size:15px;text-align:center;"><strong>顶点与对称轴</strong></p>',
      },
      {
        id: 'section-2',
        type: 'text',
        left: 115,
        top: 500,
        width: 260,
        height: 38,
        content: '<p style="font-size:14px;"><strong>实际应用举例</strong></p>',
      },
      {
        id: 'bottom-band',
        type: 'shape',
        left: 54,
        top: 526,
        width: 1092,
        height: 89,
        fill: '#fde2ec',
      },
      {
        id: 'bottom-text',
        type: 'text',
        left: 153,
        top: 579,
        width: 850,
        height: 34,
        content:
          '<p style="font-size:13px;">对比一次函数与二次函数的图像特征，解决生活中的抛物线问题：桥拱呈抛物线，求桥洞高度</p>',
        fill: '#fde2ec',
      },
    ],
  });
}

function overlappingTextResponse(): string {
  return JSON.stringify({
    background: { type: 'solid', color: '#ffffff' },
    elements: [
      {
        id: 'title',
        type: 'text',
        left: 60,
        top: 50,
        width: 880,
        height: 72,
        content: '<p style="font-size:32px;"><strong>Gradient Descent</strong></p>',
      },
      {
        id: 'overlap-a',
        type: 'text',
        left: 120,
        top: 220,
        width: 360,
        height: 110,
        content: '<p style="font-size:20px;">Loss surface shows model error.</p>',
      },
      {
        id: 'overlap-b',
        type: 'text',
        left: 120,
        top: 220,
        width: 360,
        height: 110,
        content: '<p style="font-size:20px;">Gradient direction tells us how to move.</p>',
      },
    ],
    remark: 'bad overlapping draft',
  });
}

function nonOverlappingTextResponse(): string {
  return JSON.stringify({
    background: { type: 'solid', color: '#ffffff' },
    elements: [
      {
        id: 'title',
        type: 'text',
        left: 60,
        top: 50,
        width: 880,
        height: 72,
        content: '<p style="font-size:32px;"><strong>Gradient Descent</strong></p>',
      },
      {
        id: 'panel-a',
        type: 'shape',
        left: 80,
        top: 190,
        width: 380,
        height: 150,
        fill: '#e8f4ff',
      },
      {
        id: 'text-a',
        type: 'text',
        left: 110,
        top: 220,
        width: 320,
        height: 80,
        content: '<p style="font-size:20px;">Loss surface shows model error.</p>',
      },
      {
        id: 'panel-b',
        type: 'shape',
        left: 540,
        top: 190,
        width: 380,
        height: 150,
        fill: '#fef3e2',
      },
      {
        id: 'text-b',
        type: 'text',
        left: 570,
        top: 220,
        width: 320,
        height: 80,
        content: '<p style="font-size:20px;">Gradient direction tells us how to move.</p>',
      },
    ],
    remark: 'fixed layout',
  });
}

describe('OpenMAIC original classroom slide generation', () => {
  it('uses the original OpenMAIC element-level prompt without custom adapter directives', async () => {
    const { aiCall, lastSystem, lastUser } = makeAiCall(directElementsResponse());

    const result = await generateSlideContent(makeOutline(), aiCall);

    expect(result).not.toBeNull();
    expect(result?.templateData).toBeUndefined();
    expect(result?.elements.length).toBeGreaterThanOrEqual(4);
    expect(lastUser()).toContain('# Generation Requirements');
    expect(lastUser()).toContain('generate a complete Canvas/PPT component');
    expect(lastUser()).not.toContain('Course Theme');
    expect(lastUser()).not.toContain('themeDirective');
    expect(lastUser()).not.toContain('OpenMAIC Classroom Slide Directive');
    expect(lastUser()).not.toContain('slides.gif classic classroom composition');
    expect(lastSystem()).not.toContain('Slide Richness Contract');
  });

  it('keeps model-generated elements directly and only applies OpenMAIC post-processing', async () => {
    const { aiCall } = makeAiCall(directElementsResponse());

    const result = await generateSlideContent(makeOutline(), aiCall);
    const elements = result?.elements ?? [];

    expect(result?.background).toEqual({ type: 'solid', color: '#ffffff' });
    expect(elements.some((element) => element.id === 'title_001')).toBe(false);
    expect(elements.every((element) => /^.+_[\w-]{8}$/.test(element.id))).toBe(true);
    expect(elements.some((element) => element.id.startsWith('formula_list_'))).toBe(false);
    expect(elements.some((element) => element.id.startsWith('polish_'))).toBe(false);

    const latex = elements.find((element) => element.type === 'latex') as
      | (GeneratedSlideContent['elements'][number] & { html?: string; fixedRatio?: boolean })
      | undefined;
    expect(latex?.html).toContain('katex');
    expect(latex?.fixedRatio).toBe(true);

    const shape = elements.find((element) => element.type === 'shape') as
      | (GeneratedSlideContent['elements'][number] & { viewBox?: unknown; fixedRatio?: boolean })
      | undefined;
    expect(shape?.viewBox).toBe('0 0 880 3');
    expect(shape?.fixedRatio).toBe(false);
  });

  it('ignores classroom theme selection so the model output is not recolored red', async () => {
    const { aiCall, lastUser } = makeAiCall(directElementsResponse('#ffffff'));

    const result = await generateSlideContent(
      makeOutline(),
      aiCall,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { id: 'red-theme', backgroundColor: '#B85042' } as never,
    );

    expect(result?.background).toEqual({ type: 'solid', color: '#ffffff' });
    expect(lastUser()).not.toContain('#B85042');
    expect(lastUser()).not.toContain('red-theme');
  });

  it('routes the OpenMAIC-main scene branch through the original element generator', async () => {
    const { aiCall, lastUser, callCount } = makeAiCall(directElementsResponse());

    const result = await generateOpenMaicMainSceneContent(makeOutline(), aiCall);

    expect(result).not.toBeNull();
    expect(callCount()).toBe(1);
    expect(lastUser()).toContain('# Generation Requirements');
    expect(lastUser()).not.toContain('OpenMAIC Classroom Slide Directive');
    expect((result as GeneratedSlideContent).elements).toHaveLength(4);
  });

  it('repairs plan-shaped responses by retrying the original element schema', async () => {
    const { aiCall, users, callCount } = makeAiCallSequence([
      planShapedResponse(),
      directElementsResponse(),
    ]);

    const result = await generateSlideContent(makeOutline(), aiCall);

    expect(result).not.toBeNull();
    expect(callCount()).toBe(2);
    expect(users()[1]).toContain('REQUIRED SCHEMA RETRY');
    expect(users()[1]).toContain('Do NOT return plan fields');
    expect(result?.templateData).toBeUndefined();
    expect(result?.elements.some((element) => element.id.startsWith('formula_list_'))).toBe(false);
  });

  it('retries OpenMAIC page design when QA finds blocking readable overlaps', async () => {
    const { aiCall, users, callCount } = makeAiCallSequence([
      overlappingTextResponse(),
      nonOverlappingTextResponse(),
    ]);

    const result = await generateSlideContent(makeOutline(), aiCall);

    expect(result).not.toBeNull();
    expect(callCount()).toBe(2);
    expect(users()[1]).toContain('OPENMAIC QA LAYOUT RETRY');
    expect(users()[1]).toContain('readable_element_overlap');
    expect(auditSlideLayout(result?.elements ?? [])).toEqual([]);
    expect(result?.remark).toBe('fixed layout');
  });

  it('normalizes messy OpenMAIC element coordinates before classroom playback', async () => {
    const { aiCall } = makeAiCall(messySummaryResponse());

    const result = await generateSlideContent(
      {
        ...makeOutline(),
        title: '总结与拓展',
        keyPoints: ['定义与图像', '开口方向', '顶点与对称轴', '实际应用'],
      },
      aiCall,
    );
    const elements = result?.elements ?? [];
    const textElements = elements.filter((element) => element.type === 'text') as Array<
      GeneratedSlideContent['elements'][number] & { content?: string }
    >;

    expect(elements.every((element) => element.left >= 48)).toBe(true);
    expect(elements.every((element) => element.left + element.width <= 952)).toBe(true);
    expect(elements.every((element) => element.top + elementHeight(element) <= 514.5)).toBe(true);
    expect(
      textElements.every(
        (element) => !/font-size:(1[0-7](?:\.\d+)?)px/i.test(element.content ?? ''),
      ),
    ).toBe(true);

    expect(auditSlideLayout(elements)).toEqual([]);
    expect(elements.length).toBeGreaterThanOrEqual(8);
    expect(
      textElements.some((element) => String(element.content ?? '').includes('抛物线问题')),
    ).toBe(false);
  });

  it('creates classroom slide scenes without template metadata', () => {
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
