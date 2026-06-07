/**
 * P6-001 Test 14: 性能监控 + 错误追踪
 *
 * Tests the monitoring system end-to-end — performance metrics
 * collection, error tracking, and reporting.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
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

// ─── Tests ───

describe('P6-001 Test 14: 性能监控 + 错误追踪', () => {
  describe('performance monitoring flow', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      resetPerfMonitor();
      monitor = new PerformanceMonitor();
    });

    test('records successful LLM call with full metrics', () => {
      monitor.recordLLMCall({
        model: 'claude-sonnet-4-6',
        source: 'scene-content',
        durationMs: 3500,
        promptTokens: 2000,
        completionTokens: 500,
        success: true,
      });

      const stats = monitor.getStats();
      expect(stats.totalCalls).toBe(1);
      expect(stats.totalSuccess).toBe(1);
      expect(stats.totalTokens).toBe(2500);
    });

    test('records failed LLM call', () => {
      monitor.recordLLMCall({
        model: 'openai',
        source: 'chat',
        durationMs: 5000,
        success: false,
      });

      const stats = monitor.getStats();
      expect(stats.totalFailures).toBe(1);
    });

    test('aggregates multiple calls by source', () => {
      monitor.recordLLMCall({ model: 'a', source: 'scene-content', durationMs: 1000, success: true });
      monitor.recordLLMCall({ model: 'a', source: 'scene-content', durationMs: 2000, success: true });
      monitor.recordLLMCall({ model: 'b', source: 'chat', durationMs: 500, success: true });

      const stats = monitor.getStats();
      expect(stats.totalCalls).toBe(3);
      expect(stats.bySource['scene-content'].calls).toBe(2);
      expect(stats.bySource['chat'].calls).toBe(1);
    });

    test('calculates average duration correctly', () => {
      monitor.recordLLMCall({ model: 'a', source: 'test', durationMs: 1000, success: true });
      monitor.recordLLMCall({ model: 'a', source: 'test', durationMs: 3000, success: true });

      const stats = monitor.getStats();
      expect(stats.bySource['test'].avgDurationMs).toBe(2000);
    });

    test('tracks success rate', () => {
      monitor.recordLLMCall({ model: 'a', source: 'test', durationMs: 100, success: true });
      monitor.recordLLMCall({ model: 'a', source: 'test', durationMs: 100, success: false });
      monitor.recordLLMCall({ model: 'a', source: 'test', durationMs: 100, success: true });

      const stats = monitor.getStats();
      expect(stats.successRate).toBeCloseTo(2 / 3, 2);
    });

    test('time() wraps async operations', async () => {
      const { result, durationMs } = await monitor.time('test-op', async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'done';
      });

      expect(result).toBe('done');
      expect(durationMs).toBeGreaterThan(0);
    });

    test('recent calls are capped', () => {
      for (let i = 0; i < 100; i++) {
        monitor.recordLLMCall({ model: 'x', source: 'bulk', durationMs: 10, success: true });
      }

      const stats = monitor.getStats();
      expect(stats.recentCalls.length).toBeLessThanOrEqual(50);
    });

    test('reset clears all data', () => {
      monitor.recordLLMCall({ model: 'a', source: 'test', durationMs: 100, success: true });
      monitor.reset();

      expect(monitor.getStats().totalCalls).toBe(0);
    });

    test('singleton returns same instance', () => {
      const a = getPerfMonitor();
      const b = getPerfMonitor();
      expect(a).toBe(b);
    });
  });

  describe('error tracking flow', () => {
    let tracker: ErrorTracker;

    beforeEach(() => {
      resetErrorTracker();
      tracker = new ErrorTracker();
    });

    test('records errors with source and message', () => {
      tracker.record('scene-content', 'AI call failed', 500);

      const stats = tracker.getStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.bySource['scene-content'].count).toBe(1);
    });

    test('tracks error frequency by source', () => {
      tracker.record('chat', 'SSE error');
      tracker.record('chat', 'SSE error');
      tracker.record('chat', 'Timeout');

      const stats = tracker.getStats();
      expect(stats.bySource['chat'].count).toBe(3);
    });

    test('tracks status codes', () => {
      tracker.record('api', 'Error', 500);
      tracker.record('api', 'Error', 502);
      tracker.record('api', 'Error', 500);

      const stats = tracker.getStats();
      expect(stats.bySource['api'].statusCodes[500]).toBe(2);
      expect(stats.bySource['api'].statusCodes[502]).toBe(1);
    });

    test('recent errors are capped', () => {
      for (let i = 0; i < 100; i++) {
        tracker.record('test', `Error ${i}`);
      }

      const stats = tracker.getStats();
      expect(stats.recentErrors.length).toBeLessThanOrEqual(20);
    });

    test('long messages are truncated', () => {
      tracker.record('test', 'x'.repeat(500));
      const stats = tracker.getStats();
      expect(stats.bySource['test'].lastError.length).toBeLessThanOrEqual(210);
    });

    test('reset clears all data', () => {
      tracker.record('test', 'e');
      tracker.reset();
      expect(tracker.getStats().totalErrors).toBe(0);
    });

    test('singleton returns same instance', () => {
      const a = getErrorTracker();
      const b = getErrorTracker();
      expect(a).toBe(b);
    });
  });

  describe('monitoring + error tracking integration', () => {
    test('failed LLM calls are recorded in both systems', () => {
      const perf = new PerformanceMonitor();
      const errors = new ErrorTracker();

      perf.recordLLMCall({ model: 'x', source: 'test', durationMs: 5000, success: false });
      errors.record('test', 'LLM call failed', 500);

      expect(perf.getStats().totalFailures).toBe(1);
      expect(errors.getStats().totalErrors).toBe(1);
    });
  });
});
