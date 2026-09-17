/**
 * Global server-side Generation Gate.
 *
 * Bounds how many heavy generation pipelines (PPT/Solve/Teaching…) run
 * concurrently across all users, queueing the rest FIFO instead of
 * hard-rejecting them. Prevents a burst of simultaneous generations from
 * saturating the single Node event loop / LLM provider in multi-user
 * (classroom) deployments.
 *
 * Tunable via env:
 *  - GENERATION_MAX_CONCURRENT  (default 3)
 *  - GENERATION_MAX_QUEUE       (default 12, depth after which we 429)
 */

let active = 0;
let queue: Array<() => void> = [];

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

let maxConcurrent = envInt('GENERATION_MAX_CONCURRENT', 3);
let maxQueue = envInt('GENERATION_MAX_QUEUE', 12);

// Allow tests / hot-reload to re-read env without restarting.
export function refreshGenerationGateConfig(): void {
  maxConcurrent = Math.max(1, envInt('GENERATION_MAX_CONCURRENT', 3));
  maxQueue = envInt('GENERATION_MAX_QUEUE', 12);
}

export interface GenerationGateStats {
  active: number;
  queued: number;
}

export function getGenerationGateStats(): GenerationGateStats {
  return { active, queued: queue.length };
}

/** True when the FIFO wait-list is already at capacity (caller should 429). */
export function isGenerationQueueFull(): boolean {
  return queue.length >= maxQueue;
}

/**
 * Reserve a generation slot. Resolves once a slot is available.
 *
 * Returns a `release()` function that MUST be called (preferably in a
 * `finally`) when the pipeline finishes. `onWaitStart` fires only if this
 * call had to wait in the FIFO queue, so callers can surface a "queued"
 * status to the user.
 */
export async function acquireGenerationSlot(onWaitStart?: () => void): Promise<() => void> {
  if (active < maxConcurrent) {
    active++;
    return release;
  }

  if (onWaitStart) onWaitStart();
  await new Promise<void>((resolve) => queue.push(resolve));

  // The slot was transferred to us by a release() — already counted.
  return release;
}

function release(): void {
  const next = queue.shift();
  if (next) {
    // Transfer the slot straight to the next waiter without bouncing the
    // active count, avoiding an over-admission race between taps.
    next();
  } else {
    active = Math.max(0, active - 1);
  }
}
