/**
 * Phase 5 (B-001): Integration & regression tests
 *
 * Validates:
 * - Language directive present in all generator templates (regression for Phase 4 bugfix)
 * - Hot-reload file watching
 * - i18n prompt overrides
 * - User-defined fragment overrides
 * - Full generation pipeline fragment composition
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PromptComposer, resetPromptComposer } from '@/lib/prompts/composability';
import { VersionManager, resetVersionManager } from '@/lib/prompts/version-manager';
import type { PromptFragment } from '@/lib/prompts/types';
import { resolvePromptLocale, getPromptOverrides } from '@/lib/prompts/i18n/index';

const promptsDir = path.join(process.cwd(), 'lib', 'prompts');
const generatorsDir = path.join(promptsDir, 'generators');

function makeComposer(): PromptComposer {
  resetPromptComposer();
  return new PromptComposer();
}

function loadGenerator(filename: string): string {
  return fs.readFileSync(path.join(generatorsDir, filename), 'utf-8');
}

// ─── Regression: Language Directive ───

const TEMPLATES_WITH_LANGUAGE_DIRECTIVE = [
  'slide-content.md',
  'slide-actions.md',
  'quiz.md',
  'quiz-actions.md',
  'interactive-actions.md',
  'widget-teacher-actions.md',
  'pbl-actions.md',
];

describe('Phase 5: Language directive regression', () => {
  for (const filename of TEMPLATES_WITH_LANGUAGE_DIRECTIVE) {
    test(`${filename} contains {{languageDirective}}`, () => {
      const content = loadGenerator(filename);
      expect(content).toContain('{{languageDirective}}');
    });
  }

  test('slide-content.md contains all scene variables', () => {
    const content = loadGenerator('slide-content.md');
    expect(content).toContain('{{title}}');
    expect(content).toContain('{{description}}');
    expect(content).toContain('{{keyPoints}}');
    expect(content).toContain('{{languageDirective}}');
    expect(content).toContain('{{canvas_width}}');
    expect(content).toContain('{{canvas_height}}');
  });

  test('slide-actions.md contains all scene variables', () => {
    const content = loadGenerator('slide-actions.md');
    expect(content).toContain('{{elements}}');
    expect(content).toContain('{{title}}');
    expect(content).toContain('{{keyPoints}}');
    expect(content).toContain('{{languageDirective}}');
    expect(content).toContain('{{courseContext}}');
  });

  test('quiz.md contains all scene variables', () => {
    const content = loadGenerator('quiz.md');
    expect(content).toContain('{{questionCount}}');
    expect(content).toContain('{{difficulty}}');
    expect(content).toContain('{{questionTypes}}');
    expect(content).toContain('{{languageDirective}}');
  });

  test('language directive survives composition', () => {
    const composer = makeComposer();
    const content = loadGenerator('slide-content.md');
    composer.register({ id: 'slide-content', category: 'generator', content, priority: 20 });

    const result = composer.compose({
      fragments: ['slide-content'],
      variables: {
        canvas_width: 1000,
        canvas_height: 562,
        languageDirective: '讲中文 | Teach in Chinese only.',
        title: '测试标题',
        description: '测试描述',
        keyPoints: '1. 第一点\n2. 第二点',
      },
    });

    expect(result.system).toContain('讲中文');
    expect(result.system).toContain('测试标题');
    expect(result.system).toContain('测试描述');
    expect(result.system).not.toContain('{{languageDirective}}');
    expect(result.system).not.toContain('{{title}}');
  });
});

// ─── Hot-reload ───

describe('Phase 5: Hot-reload', () => {
  const testFile = path.join(generatorsDir, '__hot_reload_test__.md');
  const testFragmentId = '__hot_reload_test__';

  afterEach(() => {
    try { fs.unlinkSync(testFile); } catch { /* clean */ }
    resetPromptComposer();
  });

  test('composer.reload() picks up file changes', async () => {
    // Write a test file
    fs.writeFileSync(testFile, 'Initial content.', 'utf-8');

    const composer = makeComposer();
    composer.register({
      id: testFragmentId,
      category: 'generator',
      content: 'Initial content.',
      priority: 20,
    });

    // Modify the file on disk
    fs.writeFileSync(testFile, 'Updated content after hot-reload.', 'utf-8');

    // Reload
    await composer.reload(testFragmentId);

    const result = composer.compose({
      fragments: [testFragmentId],
      variables: {},
    });

    expect(result.system).toContain('Updated content after hot-reload');
  });

  test('composer registers and reloads generator fragments correctly', async () => {
    fs.writeFileSync(testFile, 'Hot reload test content.', 'utf-8');

    const composer = makeComposer();
    composer.register({
      id: testFragmentId,
      category: 'generator',
      content: 'Original registered content.',
      priority: 20,
    });

    // Reload should update from disk
    await composer.reload(testFragmentId);

    const result = composer.compose({
      fragments: [testFragmentId],
      variables: {},
    });

    expect(result.system).toContain('Hot reload test content');
  });
});

// ─── i18n Overrides ───

describe('Phase 5: i18n overrides', () => {
  test('resolvePromptLocale maps zh-CN to zh', () => {
    expect(resolvePromptLocale('zh-CN')).toBe('zh');
    expect(resolvePromptLocale('zh-TW')).toBe('zh');
  });

  test('resolvePromptLocale returns undefined for English', () => {
    expect(resolvePromptLocale('en-US')).toBeUndefined();
    expect(resolvePromptLocale('en')).toBeUndefined();
  });

  test('resolvePromptLocale maps ja-JP to ja', () => {
    expect(resolvePromptLocale('ja-JP')).toBe('ja');
  });

  test('resolvePromptLocale maps ru-RU to ru', () => {
    expect(resolvePromptLocale('ru-RU')).toBe('ru');
  });

  test('resolvePromptLocale returns undefined for unmapped locales', () => {
    expect(resolvePromptLocale('ar-SA')).toBeUndefined();
    expect(resolvePromptLocale(undefined)).toBeUndefined();
  });

  test('getPromptOverrides returns empty for English', async () => {
    const overrides = await getPromptOverrides('en');
    expect(overrides).toEqual({});
  });

  test('getPromptOverrides returns overrides for zh', async () => {
    const overrides = await getPromptOverrides('zh');
    // Should contain at least the output-format override
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
    expect(overrides['core/output-format']).toBeDefined();
    expect(overrides['core/output-format']).toContain('输出格式');
    expect(overrides['roles/teacher']).toBeDefined();
    expect(overrides['roles/teacher']).toContain('主讲教师');
  });

  test('composer supports language-specific fragments', () => {
    const composer = makeComposer();
    composer.register({
      id: 'i18n-test',
      category: 'core',
      content: 'English baseline content.',
      priority: 10,
    });
    composer.register({
      id: 'i18n-test',
      category: 'core',
      content: '中文覆盖内容。',
      priority: 10,
      language: 'zh',
    });

    // English
    const enResult = composer.compose({
      fragments: ['i18n-test'],
      variables: {},
      language: 'en',
    });
    expect(enResult.system).toContain('English baseline content');

    // Chinese
    const zhResult = composer.compose({
      fragments: ['i18n-test'],
      variables: {},
      language: 'zh',
    });
    expect(zhResult.system).toContain('中文覆盖内容');
  });

  test('i18n falls back to default when language not found', () => {
    const composer = makeComposer();
    composer.register({
      id: 'i18n-fallback',
      category: 'core',
      content: 'Default fallback content.',
      priority: 10,
    });

    const result = composer.compose({
      fragments: ['i18n-fallback'],
      variables: {},
      language: 'ja',
    });
    expect(result.system).toContain('Default fallback content');
  });
});

// ─── User Overrides ───

describe('Phase 5: User overrides', () => {
  test('user fragments override lower-priority fragments', () => {
    const composer = makeComposer();
    composer.register({
      id: 'override-test',
      category: 'core',
      content: 'Core default content.',
      priority: 10,
    });
    composer.register({
      id: 'override-test',
      category: 'user',
      content: 'User-customized content.',
      priority: 100,
    });

    const result = composer.compose({
      fragments: ['override-test'],
      variables: {},
    });

    // User override (higher priority) should win
    expect(result.system).toContain('User-customized content');
  });

  test('loadUserOverride loads from external file', async () => {
    const userFile = path.join(promptsDir, '__user_override_test__.md');
    fs.writeFileSync(userFile, 'Custom user override from file.', 'utf-8');

    try {
      const composer = makeComposer();
      await composer.loadUserOverride('slide-content', userFile);

      const result = composer.compose({
        fragments: ['slide-content'],
        variables: { canvas_width: 1000, canvas_height: 562 },
      });

      expect(result.system).toContain('Custom user override from file');
    } finally {
      try { fs.unlinkSync(userFile); } catch { /* clean */ }
    }
  });
});

// ─── Version Manager / A/B Testing ───

describe('Phase 5: A/B testing framework', () => {
  let vm: VersionManager;

  beforeEach(() => {
    resetVersionManager();
    vm = new VersionManager();
  });

  test('registers and retrieves a version', () => {
    vm.registerVersion({
      id: 'v1',
      promptId: 'slide-content',
      version: '1.0.0',
      content: 'Version 1 content.',
      metadata: { author: 'test', createdAt: new Date().toISOString() },
    });

    const v = vm.getVersion('slide-content', '1.0.0');
    expect(v).not.toBeNull();
    expect(v!.content).toBe('Version 1 content.');
  });

  test('lists all versions for a prompt', () => {
    vm.registerVersion({
      id: 'v1',
      promptId: 'slide-content',
      version: '1.0.0',
      content: 'v1',
      metadata: { author: 'test', createdAt: new Date().toISOString() },
    });
    vm.registerVersion({
      id: 'v2',
      promptId: 'slide-content',
      version: '1.1.0',
      content: 'v2',
      metadata: { author: 'test', createdAt: new Date().toISOString() },
    });

    const versions = vm.listVersions('slide-content');
    expect(versions).toHaveLength(2);
  });

  test('creates and retrieves an A/B test', () => {
    vm.registerVersion({
      id: 'va',
      promptId: 'slide-content',
      version: '1.0.0',
      content: 'Control',
      metadata: { author: 'test', createdAt: new Date().toISOString() },
    });
    vm.registerVersion({
      id: 'vb',
      promptId: 'slide-content',
      version: '2.0.0',
      content: 'Experiment',
      metadata: { author: 'test', createdAt: new Date().toISOString() },
    });

    vm.createABTest({
      id: 'ab-1',
      promptId: 'slide-content',
      variantA: '1.0.0',
      variantB: '2.0.0',
      trafficSplit: 0.3,
      startAt: new Date().toISOString(),
      enabled: true,
    });

    const ab = vm.getABTest('slide-content');
    expect(ab).not.toBeNull();
    expect(ab!.variantA).toBe('1.0.0');
    expect(ab!.variantB).toBe('2.0.0');
    expect(ab!.trafficSplit).toBe(0.3);
  });

  test('records and retrieves A/B test metrics', () => {
    vm.createABTest({
      id: 'ab-metrics',
      promptId: 'outline',
      variantA: '1.0.0',
      variantB: '2.0.0',
      trafficSplit: 0.5,
      startAt: new Date().toISOString(),
      enabled: true,
    });

    vm.recordMetric('ab-metrics', 'A', { tokens: 100, score: 0.8 });
    vm.recordMetric('ab-metrics', 'A', { tokens: 120, score: 0.9 });
    vm.recordMetric('ab-metrics', 'B', { tokens: 95, score: 0.85 });

    const metrics = vm.getMetrics('ab-metrics');
    expect(metrics).not.toBeNull();
    expect(metrics!.variantA.calls).toBe(2);
    expect(metrics!.variantB.calls).toBe(1);
  });

  test('resolveVersion returns null when no A/B test active', () => {
    const resolved = vm.resolveVersion('slide-content');
    expect(resolved).toBeNull();
  });
});

// ─── Full Pipeline Composition ───

describe('Phase 5: Full pipeline composition', () => {
  test('generates complete slide prompt with language directive', () => {
    const composer = makeComposer();
    composer.register({
      id: 'slide-content',
      category: 'generator',
      content: loadGenerator('slide-content.md'),
      priority: 20,
    });

    const result = composer.compose({
      fragments: ['slide-content'],
      variables: {
        canvas_width: 1000,
        canvas_height: 562,
        title: '概率基础',
        description: '介绍概率的基本概念',
        keyPoints: '1. 随机现象\n2. 样本空间\n3. 事件',
        languageDirective: '使用中文授课。Use Chinese for all content.',
        teacherContext: '',
        imageElementEnabled: false,
        generatedImageEnabled: false,
        generatedVideoEnabled: false,
        mediaElementEnabled: false,
      },
    });

    // Language directive must be present
    expect(result.system).toContain('使用中文授课');
    // Scene variables must be interpolated
    expect(result.system).toContain('概率基础');
    expect(result.system).toContain('随机现象');
    // No un-interpolated placeholders
    expect(result.system).not.toContain('{{languageDirective}}');
    expect(result.system).not.toContain('{{title}}');
    expect(result.system).not.toContain('{{keyPoints}}');
  });

  test('generates complete slide actions prompt with context', () => {
    const composer = makeComposer();
    composer.register({
      id: 'slide-actions',
      category: 'generator',
      content: loadGenerator('slide-actions.md'),
      priority: 20,
    });

    const result = composer.compose({
      fragments: ['slide-actions'],
      variables: {
        elements: 'text_001, chart_001',
        title: '概率基础',
        keyPoints: '随机现象, 样本空间',
        description: '介绍概率基本概念',
        languageDirective: '使用中文授课。',
        courseContext: '第一课：概率统计入门',
        agents: '',
        userProfile: '',
      },
    });

    expect(result.system).toContain('使用中文授课');
    expect(result.system).toContain('概率基础');
    expect(result.system).not.toContain('{{languageDirective}}');
  });

  test('generates complete quiz prompt', () => {
    const composer = makeComposer();
    composer.register({
      id: 'quiz',
      category: 'generator',
      content: loadGenerator('quiz.md'),
      priority: 20,
    });

    const result = composer.compose({
      fragments: ['quiz'],
      variables: {
        title: '概率测验',
        description: '测试概率基础知识',
        keyPoints: '随机试验, 概率计算',
        questionCount: 3,
        difficulty: 'easy',
        questionTypes: 'single, multiple',
        languageDirective: '使用中文出题。',
      },
    });

    expect(result.system).toContain('使用中文出题');
    expect(result.system).toContain('概率测验');
    expect(result.system).not.toContain('{{languageDirective}}');
  });

  test('all 7 fixed templates interpolate language directive', () => {
    const templates = [
      { id: 'slide-content', file: 'slide-content.md', vars: { canvas_width: 1000, canvas_height: 562, title: 'X', description: 'X', keyPoints: 'X', imageElementEnabled: false, generatedImageEnabled: false, generatedVideoEnabled: false, mediaElementEnabled: false, languageDirective: '讲中文', teacherContext: '' } },
      { id: 'slide-actions', file: 'slide-actions.md', vars: { elements: 'x', title: 'X', keyPoints: 'X', description: 'X', languageDirective: '讲中文', courseContext: '', agents: '', userProfile: '' } },
      { id: 'quiz', file: 'quiz.md', vars: { title: 'X', description: 'X', keyPoints: 'X', questionCount: '1', difficulty: 'easy', questionTypes: 'single', languageDirective: '讲中文' } },
      { id: 'quiz-actions', file: 'quiz-actions.md', vars: { questions: 'x', title: 'X', keyPoints: 'X', description: 'X', languageDirective: '讲中文', courseContext: '', agents: '' } },
      { id: 'interactive-actions', file: 'interactive-actions.md', vars: { title: 'X', conceptName: 'X', description: 'X', designIdea: 'X', keyPoints: 'X', languageDirective: '讲中文', courseContext: '', agents: '' } },
      { id: 'widget-teacher-actions', file: 'widget-teacher-actions.md', vars: { widgetType: 'simulation', description: 'X', keyPoints: 'X', widgetConfig: '{}', languageDirective: '讲中文' } },
      { id: 'pbl-actions', file: 'pbl-actions.md', vars: { title: 'X', projectTopic: 'X', projectDescription: 'X', keyPoints: 'X', description: 'X', languageDirective: '讲中文', courseContext: '', agents: '' } },
    ];

    for (const { id, file, vars } of templates) {
      const composer = makeComposer();
      composer.register({ id, category: 'generator', content: loadGenerator(file), priority: 20 });

      const result = composer.compose({ fragments: [id], variables: vars });
      expect(result.system).toContain('讲中文');
      expect(result.system).not.toContain('{{languageDirective}}');
    }
  });
});
