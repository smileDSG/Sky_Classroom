/**
 * B-004: i18n prompt override tests
 *
 * Validates:
 * - Chinese prompt overrides load correctly
 * - Language fallback chain (zh→en)
 * - Composability with language-filtered fragments
 * - zh.ts covers core fragments (output-format, roles, personas)
 */
import { describe, test, expect } from 'vitest';
import { resolvePromptLocale, getPromptOverrides } from '@/lib/prompts/i18n/index';
import { PromptComposer, resetPromptComposer } from '@/lib/prompts/composability';

// ─── Language Resolution ───

describe('i18n: language resolution', () => {
  test('zh-CN → zh', () => {
    expect(resolvePromptLocale('zh-CN')).toBe('zh');
    expect(resolvePromptLocale('zh-TW')).toBe('zh');
  });

  test('en-US → undefined (English is baseline)', () => {
    expect(resolvePromptLocale('en-US')).toBeUndefined();
  });

  test('ja-JP → ja', () => {
    expect(resolvePromptLocale('ja-JP')).toBe('ja');
  });

  test('ru-RU → ru', () => {
    expect(resolvePromptLocale('ru-RU')).toBe('ru');
  });

  test('ar-SA → undefined (Arabic uses English baseline)', () => {
    expect(resolvePromptLocale('ar-SA')).toBeUndefined();
  });

  test('undefined → undefined', () => {
    expect(resolvePromptLocale(undefined)).toBeUndefined();
  });
});

// ─── Override Loading ───

describe('i18n: zh overrides', () => {
  test('getPromptOverrides("zh") returns non-empty object', async () => {
    const overrides = await getPromptOverrides('zh');
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
  });

  test('zh overrides include core/output-format', async () => {
    const overrides = await getPromptOverrides('zh');
    expect(overrides['core/output-format']).toBeDefined();
    expect(overrides['core/output-format']).toContain('输出格式');
  });

  test('zh overrides include roles/teacher', async () => {
    const overrides = await getPromptOverrides('zh');
    expect(overrides['roles/teacher']).toBeDefined();
    expect(overrides['roles/teacher']).toContain('主讲教师');
  });

  test('zh overrides include roles/assistant', async () => {
    const overrides = await getPromptOverrides('zh');
    expect(overrides['roles/assistant']).toBeDefined();
    expect(overrides['roles/assistant']).toContain('助教');
  });

  test('zh overrides include student personas', async () => {
    const overrides = await getPromptOverrides('zh');
    expect(overrides['student-personas/curious']).toBeDefined();
    expect(overrides['student-personas/curious']).toContain('好奇');
    expect(overrides['student-personas/note-taker']).toBeDefined();
    expect(overrides['student-personas/note-taker']).toContain('笔记');
  });

  test('getPromptOverrides("en") returns empty', async () => {
    const overrides = await getPromptOverrides('en');
    expect(overrides).toEqual({});
  });

  test('getPromptOverrides for unsupported locale returns empty', async () => {
    const overrides = await getPromptOverrides('ko' as any);
    expect(Object.keys(overrides).length).toBe(0);
  });
});

// ─── Composability with i18n ───

describe('i18n: composability integration', () => {
  test('language-specific fragment takes priority over default', () => {
    const composer = makeComposer('zh');
    composer.register({
      id: 'test-fragment', category: 'core', content: 'English text.', priority: 10,
    });
    composer.register({
      id: 'test-fragment', category: 'core', content: '中文文本。', priority: 10, language: 'zh',
    });

    const r = composer.compose({ fragments: ['test-fragment'], variables: {}, language: 'zh' });
    expect(r.system).toContain('中文文本');
    expect(r.system).not.toContain('English text');
  });

  test('falls back to default when language variant missing', () => {
    const composer = makeComposer('ja');
    composer.register({
      id: 'ja-fallback', category: 'core', content: 'Default English.', priority: 10,
    });

    const r = composer.compose({ fragments: ['ja-fallback'], variables: {}, language: 'ja' });
    expect(r.system).toContain('Default English');
  });

  test('multiple languages coexist in registry', () => {
    const composer = makeComposer('multi');
    composer.register({
      id: 'ml', category: 'core', content: 'English.', priority: 10,
    });
    composer.register({
      id: 'ml', category: 'core', content: '中文。', priority: 10, language: 'zh',
    });
    composer.register({
      id: 'ml', category: 'core', content: '日本語。', priority: 10, language: 'ja',
    });

    expect(
      composer.compose({ fragments: ['ml'], variables: {}, language: 'en' }).system,
    ).toContain('English');
    expect(
      composer.compose({ fragments: ['ml'], variables: {}, language: 'zh' }).system,
    ).toContain('中文');
    expect(
      composer.compose({ fragments: ['ml'], variables: {}, language: 'ja' }).system,
    ).toContain('日本語');
  });
});

function makeComposer(label: string): PromptComposer {
  resetPromptComposer();
  return new PromptComposer();
}
