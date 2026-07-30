/**
 * KnowledgeState DAO
 *
 * Stores per-user, per-node mastery estimates. All operations are scoped to
 * the authenticated user; cross-user reads/writes are rejected.
 */
import type { StorageProvider, StorageEntry } from '@/lib/storage/storage-types';
import type { KnowledgeState } from '@/lib/adaptive-learning/contracts';

const TABLE = 'knowledge-state';

export interface KnowledgeStateDAO {
  /** Upsert a knowledge state for the authenticated user. */
  set(userId: string, state: KnowledgeState): Promise<void>;
  /** Get a single knowledge state by nodeId. Returns null if not found or belongs to another user. */
  get(userId: string, nodeId: string): Promise<KnowledgeState | null>;
  /** List all knowledge states for the authenticated user. */
  list(userId: string): Promise<KnowledgeState[]>;
  /** Delete a knowledge state. Returns true only if the entry existed and belonged to the user. */
  delete(userId: string, nodeId: string): Promise<boolean>;
  /** Count knowledge states for the authenticated user. */
  count(userId: string): Promise<number>;
}

export function createKnowledgeStateDAO(storage: StorageProvider): KnowledgeStateDAO {
  return {
    async set(userId: string, state: KnowledgeState): Promise<void> {
      if (!userId) throw new Error('Authenticated userId is required');
      const key = `${userId}:${state.nodeId}`;
      const existing = await storage.get<KnowledgeState>(TABLE, key);
      const now = Date.now();
      const entry: StorageEntry<KnowledgeState> = {
        id: key,
        data: { ...state, userId },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await storage.set(TABLE, entry);
    },

    async get(userId: string, nodeId: string): Promise<KnowledgeState | null> {
      if (!userId) return null;
      const entry = await storage.get<KnowledgeState>(TABLE, `${userId}:${nodeId}`);
      if (!entry || entry.data.userId !== userId) return null;
      return entry.data;
    },

    async list(userId: string): Promise<KnowledgeState[]> {
      if (!userId) return [];
      const entries = await storage.getAll<KnowledgeState>(TABLE);
      return entries
        .filter((entry) => entry.data.userId === userId)
        .map((entry) => entry.data)
        .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    },

    async delete(userId: string, nodeId: string): Promise<boolean> {
      if (!userId) return false;
      const key = `${userId}:${nodeId}`;
      const existing = await storage.get<KnowledgeState>(TABLE, key);
      if (!existing || existing.data.userId !== userId) return false;
      await storage.delete(TABLE, key);
      return true;
    },

    async count(userId: string): Promise<number> {
      if (!userId) return 0;
      const entries = await storage.getAll<KnowledgeState>(TABLE);
      return entries.filter((entry) => entry.data.userId === userId).length;
    },
  };
}
