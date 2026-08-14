import { describe, expect, it } from 'vitest';

import {
  simulateVirtualStudent,
  VIRTUAL_STUDENT_PROFILES,
} from '@/lib/adaptive-learning/simulation/virtual-student';

describe('virtual student simulation', () => {
  it('runs every supported profile without external LLM access', () => {
    const results = VIRTUAL_STUDENT_PROFILES.map((profile) =>
      simulateVirtualStudent({ profile, topic: 'functions', seed: 7 }),
    );

    expect(results).toHaveLength(6);
    expect(results.every((result) => result.source === 'simulation')).toBe(true);
    expect(results.every((result) => result.turns.length > 0)).toBe(true);
    expect(results.every((result) => result.metrics.turns === result.turns.length)).toBe(true);
  });

  it('is deterministic for the same profile, topic, seed, and turn limit', () => {
    const profile = VIRTUAL_STUDENT_PROFILES.find((item) => item.profileId === 'struggling')!;
    const first = simulateVirtualStudent({ profile, topic: 'limits', seed: 42, maxTurns: 8 });
    const second = simulateVirtualStudent({ profile, topic: 'limits', seed: 42, maxTurns: 8 });

    expect(second.turns).toEqual(first.turns);
    expect(second.events).toEqual(first.events);
    expect(second.completed).toBe(first.completed);
    expect(second.exited).toBe(first.exited);
    expect(second.failureReasons).toEqual(first.failureReasons);
    expect(second.metrics).toEqual(first.metrics);
  });

  it('never exceeds configured maximum turns', () => {
    const profile = VIRTUAL_STUDENT_PROFILES[0]!;
    const result = simulateVirtualStudent({ profile, topic: 'derivatives', maxTurns: 1, seed: 1 });

    expect(result.turns.length).toBeLessThanOrEqual(5);
    expect(result.turns.every((turn) => turn.turn <= 1)).toBe(true);
  });

  it('exposes behavior signals needed to diagnose difficult personas', () => {
    const struggling = VIRTUAL_STUDENT_PROFILES.find((item) => item.profileId === 'struggling')!;
    const questioner = VIRTUAL_STUDENT_PROFILES.find((item) => item.profileId === 'questioner')!;
    const impatient = VIRTUAL_STUDENT_PROFILES.find((item) => item.profileId === 'impatient')!;

    const strugglingRun = simulateVirtualStudent({
      profile: struggling,
      topic: 'probability',
      seed: 1,
    });
    const questionerSeed = Array.from({ length: 100 }, (_, index) => index + 1).find(
      (seed) =>
        simulateVirtualStudent({ profile: questioner, topic: 'probability', seed }).metrics
          .questionsAsked > 0,
    );
    expect(questionerSeed).toBeDefined();
    const questionerRun = simulateVirtualStudent({
      profile: questioner,
      topic: 'probability',
      seed: questionerSeed,
    });
    const impatientRun = simulateVirtualStudent({
      profile: impatient,
      topic: 'probability',
      seed: 1,
    });

    expect(strugglingRun.metrics.hintsRequested).toBeGreaterThan(0);
    expect(questionerRun.metrics.questionsAsked).toBeGreaterThan(0);
    expect(impatientRun.exited).toBe(true);
    expect(impatientRun.events).toContain('session-exited');
  });

  it('keeps simulation records separate from real learning tables', async () => {
    const { MemoryStorageProvider } = await import('@/lib/storage/memory-provider');
    const { createVirtualSimulationDAO } =
      await import('@/lib/adaptive-learning/data/virtual-simulations');
    const storage = new MemoryStorageProvider();
    const profile = VIRTUAL_STUDENT_PROFILES[0]!;
    const result = simulateVirtualStudent({ profile, topic: 'geometry', seed: 3 });

    await createVirtualSimulationDAO(storage).add(result);

    expect(await storage.count('virtual_student_simulations')).toBe(1);
    expect(await storage.count('learning_events')).toBe(0);
    expect(await storage.count('learner_reflections')).toBe(0);
    expect(await storage.count('learner_outcomes')).toBe(0);
  });
});
