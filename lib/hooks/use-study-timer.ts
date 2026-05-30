/**
 * useStudyTimer Hook
 *
 * Tracks real study time when the page is visible.
 * Reports to /api/sky/study-timer every 30 seconds.
 * Sends remaining time on page unload via sendBeacon.
 */

import { useEffect, useRef } from 'react';

const REPORT_INTERVAL_MS = 30_000; // 30 seconds

export function useStudyTimer(enabled: boolean = true) {
  const accumulatedRef = useRef(0);    // seconds since last report
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      accumulatedRef.current += 1;
      if (accumulatedRef.current >= REPORT_INTERVAL_MS / 1000) {
        flush();
      }
    };

    const flush = () => {
      const secs = accumulatedRef.current;
      if (secs <= 0) return;
      accumulatedRef.current = 0;

      // Use fetch for normal periodic reports
      fetch('/api/sky/study-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: secs }),
        keepalive: true,
      }).catch(() => {});
    };

    const startTimer = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(tick, 1000);
    };

    const stopTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      flush();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startTimer();
      } else {
        stopTimer();
      }
    };

    const onBeforeUnload = () => {
      const secs = accumulatedRef.current;
      if (secs <= 0) return;
      accumulatedRef.current = 0;
      // sendBeacon for reliable delivery on page unload
      navigator.sendBeacon(
        '/api/sky/study-timer',
        new Blob([JSON.stringify({ seconds: secs })], { type: 'application/json' }),
      );
    };

    // Start if page is already visible
    if (document.visibilityState === 'visible') {
      startTimer();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [enabled]);
}
