import { describe, expect, it, beforeEach } from 'vitest';
import { repairTelemetry, annotateWithTelemetry } from '@/lib/generation/repair-telemetry';
import { RepairPipeline } from '@/lib/generation/repair-pipeline';

describe('repairTelemetry', () => {
  beforeEach(() => {
    repairTelemetry.reset();
  });

  describe('snapshot', () => {
    it('starts with empty stats', () => {
      const snap = repairTelemetry.snapshot();
      expect(snap.totalCalls).toBe(0);
      expect(snap.totalSuccesses).toBe(0);
      expect(Object.keys(snap.strategies)).toHaveLength(0);
    });
  });

  describe('recordCall / recordSuccess', () => {
    it('tracks total calls and successes', () => {
      repairTelemetry.recordCall();
      repairTelemetry.recordCall();
      repairTelemetry.recordSuccess();

      const snap = repairTelemetry.snapshot();
      expect(snap.totalCalls).toBe(2);
      expect(snap.totalSuccesses).toBe(1);
    });
  });

  describe('strategy tracking', () => {
    it('tracks per-strategy invocations, repairs, and successes', () => {
      repairTelemetry.recordStrategyInvocation('latex-escape-fixer');
      repairTelemetry.recordRepair('latex-escape-fixer', 5.2);
      repairTelemetry.recordStrategySuccess('latex-escape-fixer');

      repairTelemetry.recordStrategyInvocation('latex-escape-fixer');
      repairTelemetry.recordRepair('latex-escape-fixer', 3.1);

      repairTelemetry.recordStrategyInvocation('jsonrepair-fixer');
      repairTelemetry.recordRepair('jsonrepair-fixer', 12.0);
      repairTelemetry.recordStrategySuccess('jsonrepair-fixer');

      const snap = repairTelemetry.snapshot();
      const latex = snap.strategies['latex-escape-fixer'];
      const jrepair = snap.strategies['jsonrepair-fixer'];

      expect(latex.calls).toBe(2);
      expect(latex.repairs).toBe(2);
      expect(latex.successes).toBe(1);
      expect(latex.totalTimeMs).toBeCloseTo(8.3, 0);

      expect(jrepair.calls).toBe(1);
      expect(jrepair.repairs).toBe(1);
      expect(jrepair.successes).toBe(1);
    });
  });

  describe('error recording', () => {
    it('stores recent errors with truncation', () => {
      for (let i = 0; i < 15; i++) {
        repairTelemetry.recordError(
          'jsonrepair-fixer',
          `Error number ${i}: something went wrong with the JSON repair`,
        );
      }

      const snap = repairTelemetry.snapshot();
      const jrepair = snap.strategies['jsonrepair-fixer'];

      // Only keeps last 10
      expect(jrepair.recentErrors).toHaveLength(10);
      expect(jrepair.recentErrors[0]).toContain('Error number 5');
      expect(jrepair.recentErrors[9]).toContain('Error number 14');
    });
  });

  describe('getOptimizationHints', () => {
    it('returns strategies sorted by repair rate descending', () => {
      // quoted-property-fixer: 10 calls, 8 repairs (80%)
      for (let i = 0; i < 10; i++) {
        repairTelemetry.recordStrategyInvocation('quoted-property-fixer');
        if (i < 8) repairTelemetry.recordRepair('quoted-property-fixer', 1);
      }

      // control-char-fixer: 5 calls, 1 repair (20%)
      for (let i = 0; i < 5; i++) {
        repairTelemetry.recordStrategyInvocation('control-char-fixer');
        if (i < 1) repairTelemetry.recordRepair('control-char-fixer', 2);
      }

      const hints = repairTelemetry.getOptimizationHints();

      expect(hints.length).toBeGreaterThanOrEqual(2);
      expect(hints[0].strategy).toBe('quoted-property-fixer');
      expect(hints[0].repairRate).toBeCloseTo(0.8);
      expect(hints[1].strategy).toBe('control-char-fixer');
      expect(hints[1].repairRate).toBeCloseTo(0.2);
    });

    it('filters out strategies with zero calls', () => {
      const hints = repairTelemetry.getOptimizationHints();
      expect(hints).toHaveLength(0);
    });
  });

  describe('annotateWithTelemetry', () => {
    it('attaches telemetry snapshot to parse result', () => {
      const pipeline = new RepairPipeline();

      repairTelemetry.reset();
      const result = pipeline.parse<{ x: number }>('```json\n{"x": 42}\n```');
      const annotated = annotateWithTelemetry(result);

      expect(annotated.telemetry).toBeDefined();
      expect(annotated.telemetry.totalCalls).toBeGreaterThan(0);
    });
  });
});

// ── End-to-end: pipeline drives telemetry ──

describe('pipeline → telemetry integration', () => {
  it('records strategy invocations during repair', () => {
    repairTelemetry.reset();

    // This input requires truncation fix
    const raw = '[{"id":1,"name":"Alice"},{"id":2,"na';

    const pipeline = new RepairPipeline();
    const result = pipeline.parse<Array<{ id: number }>>(raw);

    expect(result.success).toBe(true);

    const snap = repairTelemetry.snapshot();
    expect(snap.totalCalls).toBe(1);

    // At least one strategy should have been invoked
    const strategyNames = Object.keys(snap.strategies);
    expect(strategyNames.length).toBeGreaterThan(0);
  });
});
