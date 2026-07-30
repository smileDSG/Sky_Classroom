/**
 * Cross-user isolation tests for KnowledgeStateDAO
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';

const ALICE = 'user-alice';
const BOB = 'user-bob';

function makeState(userId: string, nodeId: string): KnowledgeState {
  return {
    userId,
    nodeId,
    alpha: 1,
    beta: 1,
    mastery: 0.5,
    confidence: 0.6,
    retention: 0.7,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 1,
    version: 1,
  };
}

describe('KnowledgeStateDAO cross-user isolation', () => {
  let storage: MemoryStorageProvider;
  let dao: ReturnType<typeof createKnowledgeStateDAO>;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
    dao = createKnowledgeStateDAO(storage);
  });

  test('set binds state to the provided userId even when data differs', async () => {
    const state = makeState('attacker', 'node-1');
    await dao.set(ALICE, state);

    const found = await dao.get(ALICE, 'node-1');
    expect(found?.userId).toBe(ALICE);
  });

  test('get returns null for another users state', async () => {
    await dao.set(ALICE, makeState(ALICE, 'node-1'));
    expect(await dao.get(BOB, 'node-1')).toBeNull();
  });

  test('list excludes other users states', async () => {
    await dao.set(ALICE, makeState(ALICE, 'node-1'));
    await dao.set(BOB, makeState(BOB, 'node-2'));
    await dao.set(ALICE, makeState(ALICE, 'node-3'));

    const states = await dao.list(ALICE);
    expect(states.map((s) => s.nodeId).sort()).toEqual(['node-1', 'node-3']);
  });

  test('delete returns false for another users state and leaves it intact', async () => {
    await dao.set(ALICE, makeState(ALICE, 'node-1'));

    const result = await dao.delete(BOB, 'node-1');
    expect(result).toBe(false);

    expect(await dao.get(ALICE, 'node-1')).not.toBeNull();
  });

  test('delete returns true and removes own state', async () => {
    await dao.set(ALICE, makeState(ALICE, 'node-1'));

    const result = await dao.delete(ALICE, 'node-1');
    expect(result).toBe(true);

    expect(await dao.get(ALICE, 'node-1')).toBeNull();
  });

  test('count excludes other users states', async () => {
    await dao.set(ALICE, makeState(ALICE, 'node-1'));
    await dao.set(BOB, makeState(BOB, 'node-2'));

    expect(await dao.count(ALICE)).toBe(1);
  });
});
