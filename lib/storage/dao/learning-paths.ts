/**
 * Learning Path DAO — Persistent storage for learning paths.
 */

import type { LearningPath } from '@/lib/teaching/learning-path-types';
import type { StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'learning_paths';

export interface LearningPathDAO {
  add(path: LearningPath): Promise<LearningPath>;
  get(id: string): Promise<LearningPath | null>;
  update(id: string, partial: Partial<LearningPath>): Promise<LearningPath | null>;
  listByUser(userId: string): Promise<LearningPath[]>;
  getActiveByUser(userId: string): Promise<LearningPath | null>;
  delete(id: string): Promise<boolean>;
}

export function createLearningPathDAO(storage: StorageProvider): LearningPathDAO {
  return {
    async add(path: LearningPath): Promise<LearningPath> {
      await storage.set(TABLE, {
        id: path.id,
        data: path,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return path;
    },

    async get(id: string): Promise<LearningPath | null> {
      const entry = await storage.get<LearningPath>(TABLE, id);
      return entry?.data ?? null;
    },

    async update(id: string, partial: Partial<LearningPath>): Promise<LearningPath | null> {
      const entry = await storage.get<LearningPath>(TABLE, id);
      if (!entry) return null;
      const updated = { ...entry.data, ...partial, updatedAt: Date.now() };
      await storage.set(TABLE, {
        id,
        data: updated,
        createdAt: entry.createdAt,
        updatedAt: Date.now(),
      });
      return updated;
    },

    async listByUser(userId: string): Promise<LearningPath[]> {
      const entries = await storage.getAll<LearningPath>(
        TABLE,
        (entry) => entry.data.userId === userId,
      );
      return entries.map((e) => e.data).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getActiveByUser(userId: string): Promise<LearningPath | null> {
      const entries = await storage.getAll<LearningPath>(TABLE, (entry) => {
        const path = entry.data;
        if (path.userId !== userId) return false;
        // A path is "active" while it still has pending/in-progress work, OR
        // it has nodes but none are completed/skipped yet (freshly created).
        const hasOpen = path.nodes.some(
          (n) => n.status === 'pending' || n.status === 'in_progress',
        );
        const hasFinished = path.nodes.some(
          (n) => n.status === 'completed' || n.status === 'skipped',
        );
        return hasOpen || (path.nodes.length > 0 && !hasFinished);
      });
      if (entries.length === 0) return null;
      // Return most recently updated active path
      return entries.map((e) => e.data).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    },

    async delete(id: string): Promise<boolean> {
      await storage.delete(TABLE, id);
      return true;
    },
  };
}
