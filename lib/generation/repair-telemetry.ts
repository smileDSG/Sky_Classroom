/**
 * Repair chain telemetry.
 *
 * Tracks which repair strategies fire, their success rates, and
 * latency. Exported data can be consumed by prompt optimization
 * feedback loops to identify frequent repair patterns.
 */

import type { ParseResult } from './repair-strategies/types';

export interface StrategyStats {
  name: string;
  calls: number;
  repairs: number;
  /** Number of times this strategy's output was parseable */
  successes: number;
  /** Cumulative repair time in ms */
  totalTimeMs: number;
  /** Last 10 error samples (for debugging) */
  recentErrors: string[];
}

export interface TelemetrySnapshot {
  strategies: Record<string, StrategyStats>;
  /** Total parse/repair calls */
  totalCalls: number;
  /** Calls that succeeded (any strategy chain) */
  totalSuccesses: number;
}

const MAX_ERROR_SAMPLES = 10;
const MAX_STRATEGY_NAME_LENGTH = 200;

function ensureStats(stats: Record<string, StrategyStats>, name: string): StrategyStats {
  const key = name.slice(0, MAX_STRATEGY_NAME_LENGTH);
  if (!stats[key]) {
    stats[key] = { name, calls: 0, repairs: 0, successes: 0, totalTimeMs: 0, recentErrors: [] };
  }
  return stats[key];
}

class RepairTelemetry {
  private stats: Record<string, StrategyStats> = {};
  private totalCalls = 0;
  private totalSuccesses = 0;

  recordCall(): void {
    this.totalCalls++;
  }

  recordSuccess(): void {
    this.totalSuccesses++;
  }

  recordStrategyInvocation(name: string): void {
    const s = ensureStats(this.stats, name);
    s.calls++;
  }

  recordRepair(name: string, durationMs: number): void {
    const s = ensureStats(this.stats, name);
    s.repairs++;
    s.totalTimeMs += durationMs;
  }

  recordStrategySuccess(name: string): void {
    const s = ensureStats(this.stats, name);
    s.successes++;
  }

  recordError(name: string, error: string): void {
    const s = ensureStats(this.stats, name);
    if (s.recentErrors.length >= MAX_ERROR_SAMPLES) {
      s.recentErrors.shift();
    }
    s.recentErrors.push(error.slice(0, 300));
  }

  snapshot(): TelemetrySnapshot {
    return {
      strategies: { ...this.stats },
      totalCalls: this.totalCalls,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Export for prompt optimization feedback loop.
   * Returns strategies sorted by call count (most frequent first).
   */
  getOptimizationHints(): Array<{ strategy: string; repairRate: number; avgTimeMs: number }> {
    return Object.values(this.stats)
      .filter((s) => s.calls > 0)
      .map((s) => ({
        strategy: s.name,
        repairRate: s.calls > 0 ? s.repairs / s.calls : 0,
        avgTimeMs: s.repairs > 0 ? s.totalTimeMs / s.repairs : 0,
      }))
      .sort((a, b) => b.repairRate - a.repairRate);
  }

  reset(): void {
    this.stats = {};
    this.totalCalls = 0;
    this.totalSuccesses = 0;
  }
}

/** Shared singleton for tracking all parse/repair operations */
export const repairTelemetry = new RepairTelemetry();

/**
 * Annotate a ParseResult with telemetry data for debugging.
 */
export function annotateWithTelemetry<T>(
  result: ParseResult<T>,
): ParseResult<T> & { telemetry: TelemetrySnapshot } {
  return { ...result, telemetry: repairTelemetry.snapshot() };
}
