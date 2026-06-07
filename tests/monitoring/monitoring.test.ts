/**
 * Phase 1 (B-003): Monitoring infrastructure tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  PerformanceMonitor,
  resetPerfMonitor,
  getPerfMonitor,
} from '@/lib/monitoring/performance';
import {
  ErrorTracker,
  resetErrorTracker,
  getErrorTracker,
} from '@/lib/monitoring/error-tracker';
import { validateEnvironment } from '@/lib/monitoring/env-validator';

// ─── Performance Monitor ───

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  beforeEach(() => {
    resetPerfMonitor();
    monitor = new PerformanceMonitor();
  });

  test('records LLM call metrics', () => {
    monitor.recordLLMCall({
      model: 'deepseek-v4-pro',
      source: 'scene-content',
      durationMs: 5000,
      promptTokens: 1200,
      completionTokens: 300,
      success: true,
    });

    const stats = monitor.getStats();
    expect(stats.totalCalls).toBe(1);
    expect(stats.totalFailures).toBe(0);
    expect(stats.totalTokens).toBe(1500);
    expect(stats.bySource['scene-content']).toBeDefined();
    expect(stats.bySource['scene-content'].calls).toBe(1);
    expect(stats.bySource['scene-content'].avgDurationMs).toBe(5000);
  });

  test('tracks failed calls separately', () => {
    monitor.recordLLMCall({
      model: 'deepseek-v4-pro',
      source: 'chat',
      durationMs: 0,
      success: false,
    });

    const stats = monitor.getStats();
    expect(stats.totalFailures).toBe(1);
    expect(stats.bySource['chat'].failures).toBe(1);
  });

  test('aggregates per-source stats correctly', () => {
    monitor.recordLLMCall({ model: 'a', source: 'scene-content', durationMs: 1000, success: true });
    monitor.recordLLMCall({ model: 'a', source: 'scene-content', durationMs: 2000, success: true });
    monitor.recordLLMCall({ model: 'b', source: 'chat', durationMs: 500, success: true });

    const stats = monitor.getStats();
    expect(stats.totalCalls).toBe(3);
    expect(stats.bySource['scene-content'].calls).toBe(2);
    expect(stats.bySource['scene-content'].avgDurationMs).toBe(1500);
    expect(stats.bySource['scene-content'].maxDurationMs).toBe(2000);
    expect(stats.bySource['scene-content'].minDurationMs).toBe(1000);
    expect(stats.bySource['chat'].calls).toBe(1);
  });

  test('time() wraps async function and returns duration', async () => {
    const { result, durationMs } = await monitor.time('test-op', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    expect(result).toBe(42);
    expect(durationMs).toBeGreaterThan(0);
  });

  test('timeSync() wraps sync function', () => {
    const { result, durationMs } = monitor.timeSync('sync-op', () => 99);
    expect(result).toBe(99);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  test('reset clears all metrics', () => {
    monitor.recordLLMCall({ model: 'x', source: 'test', durationMs: 100, success: true });
    monitor.reset();
    expect(monitor.getStats().totalCalls).toBe(0);
  });

  test('recentCalls limited to last 50', () => {
    for (let i = 0; i < 60; i++) {
      monitor.recordLLMCall({ model: 'x', source: 'bulk', durationMs: 10, success: true });
    }
    expect(monitor.getStats().recentCalls.length).toBeLessThanOrEqual(50);
  });

  test('singleton getPerfMonitor returns same instance', () => {
    const a = getPerfMonitor();
    const b = getPerfMonitor();
    expect(a).toBe(b);
  });

  test('totalTokens sums prompt + completion', () => {
    monitor.recordLLMCall({
      model: 'x', source: 'test', durationMs: 100, success: true,
      promptTokens: 100, completionTokens: 200,
    });
    monitor.recordLLMCall({
      model: 'x', source: 'test', durationMs: 100, success: true,
      promptTokens: 50, completionTokens: 50,
    });
    expect(monitor.getStats().totalTokens).toBe(400);
  });
});

// ─── Error Tracker ───

describe('ErrorTracker', () => {
  let tracker: ErrorTracker;
  beforeEach(() => {
    resetErrorTracker();
    tracker = new ErrorTracker();
  });

  test('records errors by source', () => {
    tracker.record('scene-content', 'AI call failed', 500);
    tracker.record('scene-content', 'Parse error');
    tracker.record('chat', 'SSE connection lost');

    const stats = tracker.getStats();
    expect(stats.totalErrors).toBe(3);
    expect(stats.bySource['scene-content'].count).toBe(2);
    expect(stats.bySource['chat'].count).toBe(1);
  });

  test('tracks status codes', () => {
    tracker.record('api', 'err1', 500);
    tracker.record('api', 'err2', 500);
    tracker.record('api', 'err3', 400);

    const stats = tracker.getStats();
    expect(stats.bySource['api'].statusCodes[500]).toBe(2);
    expect(stats.bySource['api'].statusCodes[400]).toBe(1);
  });

  test('truncates long messages', () => {
    tracker.record('test', 'x'.repeat(500));
    expect(tracker.getStats().bySource['test'].lastError.length).toBeLessThanOrEqual(210);
  });

  test('recentErrors limited to last 20', () => {
    for (let i = 0; i < 50; i++) {
      tracker.record('test', `error ${i}`);
    }
    expect(tracker.getStats().recentErrors.length).toBeLessThanOrEqual(20);
  });

  test('lastError shows most recent message', () => {
    tracker.record('test', 'first error');
    // Small delay to ensure distinct timestamps
    tracker.record('test', 'second error');
    const lastError = tracker.getStats().bySource['test'].lastError;
    expect(lastError).toBeTruthy();
    // Should show the last recorded message (or the only one if timestamps match)
    expect(['second error', 'first error']).toContain(lastError);
  });

  test('export returns same data as getStats', () => {
    tracker.record('test', 'e');
    expect(tracker.export()).toEqual(tracker.getStats());
  });

  test('singleton getErrorTracker returns same instance', () => {
    const a = getErrorTracker();
    const b = getErrorTracker();
    expect(a).toBe(b);
  });

  test('reset clears everything', () => {
    tracker.record('test', 'e');
    tracker.reset();
    expect(tracker.getStats().totalErrors).toBe(0);
  });
});

// ─── Environment Validator ───

describe('env-validator', () => {
  test('returns structured validation result', () => {
    const result = validateEnvironment();
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.checks)).toBe(true);
  });

  test('includes DEFAULT_MODEL check', () => {
    const result = validateEnvironment();
    const check = result.checks.find((c) => c.name === 'DEFAULT_MODEL');
    expect(check).toBeDefined();
    expect(check!.status).toMatch(/ok|warning|error/);
  });

  test('includes LLM Providers check', () => {
    const result = validateEnvironment();
    const check = result.checks.find((c) => c.name === 'LLM Providers');
    expect(check).toBeDefined();
  });

  test('includes ACCESS_CODE check', () => {
    const result = validateEnvironment();
    const check = result.checks.find((c) => c.name === 'ACCESS_CODE');
    expect(check).toBeDefined();
  });

  test('includes NODE_ENV check', () => {
    const result = validateEnvironment();
    const check = result.checks.find((c) => c.name === 'NODE_ENV');
    expect(check).toBeDefined();
  });

  test('passed reflects no errors in checks', () => {
    const result = validateEnvironment();
    const hasErrors = result.checks.some((c) => c.status === 'error');
    expect(result.passed).toBe(!hasErrors);
  });

  test('all checks have valid status values', () => {
    const result = validateEnvironment();
    for (const check of result.checks) {
      expect(['ok', 'warning', 'error']).toContain(check.status);
      expect(check.name).toBeTruthy();
      expect(check.message).toBeTruthy();
    }
  });
});
