import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { LearnerPreferences } from '@/lib/adaptive-learning/contracts';
import type { InterventionDecision } from '@/lib/adaptive-learning/data/intervention-decisions';

const boundary = vi.hoisted(() => ({
  userId: 'user-outcome',
  storage: null as StorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: boundary.userId } })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));

vi.mock('@/lib/adaptive-learning/profile/repository', () => ({
  LearnerProfileRepository: class {
    async getLatestPreferences() {
      return {
        privacy: { optionalBehaviorSignals: true },
      } as LearnerPreferences;
    }

    async appendLearningEvent(event: { eventId: string }) {
      await boundary.storage?.set('learning_events', {
        id: event.eventId,
        data: event,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
}));

vi.mock('server-only', () => ({}));

import { GET, POST } from '@/app/api/learning-outcomes/route';
import { createInterventionDecisionDAO } from '@/lib/adaptive-learning/data/intervention-decisions';

const storage = new MemoryStorageProvider();
boundary.storage = storage;

function makeDecision(userId = boundary.userId): InterventionDecision {
  return {
    decisionId: 'decision-outcome-1',
    userId,
    sessionId: 'session-1',
    stateSnapshot: {},
    candidatePlans: [],
    selectedPlan: null,
    fallbackUsed: true,
    modelId: null,
    correlationId: 'decision-outcome-1',
    createdAt: '2026-08-13T09:00:00.000Z',
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/learning-outcomes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  boundary.userId = 'user-outcome';
  await storage.clear('intervention_decisions');
  await storage.clear('learner_outcomes');
  await storage.clear('learning_events');
  await createInterventionDecisionDAO(storage).add(makeDecision());
});

describe('/api/learning-outcomes', () => {
  it('records an outcome only for the authenticated decision owner', async () => {
    const response = await POST(
      request({
        decisionId: 'decision-outcome-1',
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
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ success: true, recorded: true });

    const getResponse = await GET(
      new NextRequest('http://localhost:3000/api/learning-outcomes?decisionId=decision-outcome-1'),
    );
    await expect(getResponse.json()).resolves.toMatchObject({
      success: true,
      outcome: { decisionId: 'decision-outcome-1', userId: 'user-outcome' },
    });

    const duplicate = await POST(
      request({
        decisionId: 'decision-outcome-1',
        windowStart: '2026-08-13T09:00:00.000Z',
        windowEnd: '2026-08-13T09:15:00.000Z',
        correctCount: 0,
        questionCount: 1,
        correctRate: 0,
        hintsRequested: 0,
        durationSeconds: 30,
        completed: false,
        exited: true,
        errorTypes: [],
        nextDecisionId: null,
      }),
    );
    expect(duplicate.status).toBe(200);
  });

  it('does not accept an outcome linked to another user decision', async () => {
    await createInterventionDecisionDAO(storage).add(makeDecision('other-user'));

    const response = await POST(
      request({
        decisionId: 'decision-outcome-1',
        windowStart: '2026-08-13T09:00:00.000Z',
        windowEnd: '2026-08-13T09:15:00.000Z',
        correctCount: 0,
        questionCount: 1,
        correctRate: 0,
        hintsRequested: 0,
        durationSeconds: 30,
        completed: false,
        exited: true,
        errorTypes: [],
        nextDecisionId: null,
      }),
    );

    expect(response.status).toBe(404);
  });

  it('records an exited outcome without pretending session completed', async () => {
    const response = await POST(
      request({
        decisionId: 'decision-outcome-1',
        windowStart: '2026-08-13T09:00:00.000Z',
        windowEnd: '2026-08-13T09:02:00.000Z',
        correctCount: 1,
        questionCount: 3,
        correctRate: 1 / 3,
        hintsRequested: 2,
        durationSeconds: 120,
        completed: false,
        exited: true,
        errorTypes: [],
        nextDecisionId: null,
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      outcome: { exited: true, completed: false, hintsRequested: 2 },
    });
    const events = await storage.getAll<{ type?: string }>('learning_events');
    expect(events.some((entry) => entry.data.type === 'session-exited')).toBe(true);
    expect(events.some((entry) => entry.data.type === 'session-completed')).toBe(false);
  });
});
