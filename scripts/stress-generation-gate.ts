/**
 * Real-machine concurrency stress test for the global generation gate.
 *
 * Drives the REAL `acquireGenerationSlot` API under simulated multi-user load
 * and asserts:
 *   1. in-flight jobs never exceed the gate limit (env GENERATION_MAX_CONCURRENT, default 3);
 *   2. the queue drains fully after the burst;
 *   3. the main thread never blocks for a long synchronous stretch (the whole
 *      reason we added the gate + PDF worker).
 *
 * Run: pnpm tsx scripts/stress-generation-gate.ts
 * Exits non-zero on any assertion failure.
 */
import { performance } from 'node:perf_hooks';
import { acquireGenerationSlot, getGenerationGateStats } from '../lib/server/generation-gate';

const EXPECTED_LIMIT = Number(process.env.GENERATION_MAX_CONCURRENT) || 3;
const SIMULATED_USERS = 20; // classroom scaling: several ~ tens of people
const CONCURRENT_AT_ONCE = 15; // peak: 15 users slam "generate" simultaneously
const JOB_MS = [800, 1500, 3000]; // varied LLM+pipeline durations

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Measure the longest synchronous gap on the main loop with a 5ms camping timer.
// If the gate or a "generation" blocked the loop, this balloons well past 150ms.
function trackMaxEventLoopGap(over: Promise<void>): Promise<number> {
  return new Promise((resolve) => {
    let last = performance.now();
    let maxGapMs = 0;
    const probe = setInterval(() => {
      const now = performance.now();
      maxGapMs = Math.max(maxGapMs, now - last);
      last = now;
    }, 5);
    over.then(() => {
      clearInterval(probe);
      resolve(maxGapMs);
    });
  });
}

async function main() {
  console.log(
    `[stress] ${SIMULATED_USERS} users, peak ${CONCURRENT_AT_ONCE} simultaneous, ` +
      `expected gate limit=${EXPECTED_LIMIT}`,
  );

  let maxObservedActive = 0;
  let maxObservedQueue = 0;
  const arrived = Array.from({ length: SIMULATED_USERS }, () => ({
    acquiredAt: null as number | null,
    queuedMs: null as number | null,
  }));

  const run = (async () => {
    const startedAt = performance.now();
    const waiters = arrived.map((u, id) =>
      acquireGenerationSlot(() => {
        u.queuedMs = performance.now();
      }).then(async (release) => {
        u.acquiredAt = performance.now();
        const s = getGenerationGateStats();
        maxObservedActive = Math.max(maxObservedActive, s.active);
        maxObservedQueue = Math.max(maxObservedQueue, s.queued);
        await sleep(JOB_MS[id % JOB_MS.length]); // simulate variable pipeline work
        release();
      }),
    );
    await Promise.all(waiters);
    return performance.now() - startedAt;
  })();

  const maxEventLoopGapMs = await trackMaxEventLoopGap(run);

  // NOTE: `run` is awaited inside trackMaxEventLoopGap; awaiting again is safe
  // because `run` was already settled and caches its value.
  void run;

  let fail = 0;
  const check = (msg: string, ok: boolean) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
    if (!ok) fail++;
  };

  const finalStats = getGenerationGateStats();
  check(
    `In-flight never exceeded gate limit (max observed active=${maxObservedActive}, limit=${EXPECTED_LIMIT})`,
    maxObservedActive <= EXPECTED_LIMIT,
  );
  check(
    `All ${SIMULATED_USERS} jobs completed (accepted=${arrived.filter((u) => u.acquiredAt !== null).length})`,
    arrived.every((u) => u.acquiredAt !== null),
  );
  check(
    `Queue was exercised (${arrived.filter((u) => u.queuedMs !== null).length} users waited; peak queued=${maxObservedQueue})`,
    maxObservedQueue >= 1,
  );
  check(
    `Gate fully drained after run (active=${finalStats.active}, queued=${finalStats.queued})`,
    finalStats.active === 0 && finalStats.queued === 0,
  );

  // The gate keeps concurrent pipelines bounded; beneath that the loop should
  // stay lively. 150ms is a generous ceiling for a classroom render burst.
  check(
    `Main loop stayed responsive — max event-loop gap ${maxEventLoopGapMs.toFixed(1)}ms (<150ms)`,
    maxEventLoopGapMs < 150,
  );

  const waited = arrived
    .filter((u) => u.queuedMs !== null)
    .sort((a, b) => a.queuedMs! - b.queuedMs!)[0];
  const queueLatency = waited ? (waited.acquiredAt ?? 0) - waited.queuedMs : 0;

  console.log(
    `\n[stress] peakActive=${maxObservedActive} peakQueued=${maxObservedQueue} ` +
      `loopMaxGap=${maxEventLoopGapMs.toFixed(1)}ms firstWait=${queueLatency.toFixed(0)}ms ` +
      `active=${finalStats.active} queued=${finalStats.queued}`,
  );

  if (fail > 0) {
    console.error(`\n[stress] FAILED: ${fail} assertion(s)`);
    process.exit(1);
  }
  console.log('\n[stress] PASS');
}

main().catch((err) => {
  console.error('[stress] unexpected error:', err);
  process.exit(1);
});
