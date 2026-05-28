/**
 * User DAO — data access layer for user accounts.
 * Uses the existing StorageFactory (IndexedDB → localStorage → memory).
 */

import { createStorageProvider, getStorageProvider } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'users';

export interface UserEntry {
  id: string;
  email: string | null;
  username: string;
  passwordHash: string | null;
  role: 'guest' | 'user' | 'admin';
  status: 'active' | 'suspended';
  guestId: string | null;
  planType: 'free' | 'basic' | 'pro' | 'enterprise';
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  /** Profile fields (server-persisted) */
  avatar: string | null;
  nickname: string | null;
  bio: string | null;
  /** Personalization fields */
  educationLevel: string | null;
  grade: string | null;
  favoriteSubjects: { id: string; name: string; enabled: boolean }[] | null;
  learningStyle: string | null;
  detailLevel: string | null;
  preferredLanguage: string | null;
  aiPersonality: string | null;
  aiName: string | null;
  customInstructions: string | null;
  autoGenerateQuiz: boolean | null;
  showStepByStep: boolean | null;
  enableMemory: boolean | null;
  enableRAG: boolean | null;
  /** Email verification */
  emailVerified: boolean;
  emailVerifyToken: string | null;
  /** Password reset */
  resetToken: string | null;
  resetTokenExpiry: number | null;
}

async function ensureProvider(): Promise<StorageProvider> {
  return getStorageProvider();
}

export async function createUserDAO(storage?: StorageProvider): Promise<{
  create: (user: Omit<UserEntry, 'createdAt' | 'updatedAt' | 'lastLoginAt'>) => Promise<UserEntry>;
  getById: (id: string) => Promise<UserEntry | null>;
  getByEmail: (email: string) => Promise<UserEntry | null>;
  getByUsername: (username: string) => Promise<UserEntry | null>;
  getByGuestId: (guestId: string) => Promise<UserEntry | null>;
  update: (id: string, data: Partial<UserEntry>) => Promise<UserEntry | null>;
  delete: (id: string) => Promise<boolean>;
  list: () => Promise<UserEntry[]>;
}> {
  const s = storage ?? await ensureProvider();

  return {
    async create(user: Omit<UserEntry, 'createdAt' | 'updatedAt' | 'lastLoginAt'>): Promise<UserEntry> {
      const now = Date.now();
      const entry = {
        id: user.id,
        data: {
          ...user,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: null,
          avatar: user.avatar ?? null,
          nickname: user.nickname ?? null,
          bio: user.bio ?? null,
          emailVerified: user.emailVerified ?? false,
          emailVerifyToken: user.emailVerifyToken ?? null,
          resetToken: user.resetToken ?? null,
          resetTokenExpiry: user.resetTokenExpiry ?? null,
        } as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      };
      await s.set(TABLE, entry);
      return entry.data as unknown as UserEntry;
    },

    async getById(id: string): Promise<UserEntry | null> {
      const result = await s.get<UserEntry>(TABLE, id);
      return result?.data ?? null;
    },

    async getByEmail(email: string): Promise<UserEntry | null> {
      const all = await s.getAll<UserEntry>(TABLE);
      return all.find((e) => (e.data as UserEntry).email?.toLowerCase() === email.toLowerCase())?.data as UserEntry ?? null;
    },

    async getByUsername(username: string): Promise<UserEntry | null> {
      const all = await s.getAll<UserEntry>(TABLE);
      return all.find((e) => (e.data as UserEntry).username.toLowerCase() === username.toLowerCase())?.data as UserEntry ?? null;
    },

    async getByGuestId(guestId: string): Promise<UserEntry | null> {
      const all = await s.getAll<UserEntry>(TABLE);
      return all.find((e) => (e.data as UserEntry).guestId === guestId)?.data as UserEntry ?? null;
    },

    async update(id: string, data: Partial<UserEntry>): Promise<UserEntry | null> {
      const existing = await s.get<UserEntry>(TABLE, id);
      if (!existing) return null;
      const updated = {
        ...existing,
        data: { ...existing.data, ...data, updatedAt: Date.now() },
        updatedAt: Date.now(),
      };
      await s.set(TABLE, updated);
      return updated.data as unknown as UserEntry;
    },

    async delete(id: string): Promise<boolean> {
      return s.delete(TABLE, id);
    },

    async list(): Promise<UserEntry[]> {
      const all = await s.getAll<UserEntry>(TABLE);
      return all.map((e) => e.data as UserEntry);
    },
  };
}

export type UserDAO = ReturnType<typeof createUserDAO>;
