import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  acquireGenerationSlot,
  getGenerationGateStats,
  isGenerationQueueFull,
  refreshGenerationGateConfig,
} from '@/lib/server/generation-gate';

describe('generation-gate', () => {
  beforeEach(() => {
    process.env.GENERATION_MAX_CONCURRENT = '2';
    process.env.GENERATION_MAX_QUEUE = '3';
    refreshGenerationGateConfig();
  });

  afterEach(() => {
    delete process.env.GENERATION_MAX_CONCURRENT;
    delete process.env.GENERATION_MAX_QUEUE;
    refreshGenerationGateConfig();
  });

  it('admits up to max concurrent slots immediately, then queues', async () => {
    expect(getGenerationGateStats()).toEqual({ active: 0, queued: 0 });
    const r1 = await acquireGenerationSlot();
    const r2 = await acquireGenerationSlot();
    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 0 });
    r1();
    r2();
    expect(getGenerationGateStats().active).toBe(0);
  });

  it('queues excess acquires FIFO and transfers slots in order', async () => {
    const r1 = await acquireGenerationSlot();
    const r2 = await acquireGenerationSlot();

    const order: string[] = [];
    const p3 = acquireGenerationSlot(() => order.push('wait:3'));
    const p4 = acquireGenerationSlot(() => order.push('wait:4'));

    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 2 });

    r1(); // frees slot -> '3' runs next (FIFO)
    const r3 = await p3;
    expect(order[0]).toBe('wait:3');
    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 1 });

    r2();
    const r4 = await p4;
    expect(order[1]).toBe('wait:4');
    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 0 });

    r3();
    r4();
    expect(getGenerationGateStats().active).toBe(0);
  });

  it('never over-admits past max under many concurrent acquires', async () => {
    // Occupy both slots.
    const held = [await acquireGenerationSlot(), await acquireGenerationSlot()];
    let waited = 0;
    const pending = Array.from({ length: 20 }, () =>
      acquireGenerationSlot(() => {
        waited++;
      }),
    );
    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 20 });

    // Hand each held/acquired slot to the next waiter in a chain, so every
    // waiter resolves without ever having more than MAX slots busy.
    const owned = [...held];
    let idx = 0;
    while (idx < pending.length) {
      const slot = owned.shift()!;
      slot(); // free a slot -> hands it to waiter idx (active stays MAX)
      owned.push(await pending[idx]); // take over its release
      idx++;
    }
    expect(waited).toBe(20);

    // Drain remaining owned slot releases.
    for (const r of owned) r();
    expect(getGenerationGateStats()).toEqual({ active: 0, queued: 0 });
  });

  it('reports queue-full when the wait-list reaches capacity', async () => {
    const a1 = await acquireGenerationSlot();
    const a2 = await acquireGenerationSlot();
    const q3 = acquireGenerationSlot();
    const q4 = acquireGenerationSlot();
    const q5 = acquireGenerationSlot();
    expect(isGenerationQueueFull()).toBe(true);

    a1();
    const r3 = await q3;
    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 2 });
    expect(isGenerationQueueFull()).toBe(false);

    a2();
    const r4 = await q4;
    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 1 });

    r3(); // free a slot for q5
    const r5 = await q5;
    expect(getGenerationGateStats()).toEqual({ active: 2, queued: 0 });

    r4();
    r5();
    expect(getGenerationGateStats().active).toBe(0);
  });
});
