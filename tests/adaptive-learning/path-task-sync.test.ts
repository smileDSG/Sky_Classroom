import { beforeEach, describe, expect, it } from 'vitest';

import type { KnowledgeState, LearningTask } from '@/lib/adaptive-learning/contracts';
import { syncLearningPathNodeFromTask } from '@/lib/adaptive-learning/planning/path-task-sync';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { LearningPath } from '@/lib/teaching/learning-path-types';

const storage = new MemoryStorageProvider();

const path: LearningPath = {
  id: 'path-1',
  userId: 'user-1',
  title: 'Test route',
  nodes: [
    {
      id: 'node-1',
      topic: 'uni-linear-algebra-eigenvalue',
      knowledgePoints: ['uni-linear-algebra-eigenvalue'],
      estimatedSections: 2,
      prerequisites: [],
      status: 'pending',
    },
    {
      id: 'node-2',
      topic: 'next-topic',
      knowledgePoints: ['next-topic'],
      estimatedSections: 1,
      prerequisites: [],
      status: 'pending',
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const task: LearningTask = {
  id: 'task-1',
  pathNodeId: 'node-1',
  nodeId: 'uni-linear-algebra-eigenvalue',
  type: 'practice',
  title: 'Practice eigenvalues',
  objective: 'Complete a focused practice set',
  plannedMinutes: 30,
  difficulty: 2,
  resourceIds: [],
  successCriteria: ['Complete the set'],
  status: 'pending',
  scheduledDate: '2026-08-06',
  reasonCodes: ['weak-point'],
};

function state(mastery: number): KnowledgeState {
  return {
    userId: 'user-1',
    nodeId: task.nodeId,
    displayName: task.nodeId,
    alpha: 1,
    beta: 1,
    mastery,
    confidence: 0.8,
    retention: 0.9,
    reviewStabilityDays: 7,
    repeatedErrorCount: 0,
    evidenceCount: 2,
    version: 1,
  };
}

beforeEach(async () => {
  await storage.clear('learning_paths');
  await storage.clear('knowledge-state');
  await createLearningPathDAO(storage).add(structuredClone(path));
});

describe('syncLearningPathNodeFromTask', () => {
  it('moves a pending node into progress when its task starts', async () => {
    const result = await syncLearningPathNodeFromTask(
      storage,
      'user-1',
      path.id,
      task,
      'in-progress',
    );

    expect(result?.node.status).toBe('in_progress');
    expect(result?.path.nodes[1].status).toBe('pending');
  });

  it('does not claim mastery from self-reported completion', async () => {
    await createKnowledgeStateDAO(storage).set('user-1', state(0.45));

    const result = await syncLearningPathNodeFromTask(
      storage,
      'user-1',
      path.id,
      { ...task, status: 'in-progress' },
      'completed',
    );

    expect(result?.node.status).toBe('in_progress');
    expect(result?.node.masteryAfter).toBe(45);
  });

  it('completes a node only after verified mastery and opens the next node', async () => {
    await createKnowledgeStateDAO(storage).set('user-1', state(0.9));

    const result = await syncLearningPathNodeFromTask(
      storage,
      'user-1',
      path.id,
      { ...task, status: 'in-progress' },
      'completed',
    );

    expect(result?.node.status).toBe('completed');
    expect(result?.path.nodes[1].status).toBe('in_progress');
  });
});
