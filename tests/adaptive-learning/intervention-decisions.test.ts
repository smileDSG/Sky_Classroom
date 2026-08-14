import { beforeEach, describe, expect, it } from 'vitest';

import {
  createInterventionDecisionDAO,
  type InterventionDecision,
} from '@/lib/adaptive-learning/data/intervention-decisions';
import {
  createLearnerOutcomeDAO,
  type LearnerOutcome,
} from '@/lib/adaptive-learning/data/learner-outcomes';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

describe('InterventionDecisionDAO', () => {
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
  });

  it('stores and reads a decision by id', async () => {
    const dao = createInterventionDecisionDAO(storage);
    const decision: InterventionDecision = {
      decisionId: 'decision-1',
      userId: 'user-1',
      sessionId: 'session-1',
      stateSnapshot: { mastery: 0.3 },
      candidatePlans: [{ id: 'teach-first', action: 'teach' }],
      selectedPlan: { id: 'teach-first', action: 'teach' },
      fallbackUsed: false,
      modelId: 'mock:model',
      correlationId: 'decision-1',
      createdAt: '2026-08-13T09:00:00.000Z',
    };

    await expect(dao.add(decision)).resolves.toEqual(decision);
    await expect(dao.get('decision-1')).resolves.toEqual(decision);
  });

  it('lists decisions for one user in newest-first order', async () => {
    const dao = createInterventionDecisionDAO(storage);
    const makeDecision = (id: string, createdAt: string): InterventionDecision => ({
      decisionId: id,
      userId: 'user-1',
      sessionId: `session-${id}`,
      stateSnapshot: {},
      candidatePlans: [],
      selectedPlan: null,
      fallbackUsed: true,
      modelId: null,
      correlationId: id,
      createdAt,
    });

    await dao.add(makeDecision('old', '2026-08-13T08:00:00.000Z'));
    await dao.add(makeDecision('new', '2026-08-13T09:00:00.000Z'));
    await dao.add({ ...makeDecision('other-user', '2026-08-13T10:00:00.000Z'), userId: 'user-2' });

    await expect(dao.listByUser('user-1')).resolves.toMatchObject([
      { decisionId: 'new' },
      { decisionId: 'old' },
    ]);
  });

  it('links one observed outcome to its intervention decision', async () => {
    const dao = createLearnerOutcomeDAO(storage);
    const outcome: LearnerOutcome = {
      outcomeId: 'outcome-1',
      decisionId: 'decision-1',
      userId: 'user-1',
      windowStart: '2026-08-13T09:00:00.000Z',
      windowEnd: '2026-08-13T09:15:00.000Z',
      correctCount: 3,
      questionCount: 4,
      correctRate: 0.75,
      hintsRequested: 1,
      durationSeconds: 600,
      completed: true,
      exited: false,
      errorTypes: ['careless'],
      nextDecisionId: null,
      createdAt: '2026-08-13T09:15:00.000Z',
    };

    await expect(dao.add(outcome)).resolves.toEqual(outcome);
    await expect(dao.getByDecisionId('decision-1')).resolves.toEqual(outcome);
    await expect(dao.add({ ...outcome, outcomeId: 'outcome-2' })).resolves.toEqual(outcome);
    await expect(dao.get('outcome-2')).resolves.toBeNull();
  });
});
