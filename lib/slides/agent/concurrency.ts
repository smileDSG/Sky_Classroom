/**
 * Shared concurrency limiter for the pipeline.
 *
 * Worker-pool with per-item timeout + staggered start to avoid
 * provider-side queue saturation.
 */

export async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  itemTimeoutMs: number = 600_000, // 10 min hard ceiling per item
  staggerMs: number = 0,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(workerId: number): Promise<void> {
    // Stagger worker starts to avoid provider-side queue saturation
    if (staggerMs > 0 && workerId > 0) {
      await new Promise((r) => setTimeout(r, workerId * staggerMs));
    }
    while (index < items.length) {
      const i = index++;
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        results[i] = await Promise.race([
          fn(items[i], i).finally(() => {
            if (timer) clearTimeout(timer);
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error(`Worker item ${i} timeout after ${itemTimeoutMs}ms`));
            }, itemTimeoutMs);
          }),
        ]);
      } catch (err) {
        if (timer) clearTimeout(timer);
        throw err;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, (_, i) => worker(i));
  await Promise.all(workers);
  return results;
}
