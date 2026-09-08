import type { LearningTask, KnowledgeState } from '@/lib/adaptive-learning/contracts';
import { sameKnowledgePoint } from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { createLearningPathDAO } from '@/lib/storage/dao/learning-paths';
import type { StorageProvider } from '@/lib/storage/storage-types';
import type { LearningPath, LearningPathNode } from '@/lib/teaching/learning-path-types';

export type PathTaskStatus = Extract<
  LearningTask['status'],
  'in-progress' | 'completed' | 'skipped'
>;

export interface PathTaskSyncResult {
  path: LearningPath;
  node: LearningPathNode;
  changed: boolean;
}

function findNodeIndex(path: LearningPath, task: LearningTask): number {
  if (task.pathNodeId) {
    const byId = path.nodes.findIndex((node) => node.id === task.pathNodeId);
    if (byId >= 0) return byId;
  }

  return path.nodes.findIndex((node) =>
    [node.topic, ...node.knowledgePoints].some((label) => sameKnowledgePoint(label, task.nodeId)),
  );
}

function findKnowledgeState(states: KnowledgeState[], task: LearningTask): KnowledgeState | null {
  return (
    states.find((state) => state.nodeId === task.nodeId) ??
    states.find((state) =>
      [state.nodeId, state.displayName]
        .filter(Boolean)
        .some((label) => sameKnowledgePoint(String(label), task.nodeId)),
    ) ??
    null
  );
}

/**
 * Reflect a plan task interaction on the long-term route without treating a
 * self-reported task completion as verified mastery evidence.
 */
export async function syncLearningPathNodeFromTask(
  storage: StorageProvider,
  userId: string,
  pathId: string | undefined,
  task: LearningTask,
  status: PathTaskStatus,
): Promise<PathTaskSyncResult | null> {
  if (!pathId) return null;

  const pathDAO = createLearningPathDAO(storage);
  const path = await pathDAO.get(pathId);
  if (!path || path.userId !== userId) return null;

  const nodeIndex = findNodeIndex(path, task);
  if (nodeIndex < 0) return null;

  const node = path.nodes[nodeIndex];
  const knowledgeState = findKnowledgeState(
    await createKnowledgeStateDAO(storage).list(userId),
    task,
  );
  const masteryVerified = (knowledgeState?.mastery ?? 0) >= 0.8;
  let nextStatus: LearningPathNode['status'] = node.status;

  if (status === 'skipped') {
    nextStatus = 'skipped';
  } else if (status === 'completed') {
    // A self-reported task is progress, not proof of mastery. Only a verified
    // knowledge state can move the route node to completed.
    nextStatus = masteryVerified ? 'completed' : 'in_progress';
  } else if (node.status === 'pending') {
    nextStatus = 'in_progress';
  }

  const updatedNodes = path.nodes.map((candidate, index) =>
    index === nodeIndex
      ? {
          ...candidate,
          status: nextStatus,
          ...(knowledgeState ? { masteryAfter: knowledgeState.mastery * 100 } : {}),
        }
      : candidate,
  );

  if (nextStatus === 'completed') {
    const nextPendingIndex = updatedNodes.findIndex(
      (candidate, index) => index > nodeIndex && candidate.status === 'pending',
    );
    if (nextPendingIndex >= 0) {
      updatedNodes[nextPendingIndex] = {
        ...updatedNodes[nextPendingIndex],
        status: 'in_progress',
      };
    }
  }

  const changed = JSON.stringify(updatedNodes) !== JSON.stringify(path.nodes);
  if (!changed) return { path, node, changed: false };

  const updatedPath = await pathDAO.update(path.id, { nodes: updatedNodes });
  if (!updatedPath) return null;

  return {
    path: updatedPath,
    node: updatedNodes[nodeIndex],
    changed: true,
  };
}
