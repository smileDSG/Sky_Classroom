/**
 * Session DAO — manages refresh token sessions.
 */

import { createStorageProvider } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'sessions';

export interface SessionEntry {
  id: string; // session UUID (jti)
  userId: string;
  tokenHash: string;
  expiresAt: number;
  createdAt: number;
}

let _provider: StorageProvider | null = null;

async function ensureProvider(): Promise<StorageProvider> {
  if (!_provider) {
    _provider = await createStorageProvider({
      databaseName: 'MAIC-Auth',
    });
  }
  return _provider;
}

export async function createSessionDAO(storage?: StorageProvider) {
  const s = storage ?? (await ensureProvider());

  return {
    async create(session: Omit<SessionEntry, 'createdAt'>): Promise<void> {
      const now = Date.now();
      await s.set(TABLE, {
        id: session.id,
        data: { ...session, createdAt: now } as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      });
    },

    async getById(id: string): Promise<SessionEntry | null> {
      const result = await s.get<SessionEntry>(TABLE, id);
      return result?.data ?? null;
    },

    async delete(id: string): Promise<boolean> {
      return s.delete(TABLE, id);
    },

    async deleteByUserId(userId: string): Promise<void> {
      const all = await s.getAll<SessionEntry>(TABLE);
      for (const entry of all.filter((e) => (e.data as SessionEntry).userId === userId)) {
        await s.delete(TABLE, entry.id);
      }
    },
  };
}

export type SessionDAO = ReturnType<typeof createSessionDAO>;
