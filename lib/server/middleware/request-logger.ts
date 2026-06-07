/**
 * Request Logger Middleware
 *
 * Logs every API request with method, path, duration, and status.
 * Usage inside a route handler:
 *
 *   const log = createRequestLogger(req);
 *   // ... do work ...
 *   log.end(statusCode);
 */

import { createLogger } from '@/lib/logger';

const baseLogger = createLogger('API');

export interface RequestLogInfo {
  method: string;
  url: string;
  path: string;
  query: string;
  userAgent?: string;
  referer?: string;
  startTime: number;
}

/**
 * Extract request metadata from a Request object.
 */
export function createRequestLogInfo(req: Request): RequestLogInfo {
  const url = new URL(req.url);
  return {
    method: req.method,
    url: req.url,
    path: url.pathname,
    query: url.search,
    userAgent: req.headers.get('user-agent') ?? undefined,
    referer: req.headers.get('referer') ?? undefined,
    startTime: Date.now(),
  };
}

/**
 * Log the completion of a request with duration and status.
 */
export function logRequestEnd(
  info: RequestLogInfo,
  status: number,
  extra?: Record<string, unknown>,
): void {
  const duration = Date.now() - info.startTime;
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  const msg = `[${info.method}] ${info.path} → ${status} (${duration}ms)`;

  const payload: Record<string, unknown> = {
    method: info.method,
    path: info.path,
    status,
    durationMs: duration,
    query: info.query || undefined,
    ...extra,
  };

  if (level === 'error') {
    baseLogger.error(msg, payload);
  } else if (level === 'warn') {
    baseLogger.warn(msg, payload);
  } else {
    baseLogger.info(msg, payload);
  }
}

/**
 * Create a simple request logger for use inside route handlers.
 *
 *   const log = requestLogger(req);
 *   // ... handle request ...
 *   log.end(200);
 */
export function requestLogger(req: Request) {
  const info = createRequestLogInfo(req);

  return {
    info,

    /** Log request completion */
    end(status: number, extra?: Record<string, unknown>): void {
      logRequestEnd(info, status, extra);
    },
  };
}
