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

vi.mock('@/lib/generation/openmaic-main-scene-generator', () => sceneGeneratorMocks);

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

const denseSlideContent: GeneratedSlideContent = {
  elements: [
    {
      id: 'title',
      type: 'text',
      left: 72,
      top: 64,
      width: 856,
      height: 56,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#0f172a',
      content: '<p style="font-size:32px;">Redis 数据结构的课堂修复页</p>',
    },
    {
      id: 'block_a',
      type: 'text',
      left: 82,
      top: 160,
      width: 398,
      height: 82,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1e293b',
      content:
        '<p style="font-size:22px;">使用场景：String 适合缓存计数器、验证码和简单配置值。</p>',
    },
    {
      id: 'block_b',
      type: 'text',
      left: 520,
      top: 160,
      width: 398,
      height: 82,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1e293b',
      content:
        '<p style="font-size:22px;">命令线索：SET 写入键值，GET 读取内容，EXPIRE 控制有效期。</p>',
    },
    {
      id: 'block_c',
      type: 'text',
      left: 82,
      top: 282,
      width: 398,
      height: 82,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1e293b',
      content:
        '<p style="font-size:22px;">易错提醒：不要把复杂对象拆成一堆无命名规则的孤立键。</p>',
    },
    {
      id: 'block_d',
      type: 'text',
      left: 520,
      top: 282,
      width: 398,
      height: 82,
      rotate: 0,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1e293b',
      content:
        '<p style="font-size:22px;">课堂总结：先判断读写模式，再选择能表达结构关系的数据类型。</p>',
    },
  ] as GeneratedSlideContent['elements'],
  background: { type: 'solid', color: '#f8fbff' },
  remark: 'Dense repaired slide content.',
};

function repeatedDeckSlideContent(order: number): GeneratedSlideContent {
  const title = `Redis \u6570\u636e\u7ed3\u6784\u5bf9\u7167 ${order}`;
  return {
    elements: [
      {
        id: `repeated_title_${order}`,
        type: 'text',
        left: 72,
        top: 54,
        width: 856,
        height: 58,
        rotate: 0,
        defaultFontName: 'Microsoft YaHei',
        defaultColor: '#0f172a',
        content: `<p style="font-size:32px;">${title}</p>`,
      },
      {
        id: `repeated_subtitle_${order}`,
        type: 'text',
        left: 72,
        top: 118,
        width: 856,
        height: 34,
        rotate: 0,
        defaultFontName: 'Microsoft YaHei',
        defaultColor: '#1e293b',
        content:
          '<p style="font-size:20px;">\u4ece\u573a\u666f\u3001\u64cd\u4f5c\u3001\u98ce\u9669\u548c\u603b\u7ed3\u56db\u4e2a\u89d2\u5ea6\u8bb2\u89e3\u3002</p>',
      },
      {
        id: `repeated_table_${order}`,
        type: 'table',
        left: 82,
        top: 160,
        width: 836,
        height: 132,
        rotate: 0,
        outline: { color: '#cfe0f5', width: 1, style: 'solid' },
        theme: {
          color: '#2563eb',
          rowHeader: true,
          rowFooter: false,
          colHeader: false,
          colFooter: false,
        },
        colWidths: [0.28, 0.36, 0.36],
        cellMinHeight: 42,
        data: [
          ['\u5224\u65ad\u9879', '\u8bfe\u5802\u843d\u70b9', '\u68c0\u67e5\u95ee\u9898'],
          [
            '\u6570\u636e\u5f62\u6001',
            '\u5bf9\u8c61/\u5217\u8868/\u96c6\u5408',
            '\u662f\u5426\u9700\u8981\u987a\u5e8f\u6216\u53bb\u91cd',
          ],
          [
            '\u8bbf\u95ee\u65b9\u5f0f',
            '\u8bfb\u5199/\u6392\u5e8f/\u5c40\u90e8\u66f4\u65b0',
            '\u662f\u5426\u9700\u8981\u8303\u56f4\u67e5\u8be2',
          ],
        ].map((row, rowIndex) =>
          row.map((cell, cellIndex) => ({
            id: `repeated_table_${order}_${rowIndex}_${cellIndex}`,
            text: cell,
            colspan: 1,
            rowspan: 1,
            style: {
              bold: rowIndex === 0 || cellIndex === 0,
              color: '#1e293b',
              backcolor: rowIndex === 0 ? '#eaf4ff' : '#ffffff',
              fontsize: rowIndex === 0 ? '18' : '17',
              fontname: 'Microsoft YaHei',
              align: 'left',
            },
          })),
        ),
      },
      ...[
        [
          'a',
          82,
          326,
          '\u9002\u7528\u573a\u666f\uff1a\u6839\u636e\u4e1a\u52a1\u8bbf\u95ee\u6a21\u5f0f\u9009\u62e9\u5408\u9002\u7684\u5b58\u50a8\u7ed3\u6784\u3002',
        ],
        [
          'b',
          528,
          326,
          '\u5173\u952e\u64cd\u4f5c\uff1a\u628a\u8bfb\u5199\u3001\u6392\u5e8f\u3001\u53bb\u91cd\u548c\u5c40\u90e8\u66f4\u65b0\u5206\u5f00\u5224\u65ad\u3002',
        ],
        [
          'c',
          82,
          426,
          '\u6613\u9519\u63d0\u9192\uff1a\u4e0d\u8981\u53ea\u770b\u540d\u79f0\uff0c\u8981\u770b\u6570\u636e\u5f62\u6001\u548c\u7ed3\u679c\u9700\u6c42\u3002',
        ],
        [
          'd',
          528,
          426,
          '\u8bfe\u5802\u5c0f\u7ed3\uff1a\u5148\u5224\u65ad\u6570\u636e\u50cf\u4ec0\u4e48\uff0c\u518d\u5224\u65ad\u9700\u8981\u600e\u4e48\u8bbf\u95ee\u3002',
        ],
      ].flatMap(([suffix, left, top, body]) => [
        {
          id: `repeated_card_${suffix}_${order}`,
          type: 'shape' as const,
          left: left as number,
          top: top as number,
          width: 390,
          height: top === 326 ? 78 : 58,
          rotate: 0,
          fill: top === 326 ? '#eaf4ff' : '#f8fbff',
          path: 'M0 0 L1 0 L1 1 L0 1 Z',
          viewBox: '0 0 1 1',
          fixedRatio: false,
        },
        {
          id: `repeated_body_${suffix}_${order}`,
          type: 'text' as const,
          left: (left as number) + 22,
          top: (top as number) + 14,
          width: 346,
          height: top === 326 ? 42 : 34,
          rotate: 0,
          defaultFontName: 'Microsoft YaHei',
          defaultColor: '#1e293b',
          content: `<p style="font-size:20px;">${body}</p>`,
        },
      ]),
    ] as GeneratedSlideContent['elements'],
    background: { type: 'solid', color: '#ffffff' },
    remark: `Repeated deck layout ${order}.`,
  };
}

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

function expectSafeFallbackSlideContent(content: unknown) {
  const slide = content as GeneratedSlideContent;
  expect(slide.qa?.pass).toBe(true);
  expect(slide.elements.some((element) => element.id.startsWith('classroom_qa_safe_'))).toBe(true);
}

function safeFallbackLayoutSignature(content: unknown): string {
  const slide = content as GeneratedSlideContent;
  return slide.elements
    .filter((element) => element.id.startsWith('classroom_qa_safe_'))
    .map((element) =>
      [element.type, element.left, element.top, element.width, element.height].join(':'),
    )
    .join('|');
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

  test('reports per-scene progress and creates scenes through OpenMAIC scene generation', async () => {
    const onProgress = vi.fn((_progress: ClassroomGenerationProgress) => {});

    const result = await generateClassroomContinue(savedOutlineResult(), {
      baseUrl: 'http://localhost',
      onProgress,
    });

    expect(result.scenesCount).toBe(2);
    expect(result.scenes.map((scene) => scene.type)).toEqual(['slide', 'quiz']);
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenCalledTimes(2);
    expect(sceneGeneratorMocks.generateSceneActions).toHaveBeenCalledTimes(2);
    expect(sceneGeneratorMocks.createSceneWithActions).toHaveBeenCalledTimes(2);

    const firstSceneCreateOrder =
      sceneGeneratorMocks.createSceneWithActions.mock.invocationCallOrder[0];
    const progressBeforeFirstScene = onProgress.mock.calls
      .map(([progress], index) => ({
        progress,
        order: onProgress.mock.invocationCallOrder[index],
      }))
      .filter((entry) => entry.order < firstSceneCreateOrder)
      .map((entry) => entry.progress.progress);
    const reportedProgress = onProgress.mock.calls.map(([progress]) => progress.progress);

    expect(progressBeforeFirstScene).toContain(31);
    expect(progressBeforeFirstScene.some((progress) => progress > 31)).toBe(true);
    expect(reportedProgress).toContain(31);
    expect(reportedProgress).toContain(55);
    expect(reportedProgress).toContain(100);
  });

  test('retries non-slide content as an OpenMAIC slide when specialized generation fails', async () => {
    sceneGeneratorMocks.generateSceneContent.mockImplementation(async (outline: SceneOutline) => {
      if (outline.id === 'scene-2' && outline.type === 'quiz') return null;
      return outline.type === 'quiz' ? quizContent : slideContent;
    });

    const result = await generateClassroomContinue(savedOutlineResult(), {
      baseUrl: 'http://localhost',
    });

    expect(result.scenesCount).toBe(2);
    expect(result.scenes.map((scene) => scene.type)).toEqual(['slide', 'slide']);
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scene-2', type: 'quiz' }),
      expect.any(Function),
      expect.any(Object),
    );
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'scene-2',
        type: 'slide',
        quizConfig: undefined,
      }),
      expect.any(Function),
      expect.any(Object),
    );
    expect(sceneGeneratorMocks.generateSceneActions).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'scene-2', type: 'slide' }),
      slideContent,
      expect.any(Function),
      expect.any(Object),
    );
  });

  test('fails the classroom job when OpenMAIC scene content generation returns no content', async () => {
    sceneGeneratorMocks.generateSceneContent.mockResolvedValue(null);

    await expect(
      generateClassroomContinue(savedOutlineResult(), {
        baseUrl: 'http://localhost',
      }),
    ).rejects.toThrow('OpenMAIC classroom content generation failed for 2 scene(s): Intro, Check');

    expect(sceneGeneratorMocks.createSceneWithActions).not.toHaveBeenCalled();
  });

  test('repairs failed classroom slide QA once before creating scenes', async () => {
    const thinSlideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'title',
          type: 'text',
          left: 80,
          top: 70,
          width: 820,
          height: 70,
          content: '<p style="font-size:32px;">Redis 基础</p>',
        },
        {
          id: 'point_a',
          type: 'text',
          left: 120,
          top: 220,
          width: 320,
          height: 80,
          content: '<p style="font-size:22px;">String</p>',
        },
      ] as GeneratedSlideContent['elements'],
      remark: 'Thin slide should be repaired before classroom creation.',
    };

    sceneGeneratorMocks.generateSceneContent.mockImplementation(async (outline: SceneOutline) => {
      if (outline.id === 'scene-1') {
        return sceneGeneratorMocks.generateSceneContent.mock.calls.filter(
          ([calledOutline]) => (calledOutline as SceneOutline).id === 'scene-1',
        ).length === 1
          ? thinSlideContent
          : denseSlideContent;
      }
      return outline.type === 'quiz' ? quizContent : slideContent;
    });

    const result = await generateClassroomContinue(savedOutlineResult(), {
      baseUrl: 'http://localhost',
    });

    expect(result.scenesCount).toBe(2);
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenCalledTimes(3);
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'scene-1', type: 'slide' }),
      expect.any(Function),
      expect.objectContaining({
        editDirective: expect.stringContaining('thin_teaching_content'),
        baselineContent: thinSlideContent,
      }),
    );
    expect(sceneGeneratorMocks.generateSceneActions).toHaveBeenCalledTimes(2);
    expect(sceneGeneratorMocks.createSceneWithActions).toHaveBeenCalledTimes(2);
  });

  test('uses a safe fallback slide when layout QA repair still fails', async () => {
    const brokenSlideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'text_a',
          type: 'text',
          left: 120,
          top: 180,
          width: 360,
          height: 80,
          content: '<p style="font-size:24px;">First readable block</p>',
        },
        {
          id: 'text_b',
          type: 'text',
          left: 160,
          top: 205,
          width: 360,
          height: 80,
          content: '<p style="font-size:24px;">Second readable block</p>',
        },
      ] as GeneratedSlideContent['elements'],
      background: undefined,
      remark: 'This slide still has a blocking readable overlap.',
    };

    sceneGeneratorMocks.generateSceneContent.mockImplementation(async (outline: SceneOutline) =>
      outline.id === 'scene-1' ? brokenSlideContent : quizContent,
    );

    const result = await generateClassroomContinue(savedOutlineResult(), {
      baseUrl: 'http://localhost',
    });

    expect(result.slideQaReport?.pass).toBe(true);
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scene-1', type: 'slide' }),
      expect.any(Function),
      expect.objectContaining({
        editDirective: expect.stringContaining('readable_element_overlap'),
        baselineContent: brokenSlideContent,
      }),
    );
    expectSafeFallbackSlideContent(sceneGeneratorMocks.generateSceneActions.mock.calls[0][1]);
    expect(sceneGeneratorMocks.generateSceneActions).toHaveBeenCalledTimes(2);
    expect(sceneGeneratorMocks.createSceneWithActions).toHaveBeenCalledTimes(2);
  });

  test('uses a safe fallback slide when text remains mostly English after repair', async () => {
    const englishSlideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'title',
          type: 'text',
          left: 80,
          top: 70,
          width: 820,
          height: 70,
          content: '<p style="font-size:32px;">Advanced Features: Transactions & Lua</p>',
        },
        {
          id: 'body',
          type: 'text',
          left: 120,
          top: 220,
          width: 720,
          height: 120,
          content:
            '<p style="font-size:22px;">Transaction commands and atomic server-side logic</p>',
        },
      ] as GeneratedSlideContent['elements'],
      remark: 'English slide should be blocked by classroom slide QA.',
    };

    sceneGeneratorMocks.generateSceneContent.mockImplementation(async (outline: SceneOutline) =>
      outline.id === 'scene-1' ? englishSlideContent : quizContent,
    );

    const result = await generateClassroomContinue(savedOutlineResult(), {
      baseUrl: 'http://localhost',
    });

    expect(result.slideQaReport?.pass).toBe(true);
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scene-1', type: 'slide' }),
      expect.any(Function),
      expect.objectContaining({
        editDirective: expect.stringContaining('mostly_non_chinese_text'),
        baselineContent: englishSlideContent,
      }),
    );
    expectSafeFallbackSlideContent(sceneGeneratorMocks.generateSceneActions.mock.calls[0][1]);
    expect(sceneGeneratorMocks.generateSceneActions).toHaveBeenCalledTimes(2);
    expect(sceneGeneratorMocks.createSceneWithActions).toHaveBeenCalledTimes(2);
  });

  test('uses a safe fallback slide when teaching content stays too thin after repair', async () => {
    const thinSlideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'title',
          type: 'text',
          left: 80,
          top: 70,
          width: 820,
          height: 70,
          content: '<p style="font-size:32px;">Redis 高级特性</p>',
        },
        {
          id: 'point_a',
          type: 'text',
          left: 120,
          top: 220,
          width: 320,
          height: 80,
          content: '<p style="font-size:22px;">事务命令</p>',
        },
        {
          id: 'point_b',
          type: 'text',
          left: 560,
          top: 220,
          width: 320,
          height: 80,
          content: '<p style="font-size:22px;">Lua 脚本</p>',
        },
      ] as GeneratedSlideContent['elements'],
      remark: 'Thin slide should be blocked by classroom slide QA.',
    };

    sceneGeneratorMocks.generateSceneContent.mockImplementation(async (outline: SceneOutline) =>
      outline.id === 'scene-1' ? thinSlideContent : quizContent,
    );

    const result = await generateClassroomContinue(savedOutlineResult(), {
      baseUrl: 'http://localhost',
    });

    expect(result.slideQaReport?.pass).toBe(true);
    expect(sceneGeneratorMocks.generateSceneContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scene-1', type: 'slide' }),
      expect.any(Function),
      expect.objectContaining({
        editDirective: expect.stringContaining('thin_teaching_content'),
        baselineContent: thinSlideContent,
      }),
    );
    expectSafeFallbackSlideContent(sceneGeneratorMocks.generateSceneActions.mock.calls[0][1]);
    expect(sceneGeneratorMocks.generateSceneActions).toHaveBeenCalledTimes(2);
    expect(sceneGeneratorMocks.createSceneWithActions).toHaveBeenCalledTimes(2);
  });

  test('uses course-neutral safe fallback content for Python string lessons', async () => {
    const brokenPythonSlideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'text_a',
          type: 'text',
          left: 120,
          top: 180,
          width: 360,
          height: 80,
          content: '<p style="font-size:24px;">Python 字符串拼接</p>',
        },
        {
          id: 'text_b',
          type: 'text',
          left: 160,
          top: 205,
          width: 360,
          height: 80,
          content: '<p style="font-size:24px;">切片和查找</p>',
        },
      ] as GeneratedSlideContent['elements'],
      remark: 'Broken Python string slide should fall back without Redis text.',
    };
    const pythonOutlines: SceneOutline[] = [
      {
        id: 'python-string',
        type: 'slide',
        title: 'Python 字符串操作',
        description: '讲解字符串拼接、切片、查找和格式化输出。',
        keyPoints: ['字符串拼接', '切片索引', 'find() 查找', 'f-string 格式化'],
        order: 1,
      },
    ];

    sceneGeneratorMocks.generateSceneContent.mockResolvedValue(brokenPythonSlideContent);

    const result = await generateClassroomContinue(
      {
        ...savedOutlineResult(),
        outlines: pythonOutlines,
      },
      {
        baseUrl: 'http://localhost',
      },
    );

    const fallbackContent = sceneGeneratorMocks.generateSceneActions.mock.calls[0][1] as
      | GeneratedSlideContent
      | undefined;
    const combinedText = (fallbackContent?.elements ?? [])
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(result.slideQaReport?.pass).toBe(true);
    expectSafeFallbackSlideContent(fallbackContent);
    expect(combinedText).toContain('Python 字符串操作');
    expect(combinedText).not.toMatch(/\b(SET|GET|INCR|EXPIRE|LPUSH|RPOP|HSET|HGET)\b/i);
    expect(combinedText).not.toMatch(/Redis|Hash|键值模型|缓存配置/);
  });

  test('uses distinct safe fallback layouts for different failed slide intents', async () => {
    const brokenSlideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'text_a',
          type: 'text',
          left: 120,
          top: 180,
          width: 360,
          height: 80,
          content: '<p style="font-size:24px;">First readable block</p>',
        },
        {
          id: 'text_b',
          type: 'text',
          left: 160,
          top: 205,
          width: 360,
          height: 80,
          content: '<p style="font-size:24px;">Second readable block</p>',
        },
      ] as GeneratedSlideContent['elements'],
      remark: 'All repairs should fall back to safe layouts.',
    };
    const slideOutlines: SceneOutline[] = [
      {
        id: 'redis-string',
        type: 'slide',
        title: 'String 字符串：最基础的构建块',
        description: '讲清键值缓存、计数器和过期时间。',
        keyPoints: ['键值模型', 'SET / GET / INCR'],
        order: 1,
      },
      {
        id: 'redis-list',
        type: 'slide',
        title: 'List 列表：有序队列的利器',
        description: '讲清两端操作、队列和时间线。',
        keyPoints: ['顺序结构', 'LPUSH / RPOP'],
        order: 2,
      },
      {
        id: 'redis-zset',
        type: 'slide',
        title: 'Sorted Set 有序集合：带权重的排行榜',
        description: '讲清分数排序、范围查询和排行榜。',
        keyPoints: ['分数排序', 'ZRANGE / ZADD'],
        order: 3,
      },
    ];

    sceneGeneratorMocks.generateSceneContent.mockResolvedValue(brokenSlideContent);

    const result = await generateClassroomContinue(
      {
        ...savedOutlineResult(),
        outlines: slideOutlines,
      },
      {
        baseUrl: 'http://localhost',
      },
    );

    const fallbackContents = sceneGeneratorMocks.generateSceneActions.mock.calls.map(
      ([, content]) => content,
    );

    expect(result.slideQaReport?.pass).toBe(true);
    expect(fallbackContents).toHaveLength(slideOutlines.length);
    for (const content of fallbackContents) {
      expectSafeFallbackSlideContent(content);
    }
    expect(new Set(fallbackContents.map(safeFallbackLayoutSignature)).size).toBe(
      slideOutlines.length,
    );
  });

  test('falls back to a different safe layout when repeated deck layouts survive repair', async () => {
    const repeatedOutlines: SceneOutline[] = Array.from(
      { length: 13 },
      (_, index) => index + 1,
    ).map((order) => ({
      id: `repeated-${order}`,
      type: 'slide',
      title: `Redis \u6570\u636e\u7ed3\u6784\u5bf9\u7167 ${order}`,
      description:
        '\u68c0\u67e5\u540c\u4e00\u5957\u8bfe\u4ef6\u4e2d\u4e0d\u80fd\u53ea\u6362\u6807\u9898\u800c\u91cd\u590d\u4e3b\u4f53\u6a21\u677f\u3002',
      keyPoints: [
        '\u9002\u7528\u573a\u666f',
        '\u5173\u952e\u64cd\u4f5c',
        '\u6613\u9519\u63d0\u9192',
        '\u8bfe\u5802\u5c0f\u7ed3',
      ],
      order,
    }));

    sceneGeneratorMocks.generateSceneContent.mockImplementation(async (outline: SceneOutline) =>
      repeatedDeckSlideContent(outline.order),
    );

    const result = await generateClassroomContinue(
      {
        ...savedOutlineResult(),
        outlines: repeatedOutlines,
      },
      {
        baseUrl: 'http://localhost',
      },
    );

    const repairCalls = sceneGeneratorMocks.generateSceneContent.mock.calls.filter(
      ([, , options]) => typeof options?.editDirective === 'string',
    );
    const actionContents = sceneGeneratorMocks.generateSceneActions.mock.calls.map(
      ([, content]) => content as GeneratedSlideContent,
    );
    const safeFallbackContents = actionContents.filter((content) =>
      content.elements.some((element) => element.id.startsWith('classroom_qa_safe_')),
    );

    expect(result.slideQaReport?.pass).toBe(true);
    expect(repairCalls).toHaveLength(12);
    for (const [, , options] of repairCalls) {
      expect(options.editDirective).toContain('repeated_layout_signature');
      expect(options.editDirective).toContain('Do not reuse the same main composition');
      expect(options.editDirective).toContain('Change the main element coordinates');
    }
    expect(safeFallbackContents).toHaveLength(12);
    expect(new Set(safeFallbackContents.map(safeFallbackLayoutSignature)).size).toBe(12);
  });

  test('forces a final safe fallback when parallel repairs introduce a repeated deck layout', async () => {
    const thinSlideContent: GeneratedSlideContent = {
      elements: [
        {
          id: 'thin_title',
          type: 'text',
          left: 80,
          top: 70,
          width: 820,
          height: 70,
          content: '<p style="font-size:32px;">Python \u57fa\u7840</p>',
        },
        {
          id: 'thin_point',
          type: 'text',
          left: 120,
          top: 220,
          width: 320,
          height: 80,
          content: '<p style="font-size:22px;">\u6838\u5fc3\u8981\u70b9</p>',
        },
      ] as GeneratedSlideContent['elements'],
      remark: 'Thin slides should be repaired first.',
    };
    const repairedDuplicateContent = repeatedDeckSlideContent(88);
    const slideOutlines: SceneOutline[] = [
      {
        id: 'stable-layout',
        type: 'slide',
        title: '\u8bfe\u7a0b\u5bfc\u5165',
        description:
          '\u7528\u4e00\u9875\u7a33\u5b9a\u5185\u5bb9\u907f\u514d\u9996\u9875\u53c2\u4e0e\u91cd\u590d\u3002',
        keyPoints: ['\u76ee\u6807', '\u7ed3\u6784'],
        order: 1,
      },
      {
        id: 'string-ops',
        type: 'slide',
        title: '\u5b57\u7b26\u4e32\u64cd\u4f5c',
        description:
          '\u8bb2\u89e3\u5b57\u7b26\u4e32\u7684\u62fc\u63a5\u3001\u5207\u7247\u548c\u67e5\u627e\u3002',
        keyPoints: ['\u62fc\u63a5', '\u5207\u7247', '\u67e5\u627e'],
        order: 2,
      },
      {
        id: 'conditionals',
        type: 'slide',
        title: '\u6761\u4ef6\u5224\u65ad\u8bed\u53e5',
        description: '\u8bb2\u89e3 if / elif / else \u7684\u5206\u652f\u9009\u62e9\u3002',
        keyPoints: ['\u6761\u4ef6', '\u5206\u652f', '\u9ed8\u8ba4\u8def\u5f84'],
        order: 3,
      },
    ];

    sceneGeneratorMocks.generateSceneContent.mockImplementation(
      async (outline: SceneOutline, _aiCall: unknown, options?: { editDirective?: string }) => {
        if (options?.editDirective) return repairedDuplicateContent;
        if (outline.id === 'stable-layout') return denseSlideContent;
        return thinSlideContent;
      },
    );

    const result = await generateClassroomContinue(
      {
        ...savedOutlineResult(),
        outlines: slideOutlines,
      },
      {
        baseUrl: 'http://localhost',
      },
    );

    const repairCalls = sceneGeneratorMocks.generateSceneContent.mock.calls.filter(
      ([, , options]) => typeof options?.editDirective === 'string',
    );
    const actionContents = sceneGeneratorMocks.generateSceneActions.mock.calls.map(
      ([, content]) => content as GeneratedSlideContent,
    );
    const safeFallbackContents = actionContents.filter((content) =>
      content.elements.some((element) => element.id.startsWith('classroom_qa_safe_')),
    );

    expect(result.scenesCount).toBe(3);
    expect(result.slideQaReport?.pass).toBe(true);
    expect(repairCalls).toHaveLength(2);
    expect(safeFallbackContents).toHaveLength(2);
    expect(sceneGeneratorMocks.createSceneWithActions).toHaveBeenCalledTimes(3);
  });
});
