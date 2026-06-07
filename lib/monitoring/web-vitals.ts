/**
 * Web Vitals collection — FCP, LCP, CLS, TTFB.
 * Uses PerformanceObserver for real-time metrics.
 */

export interface WebVitalEntry {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

type VitalCallback = (entry: WebVitalEntry) => void;

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    FCP: [1800, 3000],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    TTFB: [800, 1800],
  };
  const [good, poor] = thresholds[name] ?? [0, 0];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function observe(name: string, cb: VitalCallback) {
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const value = name === 'CLS' ? ((entry as unknown as Record<string, number>).value ?? 0) : entry.startTime;
        cb({ name, value, rating: getRating(name, value), timestamp: Date.now() });
      }
    }).observe({ type: name, buffered: true });
  } catch {
    // Browser doesn't support this observer type
  }
}

/** Start collecting web vitals. Calls callback on each metric. */
export function onWebVitals(cb: VitalCallback): () => void {
  observe('LCP', cb);
  observe('FCP', cb);

  // CLS is cumulative — report on visibility change
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      clsValue += ((entry as unknown as Record<string, number>).value ?? 0);
    }
    cb({ name: 'CLS', value: clsValue, rating: getRating('CLS', clsValue), timestamp: Date.now() });
  });
  try {
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {}

  // TTFB from navigation timing
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (nav) {
    cb({ name: 'TTFB', value: nav.responseStart, rating: getRating('TTFB', nav.responseStart), timestamp: Date.now() });
  }

  return () => {
    clsObserver.disconnect();
  };
}

/** Store web vitals in localStorage for historical tracking */
const VITALS_KEY = 'openmaic-web-vitals';

export function storeVital(entry: WebVitalEntry): void {
  try {
    const history: WebVitalEntry[] = JSON.parse(localStorage.getItem(VITALS_KEY) || '[]');
    history.push(entry);
    // Keep last 1000 entries
    if (history.length > 1000) history.splice(0, history.length - 1000);
    localStorage.setItem(VITALS_KEY, JSON.stringify(history));
  } catch {}
}

export function getVitalsHistory(): WebVitalEntry[] {
  try {
    return JSON.parse(localStorage.getItem(VITALS_KEY) || '[]');
  } catch {
    return [];
  }
}
