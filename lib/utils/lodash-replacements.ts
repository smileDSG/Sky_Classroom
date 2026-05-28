/** Lightweight replacements for lodash functions used in this project. */

/** Deduplicate an array (preserves first-occurrence order). Equivalent to lodash `uniq`. */
export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Delay function execution, reset timer on each call. Equivalent to lodash `debounce`. */
export function debounce<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  wait: number,
  options?: { trailing?: boolean; leading?: boolean },
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  const debounced = function (this: unknown, ...args: TArgs) {
    lastArgs = args;
    if (options?.leading && !timer) {
      fn(...args);
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (options?.trailing !== false && lastArgs) {
        fn(...lastArgs);
      }
      lastArgs = null;
      timer = null;
    }, wait);
  };

  return debounced;
}
