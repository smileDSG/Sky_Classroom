/**
 * Telemetry Collector — Client-side SDK
 *
 * Batches events in memory and flushes to /api/telemetry every 30s or 50 events.
 * Uses navigator.sendBeacon on pagehide for last-effort delivery.
 */

export type TelemetryEventType =
  | 'page_view'
  | 'api_call'
  | 'error'
  | 'performance'
  | 'feature_use'
  | 'ai_task';

export interface TelemetryEvent {
  type: TelemetryEventType;
  data: Record<string, unknown>;
}

interface QueuedEvent {
  event_type: TelemetryEventType;
  event_data: Record<string, unknown>;
  page: string;
  session_id: string;
  timestamp: number;
}

class TelemetryCollector {
  private queue: QueuedEvent[] = [];
  private maxQueue = 50;
  private flushIntervalMs = 30_000;
  private sessionId: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor() {
    this.sessionId = this.getSessionId();
    if (typeof window !== 'undefined') {
      this.startTimer();
      window.addEventListener('pagehide', () => this.sendBeacon());
    }
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') return 'ssr';
    try {
      let id = sessionStorage.getItem('__telemetry_sid');
      if (!id) {
        id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('__telemetry_sid', id);
      }
      return id;
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  private startTimer(): void {
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  /** Enqueue a single event. Auto-flushes if queue reaches max. */
  track(type: TelemetryEventType, data: Record<string, unknown> = {}): void {
    this.queue.push({
      event_type: type,
      event_data: data,
      page: typeof window !== 'undefined' ? window.location.pathname : '',
      session_id: this.sessionId,
      timestamp: Date.now(),
    });

    if (this.queue.length >= this.maxQueue) {
      this.flush();
    }
  }

  /** Flush queued events to the server. */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.flushing) return;

    const batch = this.queue.splice(0, this.queue.length);
    this.flushing = true;

    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      // Re-enqueue on failure (up to a limit)
      if (this.queue.length < this.maxQueue * 2) {
        this.queue.push(...batch);
      }
    } finally {
      this.flushing = false;
    }
  }

  /** Last-effort delivery via sendBeacon on pagehide. */
  private sendBeacon(): void {
    if (this.queue.length === 0) return;

    try {
      const blob = new Blob(
        [JSON.stringify({ events: this.queue.splice(0) })],
        { type: 'application/json' },
      );
      navigator.sendBeacon('/api/telemetry', blob);
    } catch {}
  }

  /** Stop the auto-flush timer. */
  destroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

let instance: TelemetryCollector | null = null;

export function getTelemetry(): TelemetryCollector {
  if (!instance) {
    instance = new TelemetryCollector();
  }
  return instance;
}

export function trackEvent(type: TelemetryEventType, data?: Record<string, unknown>): void {
  getTelemetry().track(type, data);
}

export function flushTelemetry(): Promise<void> {
  return getTelemetry().flush();
}
