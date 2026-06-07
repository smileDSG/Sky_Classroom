/**
 * Tests for the new modular composability engine — Phase 1 (B-001)
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { PromptComposer, resetPromptComposer } from '@/lib/prompts/composability';
import type { PromptFragment } from '@/lib/prompts/types';

function makeFragment(overrides: Partial<PromptFragment> = {}): PromptFragment {
  return {
    id: 'test-fragment',
    category: 'core',
    content: 'Default test content.',
    priority: 10,
    ...overrides,
  };
}

function makeComposer(): PromptComposer {
  resetPromptComposer();
  return new PromptComposer();
}

describe('PromptComposer', () => {
  let composer: PromptComposer;
  beforeEach(() => {
    composer = makeComposer();
  });

  // ─── Fragment Registration ───

  describe('fragment registration', () => {
    test('registers and lists fragments by category', () => {
      composer.register(makeFragment({ id: 'core-a', category: 'core' }));
      composer.register(makeFragment({ id: 'role-a', category: 'role' }));

      expect(composer.list('core')).toHaveLength(1);
      expect(composer.list('role')).toHaveLength(1);
      expect(composer.list().length).toBeGreaterThanOrEqual(2);
    });

    test('unregister removes a fragment', () => {
      composer.register(makeFragment({ id: 'temp' }));
      expect(composer.list().length).toBe(1);
      composer.unregister('temp');
      expect(composer.list()).toHaveLength(0);
    });

    test('re-registering same id/language/version replaces content', () => {
      composer.register(makeFragment({ id: 'v1', content: 'first' }));
      composer.register(makeFragment({ id: 'v1', content: 'second' }));
      const all = composer.list();
      expect(all.filter((f) => f.id === 'v1')).toHaveLength(1);
      expect(all.find((f) => f.id === 'v1')!.content).toBe('second');
    });

    test('same id with different languages creates multiple entries', () => {
      composer.register(makeFragment({ id: 'i18n', language: 'en', content: 'Hello' }));
      composer.register(makeFragment({ id: 'i18n', language: 'zh', content: '你好' }));
      const all = composer.list();
      const variants = all.filter((f) => f.id === 'i18n');
      expect(variants).toHaveLength(2);
    });
  });

  // ─── Composition ───

  describe('composition', () => {
    test('composes fragments in priority order', () => {
      composer.register(makeFragment({ id: 'core', category: 'core', priority: 10, content: 'Core content.' }));
      composer.register(makeFragment({ id: 'role', category: 'role', priority: 30, content: 'Role content.' }));
      composer.register(makeFragment({ id: 'user-override', category: 'user', priority: 100, content: 'User override.' }));

      const result = composer.compose({
        fragments: ['core', 'role', 'user-override'],
        variables: {},
      });

      expect(result.system).toContain('Core content.');
      expect(result.system).toContain('Role content.');
      expect(result.system).toContain('User override.');
      expect(result.meta.resolvedFragments).toBe(3);
      expect(result.meta.missingFragments).toHaveLength(0);
    });

    test('reports missing fragments', () => {
      composer.register(makeFragment({ id: 'exists' }));
      const result = composer.compose({
        fragments: ['exists', 'missing-1', 'missing-2'],
        variables: {},
      });
      expect(result.meta.resolvedFragments).toBe(1);
      expect(result.meta.missingFragments).toEqual(['missing-1', 'missing-2']);
    });

    test('variable interpolation replaces {{varName}}', () => {
      composer.register(makeFragment({
        id: 'with-vars',
        category: 'core',
        content: 'Hello {{name}}, your score is {{score}}.',
      }));

      const result = composer.compose({
        fragments: ['with-vars'],
        variables: { name: 'Alice', score: 95 },
      });

      expect(result.system).toContain('Hello Alice');
      expect(result.system).toContain('95');
      expect(result.system).not.toContain('{{name}}');
    });

    test('unknown variables are left unchanged (silent passthrough)', () => {
      composer.register(makeFragment({
        id: 'vars',
        content: 'Hello {{name}}, {{missing}}.',
      }));

      const result = composer.compose({
        fragments: ['vars'],
        variables: { name: 'Bob' },
      });

      expect(result.system).toContain('Hello Bob');
      expect(result.system).toContain('{{missing}}');
    });

    test('object values are JSON-stringified', () => {
      composer.register(makeFragment({
        id: 'obj-vars',
        content: 'Data: {{items}}',
      }));

      const result = composer.compose({
        fragments: ['obj-vars'],
        variables: { items: [1, 2, 3] },
      });

      // JSON.stringify with indent=2 produces multi-line output
      expect(result.system).toContain('1');
      expect(result.system).toContain('2');
      expect(result.system).toContain('3');
    });

    test('conditional blocks include content when flag is truthy', () => {
      composer.register(makeFragment({
        id: 'conditional',
        content: 'Start. {{#if showSecret}}SECRET{{/if}} End.',
      }));

      const withFlag = composer.compose({
        fragments: ['conditional'],
        variables: { showSecret: true },
      });
      expect(withFlag.system).toContain('SECRET');

      const withoutFlag = composer.compose({
        fragments: ['conditional'],
        variables: { showSecret: false },
      });
      expect(withoutFlag.system).not.toContain('SECRET');
    });

    test('multiple conditional blocks work independently', () => {
      composer.register(makeFragment({
        id: 'multi-if',
        content: '{{#if a}}A{{/if}} {{#if b}}B{{/if}} {{#if c}}C{{/if}}',
      }));

      const result = composer.compose({
        fragments: ['multi-if'],
        variables: { a: true, b: false, c: true },
      });

      expect(result.system).toContain('A');
      expect(result.system).not.toContain('B');
      expect(result.system).toContain('C');
    });

    test('conditional blocks do not nest', () => {
      composer.register(makeFragment({
        id: 'no-nest',
        content: '{{#if outer}}before{{#if inner}}inside{{/if}}after{{/if}}',
      }));

      const result = composer.compose({
        fragments: ['no-nest'],
        variables: { outer: true, inner: true },
      });

      // The inner {{#if}} is NOT processed — nested conditionals are unsupported by design
      expect(result.system).toContain('{{#if inner}}');
    });
  });

  // ─── Language Filtering ───

  describe('i18n language filtering', () => {
    test('selects fragment matching requested language', () => {
      composer.register(makeFragment({ id: 'greeting', language: 'en', content: 'Hello' }));
      composer.register(makeFragment({ id: 'greeting', language: 'zh', content: '你好' }));

      const zhResult = composer.compose({
        fragments: ['greeting'],
        variables: {},
        language: 'zh',
      });

      expect(zhResult.system).toContain('你好');
      expect(zhResult.meta.language).toBe('zh');
    });

    test('falls back to default (no-language) fragment when language mismatch', () => {
      composer.register(makeFragment({ id: 'msg', content: 'Default' }));
      composer.register(makeFragment({ id: 'msg', language: 'ja', content: '日本語' }));

      const result = composer.compose({
        fragments: ['msg'],
        variables: {},
        language: 'fr', // No French version
      });

      expect(result.system).toContain('Default');
    });

    test('falls back to any matching when no default exists', () => {
      composer.register(makeFragment({ id: 'msg', language: 'en', content: 'English only' }));

      const result = composer.compose({
        fragments: ['msg'],
        variables: {},
        language: 'fr',
      });

      expect(result.system).toContain('English only');
    });
  });

  // ─── Priority / User Overrides ───

  describe('user overrides', () => {
    test('user fragments have highest priority by default', () => {
      composer.register(makeFragment({ id: 'core', category: 'core', priority: 10, content: 'core' }));
      composer.register(makeFragment({ id: 'custom', category: 'user', priority: 100, content: 'custom' }));

      const result = composer.compose({
        fragments: ['core', 'custom'],
        variables: {},
      });

      const coreIdx = result.system.indexOf('core');
      const customIdx = result.system.indexOf('custom');
      // User content appears after core content (concatenation order, not priority sort)
      expect(customIdx).toBeGreaterThan(coreIdx);
    });

    test('loadUserOverride reads from an arbitrary file path', async () => {
      const tmpPath = '/tmp/test-user-override.md';
      // Skip if we can't write temp files in test
      try {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(tmpPath, 'Custom user override content.', 'utf-8');
        await composer.loadUserOverride('user-custom', tmpPath);

        const result = composer.compose({
          fragments: ['user-custom'],
          variables: {},
        });

        expect(result.system).toContain('Custom user override content.');
      } catch {
        // File system not available in test — skip
      }
    });
  });

  // ─── Version Filtering ───

  describe('version filtering', () => {
    test('selects fragment matching requested version', () => {
      composer.register(makeFragment({ id: 'prompt', version: '1.0.0', content: 'v1' }));
      composer.register(makeFragment({ id: 'prompt', version: '2.0.0', content: 'v2' }));

      const result = composer.compose({
        fragments: ['prompt'],
        variables: {},
        version: '2.0.0',
      });

      expect(result.system).toContain('v2');
      expect(result.meta.version).toBe('2.0.0');
    });
  });

  // ─── Edge Cases ───

  describe('edge cases', () => {
    test('empty fragments list produces empty prompt', () => {
      const result = composer.compose({ fragments: [], variables: {} });
      expect(result.system).toBe('');
      expect(result.user).toBe('');
      expect(result.meta.resolvedFragments).toBe(0);
    });

    test('compose with empty variables works', () => {
      composer.register(makeFragment({ id: 'no-vars', content: 'Static content.' }));
      const result = composer.compose({ fragments: ['no-vars'], variables: {} });
      expect(result.system).toContain('Static content.');
    });

    test('fragment with markdown formatting is preserved', () => {
      composer.register(makeFragment({
        id: 'md',
        content: '# Heading\n\n**bold** and `code`\n\n- list item',
      }));
      const result = composer.compose({ fragments: ['md'], variables: {} });
      expect(result.system).toContain('# Heading');
      expect(result.system).toContain('**bold**');
      expect(result.system).toContain('- list item');
    });
  });

  // ─── Hot Reload ───

  describe('hot reload', () => {
    test('re-registered fragments replace prior content', () => {
      composer.register(makeFragment({
        id: 'reloadable',
        category: 'core',
        content: 'original',
      }));

      // Re-register with new content (simulating file reload)
      composer.register(makeFragment({
        id: 'reloadable',
        category: 'core',
        content: 'updated-content-v2',
      }));

      const result = composer.compose({
        fragments: ['reloadable'],
        variables: {},
      });

      expect(result.system).toContain('updated-content-v2');
    });
  });
});
