/**
 * Prompt Builder & State Context Tests
 *
 * Tests for:
 * - buildStateContext: converts store state into context string for the LLM
 * - buildStructuredPrompt: builds the full system prompt for an agent
 * - buildDirectorPrompt: builds the director's routing prompt
 */
import { describe, test, expect } from 'vitest';
import { buildStateContext } from '@/lib/orchestration/summarizers/state-context';
import type { StatelessChatRequest } from '@/lib/types/chat';

// ─── Fixtures ───

function makeStoreState(overrides?: Partial<StatelessChatRequest['storeState']>): StatelessChatRequest['storeState'] {
  return {
    stage: {
      id: 'stage-1',
      name: '光合作用课程',
      description: '初中生物',
      languageDirective: '请用中文回答',
    },
    scenes: [
      {
        id: 'scene-1',
        title: '什么是光合作用',
        type: 'slide',
        order: 0,
        content: {
          type: 'slide',
          canvas: {
            elements: [
              { id: 'el-1', type: 'text', content: '<p>光合作用定义</p>', left: 0, top: 0, width: 100, height: 50 },
              { id: 'el-2', type: 'image', src: 'https://example.com/img.png', left: 0, top: 60, width: 200, height: 150 },
              { id: 'el-3', type: 'text', content: '<p>反应方程式</p>', left: 0, top: 220, width: 100, height: 50 },
            ],
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'scene-2',
        title: '随堂测验',
        type: 'quiz',
        order: 1,
        content: {
          type: 'quiz',
          questions: [
            { type: 'single', question: '光合作用的产物是什么？', options: ['葡萄糖', '氨基酸', '脂肪酸'], answer: 0 },
            { type: 'single', question: '光合作用发生在哪个细胞器？', options: ['线粒体', '叶绿体', '核糖体'], answer: 1 },
          ],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'scene-3',
        title: '光合作用的意义',
        type: 'slide',
        order: 2,
        content: {
          type: 'slide',
          canvas: { elements: [] },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    currentSceneId: 'scene-1',
    mode: 'playback',
    whiteboardOpen: false,
    ...overrides,
  };
}

// ─── buildStateContext ───

describe('buildStateContext', () => {
  test('includes background context warning', () => {
    const ctx = buildStateContext(makeStoreState());
    expect(ctx).toContain('BACKGROUND CONTEXT');
    expect(ctx).toContain('do NOT describe or lecture');
  });

  test('includes mode', () => {
    const ctx = buildStateContext(makeStoreState({ mode: 'playback' }));
    expect(ctx).toContain('Mode: playback');
  });

  test('includes whiteboard status (closed)', () => {
    const ctx = buildStateContext(makeStoreState({ whiteboardOpen: false }));
    expect(ctx).toContain('Whiteboard: closed');
  });

  test('includes whiteboard status (open)', () => {
    const ctx = buildStateContext(makeStoreState({ whiteboardOpen: true }));
    expect(ctx).toContain('Whiteboard: OPEN');
  });

  test('includes course name and description', () => {
    const ctx = buildStateContext(makeStoreState());
    expect(ctx).toContain('光合作用课程');
    expect(ctx).toContain('初中生物');
  });

  test('includes total scene count', () => {
    const ctx = buildStateContext(makeStoreState());
    expect(ctx).toContain('Total scenes: 3');
  });

  test('includes current scene info', () => {
    const ctx = buildStateContext(makeStoreState());
    expect(ctx).toContain('Current scene: "什么是光合作用"');
    expect(ctx).toContain('slide');
  });

  test('slide scene shows element count only (no details)', () => {
    const ctx = buildStateContext(makeStoreState());
    expect(ctx).toContain('Slide has 3 elements');
    // Should NOT contain element content
    expect(ctx).not.toContain('光合作用定义');
    expect(ctx).not.toContain('反应方程式');
  });

  test('quiz scene includes question summary', () => {
    const ctx = buildStateContext(makeStoreState({ currentSceneId: 'scene-2' }));
    expect(ctx).toContain('Quiz questions (2)');
    expect(ctx).toContain('光合作用的产物是什么');
    expect(ctx).toContain('光合作用发生在哪个细胞器');
  });

  test('includes scene list', () => {
    const ctx = buildStateContext(makeStoreState());
    expect(ctx).toContain('Scenes:');
    expect(ctx).toContain('什么是光合作用');
    expect(ctx).toContain('随堂测验');
  });

  test('handles no current scene', () => {
    const ctx = buildStateContext(makeStoreState({ currentSceneId: null }));
    expect(ctx).toContain('No scene currently selected');
  });

  test('handles empty scenes', () => {
    const ctx = buildStateContext(makeStoreState({ scenes: [], currentSceneId: null }));
    expect(ctx).toContain('Total scenes: 0');
    expect(ctx).not.toContain('Scenes:');
  });

  test('handles missing stage', () => {
    const ctx = buildStateContext(makeStoreState({ stage: undefined }));
    expect(ctx).not.toContain('Course:');
  });

  test('truncates scene list to 5', () => {
    const manyScenes = Array.from({ length: 8 }, (_, i) => ({
      id: `scene-${i}`,
      title: `Scene ${i}`,
      type: 'slide' as const,
      order: i,
      content: { type: 'slide' as const, canvas: { elements: [] } },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    const ctx = buildStateContext(makeStoreState({ scenes: manyScenes, currentSceneId: 'scene-0' }));
    expect(ctx).toContain('... and 3 more');
  });
});

// ─── buildStructuredPrompt ───

describe('buildStructuredPrompt', () => {
  // buildStructuredPrompt reads from disk (role templates, prompt templates).
  // We test it with the actual templates to verify integration.
  test('produces a non-empty system prompt', async () => {
    const { buildStructuredPrompt } = await import('@/lib/orchestration/prompt-builder');
    const agentConfig = {
      id: 'default-1',
      role: 'teacher' as const,
      name: '王老师',
      persona: '耐心细致的老师',
      allowedActions: ['spotlight', 'laser', 'wb_open', 'wb_draw_text'],
      priority: 10,
      avatar: '/avatars/teacher.svg',
    };
    const storeState = makeStoreState();

    const prompt = buildStructuredPrompt(agentConfig, storeState);
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('王老师');
    expect(prompt).toContain('JSON array');
  });

  test('includes discussion context when provided', async () => {
    const { buildStructuredPrompt } = await import('@/lib/orchestration/prompt-builder');
    const agentConfig = {
      id: 'default-1',
      role: 'teacher' as const,
      name: '王老师',
      persona: '耐心细致的老师',
      allowedActions: ['spotlight'],
      priority: 10,
    };
    const storeState = makeStoreState();

    const prompt = buildStructuredPrompt(
      agentConfig,
      storeState,
      { topic: '光合作用的条件', prompt: '讨论光照和温度的影响' },
    );
    expect(prompt).toContain('光合作用的条件');
    expect(prompt).toContain('光照和温度');
  });

  test('includes user profile when provided', async () => {
    const { buildStructuredPrompt } = await import('@/lib/orchestration/prompt-builder');
    const agentConfig = {
      id: 'default-1',
      role: 'teacher' as const,
      name: '王老师',
      persona: '耐心细致的老师',
      allowedActions: [],
      priority: 10,
    };
    const storeState = makeStoreState();

    const prompt = buildStructuredPrompt(
      agentConfig,
      storeState,
      undefined,
      undefined,
      { nickname: '小明', bio: '初中二年级学生' },
    );
    expect(prompt).toContain('小明');
    expect(prompt).toContain('初中二年级');
  });

  test('student role gets shorter guidelines', async () => {
    const { buildStructuredPrompt } = await import('@/lib/orchestration/prompt-builder');
    const teacherConfig = {
      id: 'teacher-1',
      role: 'teacher' as const,
      name: '老师',
      persona: '',
      allowedActions: ['spotlight'],
      priority: 10,
    };
    const studentConfig = {
      id: 'student-1',
      role: 'student' as const,
      name: '小明',
      persona: '',
      allowedActions: [],
      priority: 1,
    };
    const storeState = makeStoreState();

    const teacherPrompt = buildStructuredPrompt(teacherConfig, storeState);
    const studentPrompt = buildStructuredPrompt(studentConfig, storeState);

    // Teacher should have more detailed guidelines
    expect(teacherPrompt.length).toBeGreaterThan(studentPrompt.length);
  });
});

// ─── buildDirectorPrompt ───

describe('buildDirectorPrompt', () => {
  test('produces a non-empty director prompt', async () => {
    const { buildDirectorPrompt } = await import('@/lib/orchestration/director-prompt');
    const agents = [
      { id: 'teacher-1', role: 'teacher' as const, name: '王老师', persona: '', allowedActions: [], priority: 10 },
      { id: 'student-1', role: 'student' as const, name: '小明', persona: '', allowedActions: [], priority: 1 },
    ];

    const prompt = buildDirectorPrompt(
      agents,
      'No conversation history yet.',
      [],
      0,
    );
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt).toContain('teacher-1');
    expect(prompt).toContain('student-1');
  });

  test('includes conversation summary', async () => {
    const { buildDirectorPrompt } = await import('@/lib/orchestration/director-prompt');
    const agents = [
      { id: 'teacher-1', role: 'teacher' as const, name: '老师', persona: '', allowedActions: [], priority: 10 },
    ];

    const prompt = buildDirectorPrompt(
      agents,
      '[User] 什么是光合作用？\n[Assistant] 光合作用是...',
      [],
      1,
    );
    expect(prompt).toContain('什么是光合作用');
  });

  test('includes discussion context', async () => {
    const { buildDirectorPrompt } = await import('@/lib/orchestration/director-prompt');
    const agents = [
      { id: 'teacher-1', role: 'teacher' as const, name: '老师', persona: '', allowedActions: [], priority: 10 },
    ];

    const prompt = buildDirectorPrompt(
      agents,
      'No conversation history yet.',
      [],
      0,
      { topic: '实验设计', prompt: '讨论对照实验' },
    );
    expect(prompt).toContain('实验设计');
  });

  test('includes user profile', async () => {
    const { buildDirectorPrompt } = await import('@/lib/orchestration/director-prompt');
    const agents = [
      { id: 'teacher-1', role: 'teacher' as const, name: '老师', persona: '', allowedActions: [], priority: 10 },
    ];

    const prompt = buildDirectorPrompt(
      agents,
      'No conversation history yet.',
      [],
      0,
      undefined,
      undefined,
      undefined,
      { nickname: '小红' },
    );
    expect(prompt).toContain('小红');
  });
});
