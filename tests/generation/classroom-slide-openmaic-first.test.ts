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
        content: '<p style="font-size:32px;"><strong>梯度下降的核心直觉</strong></p>',
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
          '<p style="font-size:18px;">- 损失曲面表示模型误差</p><p style="font-size:18px;">- 梯度方向提示最快上升方向</p><p style="font-size:18px;">- 学习率决定每次移动步长</p>',
        defaultFontName: '',
        defaultColor: '#333333',
      },
      {
        id: 'formula_001',
        type: 'latex',
        left: 535,
        top: 185,
        width: 360,
        height: 92,
        latex: '\\theta_{t+1}=\\theta_t-\\eta\\nabla J(\\theta_t)',
      },
    ],
    remark: '讲解梯度下降的直觉。',
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

function englishThinResponse(): string {
  return JSON.stringify({
    background: { type: 'solid', color: '#ffffff' },
    elements: [
      {
        id: 'title_001',
        type: 'text',
        left: 70,
        top: 60,
        width: 860,
        height: 70,
        content:
          '<p style="font-size:32px;"><strong>Advanced Features: Transactions & Lua</strong></p>',
      },
      {
        id: 'body_001',
        type: 'text',
        left: 90,
        top: 210,
        width: 760,
        height: 110,
        content: '<p style="font-size:22px;">Transaction commands and atomic server-side logic</p>',
      },
    ],
    remark: 'thin English response',
  });
}

function chineseDenseResponse(): string {
  return JSON.stringify({
    background: { type: 'solid', color: '#ffffff' },
    elements: [
      {
        id: 'title_001',
        type: 'text',
        left: 70,
        top: 50,
        width: 860,
        height: 72,
        content: '<p style="font-size:32px;"><strong>Redis 事务与 Lua 脚本</strong></p>',
      },
      {
        id: 'flow_001',
        type: 'text',
        left: 75,
        top: 150,
        width: 390,
        height: 150,
        content:
          '<p style="font-size:22px;"><strong>命令序列</strong></p><p style="font-size:20px;">MULTI 开启队列，SET/INCR 入队，EXEC 一次提交执行，DISCARD 可放弃队列。</p>',
      },
      {
        id: 'case_001',
        type: 'text',
        left: 535,
        top: 150,
        width: 390,
        height: 150,
        content:
          '<p style="font-size:22px;"><strong>适用场景</strong></p><p style="font-size:20px;">库存扣减、积分累计、排行榜更新等需要把多步操作看成一个整体。</p>',
      },
      {
        id: 'warn_001',
        type: 'text',
        left: 75,
        top: 330,
        width: 390,
        height: 96,
        content:
          '<p style="font-size:22px;"><strong>注意点</strong></p><p style="font-size:20px;">Redis 事务不自动回滚；需要用 WATCH 做乐观锁，或用 Lua 保证服务端原子执行。</p>',
      },
      {
        id: 'summary_001',
        type: 'text',
        left: 535,
        top: 330,
        width: 390,
        height: 96,
        content:
          '<p style="font-size:22px;"><strong>课堂小结</strong></p><p style="font-size:20px;">事务适合批量提交，Lua 适合封装复杂逻辑；选择依据是逻辑复杂度和并发风险。</p>',
      },
      {
        id: 'formula_001',
        type: 'latex',
        left: 70,
        top: 420,
        width: 860,
        height: 92,
        latex: '\\text{MULTI} \\rightarrow \\text{commands} \\rightarrow \\text{EXEC}',
      },
    ],
    remark: 'dense Chinese response',
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
        content: '<p style="font-size:32px;"><strong>梯度下降的排版示例</strong></p>',
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
      {
        id: 'formula',
        type: 'latex',
        left: 560,
        top: 220,
        width: 320,
        height: 90,
        latex: '\\theta_{t+1}=\\theta_t-\\eta\\nabla J(\\theta_t)',
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
        content: '<p style="font-size:32px;"><strong>梯度下降的排版示例</strong></p>',
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
        content:
          '<p style="font-size:20px;">损失曲面表示模型当前误差，曲面越高说明预测偏差越大。</p>',
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
        content:
          '<p style="font-size:20px;">梯度方向提示误差上升最快的方向，更新时要沿反方向移动。</p>',
      },
      {
        id: 'formula',
        type: 'latex',
        left: 100,
        top: 370,
        width: 800,
        height: 90,
        latex: '\\theta_{t+1}=\\theta_t-\\eta\\nabla J(\\theta_t)',
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
    expect(lastUser()).toContain('使用中文进行教学');
    expect(lastUser()).not.toContain('Course Theme');
    expect(lastUser()).not.toContain('themeDirective');
    expect(lastUser()).not.toContain('天空课堂 Classroom Slide Directive');
    expect(lastUser()).not.toContain('slides.gif classic classroom composition');
    expect(lastSystem()).not.toContain('Slide Richness Contract');
  });

  it('forces Chinese slide text even when upstream language directive says English', async () => {
    const { aiCall, lastUser } = makeAiCall(directElementsResponse());

    const result = await generateSlideContent(
      makeOutline(),
      aiCall,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'Use English.',
    );

    expect(result).not.toBeNull();
    expect(lastUser()).toContain('所有可见文字必须使用简体中文');
    expect(lastUser()).toContain('把英文标题、英文小节名、英文解释翻译成中文');
    expect(lastUser()).not.toContain('Use English.');
  });

  it('passes scene order into the slide prompt for deck-level layout diversity', async () => {
    const { aiCall, lastUser } = makeAiCall(directElementsResponse());

    const result = await generateSlideContent({ ...makeOutline(), order: 7 }, aiCall);

    expect(result).not.toBeNull();
    expect(lastUser()).toContain('Scene Order');
    expect(lastUser()).toContain('7');
    expect(lastUser()).toContain('Deck diversity hard rules');
    expect(lastUser()).toContain('Do not reuse the same main composition');
    expect(lastUser()).toContain('天空课堂 golden sample style contract');
    expect(lastUser()).toContain('Page-specific composition for this page');
    expect(lastUser()).toContain('center-stage');
    expect(lastUser()).toContain('Do not use orange bars');
  });

  it('keeps model-generated elements directly and only applies OpenMAIC post-processing', async () => {
    const { aiCall } = makeAiCall(directElementsResponse());

    const result = await generateSlideContent(makeOutline(), aiCall);
    const elements = result?.elements ?? [];

    expect(result?.background).toEqual({ type: 'solid', color: '#ffffff' });
    expect(elements.some((element) => element.id === 'title_001')).toBe(false);
    expect(
      elements.every(
        (element) =>
          /^.+_[\w-]{8}$/.test(element.id) || element.id.startsWith('polish_deck_signature_'),
      ),
    ).toBe(true);
    expect(elements.some((element) => element.id.startsWith('formula_list_'))).toBe(false);
    expect(elements.some((element) => element.id.startsWith('polish_ref_'))).toBe(false);

    const latex = elements.find((element) => element.type === 'latex') as
      | (GeneratedSlideContent['elements'][number] & { html?: string; fixedRatio?: boolean })
      | undefined;
    expect(latex?.html).toContain('katex');
    expect(latex?.fixedRatio).toBe(true);

    const shape = elements.find(
      (element) => element.type === 'shape' && !element.id.startsWith('polish_deck_signature_'),
    ) as
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

    const result = await generateOpenMaicMainSceneContent(makeOutline(), aiCall, {
      languageDirective: 'Use English.',
    });

    expect(result).not.toBeNull();
    expect(callCount()).toBe(1);
    expect(lastUser()).toContain('# Generation Requirements');
    expect(lastUser()).not.toContain('天空课堂 Classroom Slide Directive');
    expect(lastUser()).not.toContain('Use English.');
    expect((result as GeneratedSlideContent).elements.length).toBeGreaterThanOrEqual(4);
  });

  it('forces Chinese in the OpenMAIC edit scene branch too', async () => {
    const { aiCall, lastUser } = makeAiCall(directElementsResponse());

    const result = await generateOpenMaicMainSceneContent(makeOutline(), aiCall, {
      languageDirective: 'Use English.',
      editDirective: '重新排版并补充教学内容',
      baselineContent: {
        elements: [],
        background: { type: 'solid', color: '#ffffff' },
        remark: 'baseline',
      },
    });

    expect(result).not.toBeNull();
    expect(lastUser()).toContain('All visible slide text must follow this language directive');
    expect(lastUser()).not.toContain('Use English.');
    expect((result as GeneratedSlideContent).qa).toBeDefined();
  });

  it('retries OpenMAIC edit branch content when QA blocks the first draft', async () => {
    const { aiCall, users, callCount } = makeAiCallSequence([
      englishThinResponse(),
      chineseDenseResponse(),
    ]);

    const result = await generateOpenMaicMainSceneContent(makeOutline(), aiCall, {
      editDirective: '重新排版并补充教学内容',
      baselineContent: {
        elements: [],
        background: { type: 'solid', color: '#ffffff' },
        remark: 'baseline',
      },
    });

    expect(result).not.toBeNull();
    expect(callCount()).toBe(2);
    expect(users()[1]).toContain('OPENMAIC QA CONTENT RETRY');
    expect(users()[1]).toContain('mostly_non_chinese_text');
    expect((result as GeneratedSlideContent).qa?.pass).toBe(true);
    expect((result as GeneratedSlideContent).remark).toBe('dense Chinese response');
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

  it('retries OpenMAIC slide content when language or density QA blocks the first draft', async () => {
    const { aiCall, users, callCount } = makeAiCallSequence([
      englishThinResponse(),
      chineseDenseResponse(),
    ]);

    const result = await generateSlideContent(makeOutline(), aiCall);

    expect(result).not.toBeNull();
    expect(callCount()).toBe(2);
    expect(users()[1]).toContain('OPENMAIC QA CONTENT RETRY');
    expect(users()[1]).toContain('mostly_non_chinese_text');
    expect(users()[1]).toContain('thin_teaching_content');
    expect(result?.qa?.pass).toBe(true);
    expect(result?.remark).toBe('dense Chinese response');
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
