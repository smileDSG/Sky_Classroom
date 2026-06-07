/**
 * Performance Monitor
 *
 * Lightweight in-process metrics for LLM calls and generation pipeline stages.
 * Tracks duration, token usage, and aggregates per-source stats.
 * No external dependencies — pure in-memory with optional log export.
 */
import { createLogger } from '@/lib/logger';

const log = createLogger('Performance');

// ==================== Types ====================

export interface LLMCallMetrics {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
  source: string; // 'scene-content', 'chat', 'agent-profiles', etc.
  success: boolean;
}

export interface PerSourceStats {
  calls: number;
  failures: number;
  totalDurationMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
}

export interface PerfSnapshot {
  since: number; // timestamp
  totalCalls: number;
  totalFailures: number;
  totalTokens: number;
  bySource: Record<string, PerSourceStats>;
  recentCalls: LLMCallMetrics[]; // last 50
}

// ==================== Implementation ====================

export class PerformanceMonitor {
  private metrics: LLMCallMetrics[] = [];
  private maxRecent = 50;
  private startTime = Date.now();

  /** Record an LLM call. */
  recordLLMCall(m: LLMCallMetrics): void {
    this.metrics.push(m);

    // Trim overflow
    if (this.metrics.length > this.maxRecent * 2) {
      this.metrics = this.metrics.slice(-this.maxRecent);
    }

    if (!m.success) {
      log.warn(
        `[${m.source}] LLM call failed: model=${m.model}, duration=${m.durationMs}ms`,
      );
    }
  }

  /** Time an async operation. */
  async time<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<{ result: T; durationMs: number }> {
    const start = performance.now();
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    log.debug(`[${label}] ${durationMs}ms`);
    return { result, durationMs };
  }

  /** Time a sync operation. */
  timeSync<T>(label: string, fn: () => T): { result: T; durationMs: number } {
    const start = performance.now();
    const result = fn();
    const durationMs = Math.round(performance.now() - start);
    log.debug(`[${label}] ${durationMs}ms`);
    return { result, durationMs };
  }

  /** Get aggregated stats. */
  getStats(): PerfSnapshot {
    const recent = this.metrics.slice(-this.maxRecent);
    const bySource: Record<string, PerSourceStats> = {};

    for (const m of recent) {
      const stats = bySource[m.source] || {
        calls: 0,
        failures: 0,
        totalDurationMs: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        avgDurationMs: 0,
        maxDurationMs: 0,
        minDurationMs: Infinity,
      };

      stats.calls++;
      if (!m.success) stats.failures++;
      stats.totalDurationMs += m.durationMs;
      stats.totalPromptTokens += m.promptTokens ?? 0;
      stats.totalCompletionTokens += m.completionTokens ?? 0;
      stats.maxDurationMs = Math.max(stats.maxDurationMs, m.durationMs);
      stats.minDurationMs = Math.min(
        stats.minDurationMs === Infinity ? m.durationMs : stats.minDurationMs,
        m.durationMs,
      );
      stats.avgDurationMs = Math.round(stats.totalDurationMs / stats.calls);

      bySource[m.source] = stats;
    }

    return {
      since: this.startTime,
      totalCalls: recent.length,
      totalFailures: recent.filter((m) => !m.success).length,
      totalTokens: recent.reduce(
        (s, m) => s + (m.promptTokens ?? 0) + (m.completionTokens ?? 0),
        0,
      ),
      bySource,
      recentCalls: recent,
    };
  }

  /** Reset all metrics. */
  reset(): void {
    this.metrics = [];
    this.startTime = Date.now();
  }

  /** Export stats as JSON for API / health check. */
  export(): PerfSnapshot {
    return this.getStats();
  }
}

// ==================== Singleton ====================

let _monitor: PerformanceMonitor | null = null;

export function getPerfMonitor(): PerformanceMonitor {
  if (!_monitor) {
    _monitor = new PerformanceMonitor();
  }
  return _monitor;
}

export function resetPerfMonitor(): void {
  _monitor?.reset();
  _monitor = null;
}
