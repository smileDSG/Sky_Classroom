/**
 * Tests for the prompt version manager — Phase 1 (B-001)
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { VersionManager, resetVersionManager } from '@/lib/prompts/version-manager';
import type { PromptVersion, ABTestConfig } from '@/lib/prompts/types';

function makeVersion(overrides: Partial<PromptVersion> = {}): PromptVersion {
  return {
    id: 'test-v1',
    promptId: 'test-prompt',
    version: '1.0.0',
    content: 'Default version content.',
    metadata: { createdAt: new Date().toISOString() },
    ...overrides,
  };
}

function makeABTest(overrides: Partial<ABTestConfig> = {}): ABTestConfig {
  return {
    id: 'ab-test-1',
    promptId: 'test-prompt',
    variantA: 'v1.0.0',
    variantB: 'v2.0.0',
    trafficSplit: 0.5,
    startAt: new Date().toISOString(),
    enabled: true,
    ...overrides,
  };
}

function makeManager(): VersionManager {
  resetVersionManager();
  return new VersionManager();
}

describe('VersionManager', () => {
  let vm: VersionManager;
  beforeEach(() => {
    vm = makeManager();
  });

  // ─── Version Registration ───

  describe('version registration', () => {
    test('registers and retrieves a version', () => {
      const v = makeVersion();
      vm.registerVersion(v);
      expect(vm.getVersion('test-prompt', '1.0.0')).toEqual(v);
    });

    test('returns null for unknown version', () => {
      expect(vm.getVersion('unknown', '1.0.0')).toBeNull();
      expect(vm.getVersion('test-prompt', '99.0.0')).toBeNull();
    });

    test('lists all versions for a prompt', () => {
      vm.registerVersion(makeVersion({ id: 'v1', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v2', version: '2.0.0' }));
      expect(vm.listVersions('test-prompt')).toHaveLength(2);
    });

    test('re-registering same version replaces content', () => {
      vm.registerVersion(makeVersion({ version: '1.0.0', content: 'first' }));
      vm.registerVersion(makeVersion({ version: '1.0.0', content: 'second' }));
      const v = vm.getVersion('test-prompt', '1.0.0');
      expect(v!.content).toBe('second');
      // Should still have only one entry
      expect(vm.listVersions('test-prompt')).toHaveLength(1);
    });

    test('getLatestVersion returns highest semver', () => {
      vm.registerVersion(makeVersion({ id: 'v1', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v2', version: '2.1.0' }));
      vm.registerVersion(makeVersion({ id: 'v3', version: '1.5.0' }));
      expect(vm.getLatestVersion('test-prompt')!.version).toBe('2.1.0');
    });

    test('getLatestVersion returns null for empty prompt', () => {
      expect(vm.getLatestVersion('nonexistent')).toBeNull();
    });
  });

  // ─── Version Resolution ───

  describe('version resolution', () => {
    test('resolves to latest version when no A/B test active', () => {
      vm.registerVersion(makeVersion({ id: 'v1', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v2', version: '2.0.0' }));
      expect(vm.resolveVersion('test-prompt')).toBe('2.0.0');
    });

    test('resolves to null when no versions exist', () => {
      expect(vm.resolveVersion('empty')).toBeNull();
    });

    test('with A/B test, resolves to one of the two variants', () => {
      vm.registerVersion(makeVersion({ id: 'v-bb84a', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v-7c92f', version: '2.0.0' }));
      vm.createABTest(makeABTest({ variantA: 'v-bb84a', variantB: 'v-7c92f', trafficSplit: 0.5 }));

      // Run multiple times to verify both variants appear
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        results.add(vm.resolveVersion('test-prompt')!);
      }
      // With 0.5 split, we expect both variants (probabilistically near-certain with 100 iterations)
      expect(results.has('1.0.0')).toBe(true);
      expect(results.has('2.0.0')).toBe(true);
    });

    test('A/B test with trafficSplit=0 always returns variant A', () => {
      vm.registerVersion(makeVersion({ id: 'v-a', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v-b', version: '2.0.0' }));
      vm.createABTest(makeABTest({ variantA: 'v-a', variantB: 'v-b', trafficSplit: 0 }));

      for (let i = 0; i < 50; i++) {
        expect(vm.resolveVersion('test-prompt')).toBe('1.0.0');
      }
    });

    test('A/B test with trafficSplit=1 always returns variant B', () => {
      vm.registerVersion(makeVersion({ id: 'v-a', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v-b', version: '2.0.0' }));
      vm.createABTest(makeABTest({ variantA: 'v-a', variantB: 'v-b', trafficSplit: 1 }));

      for (let i = 0; i < 50; i++) {
        expect(vm.resolveVersion('test-prompt')).toBe('2.0.0');
      }
    });

    test('disabled A/B test falls back to latest', () => {
      vm.registerVersion(makeVersion({ id: 'v1', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v2', version: '2.0.0' }));
      vm.createABTest(makeABTest({ enabled: false }));
      expect(vm.resolveVersion('test-prompt')).toBe('2.0.0');
    });
  });

  // ─── A/B Test Management ───

  describe('A/B test management', () => {
    test('creates and retrieves A/B test', () => {
      vm.createABTest(makeABTest());
      const ab = vm.getABTest('test-prompt');
      expect(ab).not.toBeNull();
      expect(ab!.id).toBe('ab-test-1');
      expect(ab!.trafficSplit).toBe(0.5);
    });

    test('rejects invalid traffic split', () => {
      expect(() => vm.createABTest(makeABTest({ trafficSplit: 1.5 }))).toThrow();
      expect(() => vm.createABTest(makeABTest({ trafficSplit: -0.1 }))).toThrow();
    });

    test('accepts valid traffic split boundaries', () => {
      expect(() => vm.createABTest(makeABTest({ trafficSplit: 0 }))).not.toThrow();
      expect(() => vm.createABTest(makeABTest({ trafficSplit: 1 }))).not.toThrow();
    });

    test('returns null for prompt without A/B test', () => {
      expect(vm.getABTest('no-test')).toBeNull();
    });

    test('listABTests returns all active tests', () => {
      vm.registerVersion(makeVersion({ id: 'v1', version: '1.0.0', promptId: 'p1' }));
      vm.registerVersion(makeVersion({ id: 'v2', version: '2.0.0', promptId: 'p2' }));
      vm.createABTest(makeABTest({ promptId: 'p1' }));
      vm.createABTest(makeABTest({ id: 'ab-2', promptId: 'p2' }));
      expect(vm.listABTests()).toHaveLength(2);
    });
  });

  // ─── Metrics ───

  describe('metrics', () => {
    test('records and retrieves metrics', () => {
      vm.createABTest(makeABTest());
      vm.recordMetric('ab-test-1', 'A', { tokenUsage: 100 });
      vm.recordMetric('ab-test-1', 'A', { tokenUsage: 200 });
      vm.recordMetric('ab-test-1', 'B', { tokenUsage: 150 });

      const m = vm.getMetrics('ab-test-1');
      expect(m).not.toBeNull();
      expect(m!.variantA.calls).toBe(2);
      expect(m!.variantA.avgTokenUsage).toBeCloseTo(150);
      expect(m!.variantB.calls).toBe(1);
      expect(m!.variantB.avgTokenUsage).toBeCloseTo(150);
    });

    test('records score metrics', () => {
      vm.createABTest(makeABTest());
      vm.recordMetric('ab-test-1', 'A', { score: 0.8 });
      vm.recordMetric('ab-test-1', 'A', { score: 0.9 });
      vm.recordMetric('ab-test-1', 'B', { score: 0.7 });

      const m = vm.getMetrics('ab-test-1');
      expect(m!.variantA.avgScore).toBeCloseTo(0.85);
      expect(m!.variantB.avgScore).toBeCloseTo(0.7);
    });

    test('returns null for unknown A/B test', () => {
      expect(vm.getMetrics('nonexistent')).toBeNull();
    });

    test('metrics are independent across A/B tests', () => {
      vm.createABTest(makeABTest({ id: 'ab-1', promptId: 'p1' }));
      vm.createABTest(makeABTest({ id: 'ab-2', promptId: 'p2' }));
      vm.recordMetric('ab-1', 'A', { calls: 1 });
      vm.recordMetric('ab-2', 'A', { calls: 1 });

      expect(vm.getMetrics('ab-1')!.variantA.calls).toBe(1);
      expect(vm.getMetrics('ab-2')!.variantA.calls).toBe(1);
    });
  });

  // ─── Semver Comparison ───

  describe('semver comparison', () => {
    test('resolves highest version correctly', () => {
      vm.registerVersion(makeVersion({ id: 'v1', version: '0.9.0' }));
      vm.registerVersion(makeVersion({ id: 'v2', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v3', version: '10.0.0' }));
      // 10.x should be higher than 1.x (not lexicographic sort)
      expect(vm.getLatestVersion('test-prompt')!.version).toBe('10.0.0');
    });

    test('patch version comparison', () => {
      vm.registerVersion(makeVersion({ id: 'v1', version: '1.0.0' }));
      vm.registerVersion(makeVersion({ id: 'v2', version: '1.0.1' }));
      expect(vm.getLatestVersion('test-prompt')!.version).toBe('1.0.1');
    });
  });
});
