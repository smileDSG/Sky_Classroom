/**
 * Error Tracker
 *
 * Lightweight in-memory error aggregation grouped by source/endpoint.
 * Tracks error counts, timestamps, and last error messages without
 * external dependencies.
 */
import { createLogger } from '@/lib/logger';

const log = createLogger('ErrorTracker');

// ==================== Types ====================

export interface ErrorRecord {
  source: string; // 'scene-content', 'chat', 'agent-profiles', etc.
  message: string;
  timestamp: number;
  statusCode?: number;
}

export interface SourceErrors {
  count: number;
  lastError: string;
  lastTimestamp: number;
  statusCodes: Record<number, number>; // statusCode → count
}

export interface ErrorSnapshot {
  since: number;
  totalErrors: number;
  bySource: Record<string, SourceErrors>;
  recentErrors: ErrorRecord[]; // last 20
}

// ==================== Implementation ====================

export class ErrorTracker {
  private errors: ErrorRecord[] = [];
  private maxRecent = 100;
  private startTime = Date.now();

  /** Record an error. */
  record(source: string, message: string, statusCode?: number): void {
    const record: ErrorRecord = {
      source,
      message: message.slice(0, 200), // Truncate long messages
      timestamp: Date.now(),
      statusCode,
    };

    this.errors.push(record);

    if (this.errors.length > this.maxRecent) {
      this.errors = this.errors.slice(-this.maxRecent);
    }

    log.error(`[${source}]${statusCode ? ` (${statusCode})` : ''} ${message}`);
  }

  /** Get aggregated error stats. */
  getStats(): ErrorSnapshot {
    const recent = this.errors.slice(-20);
    const bySource: Record<string, SourceErrors> = {};

    for (const e of this.errors) {
      const entry = bySource[e.source] || {
        count: 0,
        lastError: '',
        lastTimestamp: 0,
        statusCodes: {},
      };

      entry.count++;
      if (e.timestamp > entry.lastTimestamp) {
        entry.lastError = e.message;
        entry.lastTimestamp = e.timestamp;
      }
      if (e.statusCode) {
        entry.statusCodes[e.statusCode] =
          (entry.statusCodes[e.statusCode] ?? 0) + 1;
      }

      bySource[e.source] = entry;
    }

    return {
      since: this.startTime,
      totalErrors: this.errors.length,
      bySource,
      recentErrors: recent,
    };
  }

  /** Reset all errors. */
  reset(): void {
    this.errors = [];
    this.startTime = Date.now();
  }

  /** Export for health check. */
  export(): ErrorSnapshot {
    return this.getStats();
  }
}

// ==================== Singleton ====================

let _tracker: ErrorTracker | null = null;

export function getErrorTracker(): ErrorTracker {
  if (!_tracker) {
    _tracker = new ErrorTracker();
  }
  return _tracker;
}

export function resetErrorTracker(): void {
  _tracker?.reset();
  _tracker = null;
}
