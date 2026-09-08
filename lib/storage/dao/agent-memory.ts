/**
 * GAM-style Agent Memory DAO
 *
 * Provides CRUD operations for persistent agent memories stored in IndexedDB.
 * Supports querying by agent, type, category, and relevance.
 */

import { db, type AgentMemoryRecord } from '@/lib/utils/database';
import { createLogger } from '@/lib/logger';

const log = createLogger('AgentMemoryDAO');

export type MemoryType = AgentMemoryRecord['type'];

export interface CreateMemoryInput {
  agentId: string;
  userId?: string;
  type: MemoryType;
  category: string;
  content: string;
  importance?: number;
  sourceConversationId?: string;
  expiresAt?: number;
}

export interface MemoryQueryOptions {
  agentId: string;
  userId?: string;
  type?: MemoryType;
  category?: string;
  minImportance?: number;
  limit?: number;
}

// ── Create ────────────────────────────────────────────────────────

/** Store a new memory entry */
export async function createMemory(input: CreateMemoryInput): Promise<AgentMemoryRecord> {
  const now = Date.now();
  const record: AgentMemoryRecord = {
    id: `mem-${now}-${Math.random().toString(36).slice(2, 8)}`,
    agentId: input.agentId,
    userId: input.userId,
    type: input.type,
    category: input.category,
    content: input.content,
    importance: input.importance ?? 0.5,
    sourceConversationId: input.sourceConversationId,
    accessCount: 0,
    lastAccessed: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
  };

  await db.agentMemories.add(record);
  log.info(`Created ${input.type} memory for ${input.agentId}: ${input.content.slice(0, 50)}…`);
  return record;
}

/** Store multiple memories in batch */
export async function createMemories(inputs: CreateMemoryInput[]): Promise<AgentMemoryRecord[]> {
  const now = Date.now();
  const records: AgentMemoryRecord[] = inputs.map((input, i) => ({
    id: `mem-${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    agentId: input.agentId,
    userId: input.userId,
    type: input.type,
    category: input.category,
    content: input.content,
    importance: input.importance ?? 0.5,
    sourceConversationId: input.sourceConversationId,
    accessCount: 0,
    lastAccessed: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
  }));

  await db.agentMemories.bulkAdd(records);
  log.info(`Batch created ${records.length} memories for ${inputs[0]?.agentId}`);
  return records;
}

// ── Read ──────────────────────────────────────────────────────────

/** Query memories with flexible filtering */
export async function queryMemories(options: MemoryQueryOptions): Promise<AgentMemoryRecord[]> {
  let collection = db.agentMemories.where('agentId').equals(options.agentId);

  let records = await collection.toArray();

  // Filter by userId
  if (options.userId) {
    records = records.filter((r) => r.userId === options.userId);
  }

  // Filter by type
  if (options.type) {
    records = records.filter((r) => r.type === options.type);
  }

  // Filter by category
  if (options.category) {
    records = records.filter((r) => r.category === options.category);
  }

  // Filter by minimum importance
  if (options.minImportance !== undefined) {
    records = records.filter((r) => r.importance >= options.minImportance!);
  }

  // Filter out expired memories
  const now = Date.now();
  records = records.filter((r) => !r.expiresAt || r.expiresAt > now);

  // Sort by importance (desc) then lastAccessed (desc)
  records.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return b.lastAccessed - a.lastAccessed;
  });

  // Apply limit
  if (options.limit) {
    records = records.slice(0, options.limit);
  }

  return records;
}

/** Get all memories for an agent, sorted by importance */
export async function getAgentMemories(agentId: string, limit = 50): Promise<AgentMemoryRecord[]> {
  return queryMemories({ agentId, limit });
}

/** Search memories by content (fuzzy text match) */
export async function searchMemories(
  agentId: string,
  query: string,
  limit = 10,
): Promise<AgentMemoryRecord[]> {
  const q = query.toLowerCase();
  const all = await db.agentMemories.where('agentId').equals(agentId).toArray();

  const now = Date.now();
  const results = all.filter(
    (r) =>
      (!r.expiresAt || r.expiresAt > now) &&
      (r.content.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)),
  );

  // Update access counts for recalled memories
  const now2 = Date.now();
  await db.agentMemories.bulkPut(
    results.map((r) => ({
      ...r,
      accessCount: r.accessCount + 1,
      lastAccessed: now2,
      updatedAt: now2,
    })),
  );

  results.sort((a, b) => b.importance - a.importance);
  return results.slice(0, limit);
}

/** Get a single memory by ID */
export async function getMemory(id: string): Promise<AgentMemoryRecord | undefined> {
  return db.agentMemories.get(id);
}

// ── Update ────────────────────────────────────────────────────────

/** Update an existing memory */
export async function updateMemory(
  id: string,
  updates: Partial<
    Pick<AgentMemoryRecord, 'content' | 'importance' | 'category' | 'type' | 'expiresAt'>
  >,
): Promise<void> {
  await db.agentMemories.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

/** Touch a memory (increment access count, update lastAccessed) */
export async function touchMemory(id: string): Promise<void> {
  const now = Date.now();
  const record = await db.agentMemories.get(id);
  const newCount = (record?.accessCount ?? 0) + 1;
  await db.agentMemories.update(id, {
    accessCount: newCount,
    lastAccessed: now,
    updatedAt: now,
  });
}

/** Deduplicate: update existing memory if same agent+type+category+content exists, else create */
export async function upsertMemory(input: CreateMemoryInput): Promise<AgentMemoryRecord> {
  const existing = await db.agentMemories.where('agentId').equals(input.agentId).toArray();

  const duplicate = existing.find(
    (r) => r.type === input.type && r.category === input.category && r.content === input.content,
  );

  if (duplicate) {
    const now = Date.now();
    await db.agentMemories.update(duplicate.id, {
      importance: Math.max(duplicate.importance, input.importance ?? 0.5),
      accessCount: duplicate.accessCount + 1,
      lastAccessed: now,
      updatedAt: now,
      sourceConversationId: input.sourceConversationId ?? duplicate.sourceConversationId,
    });
    return (await db.agentMemories.get(duplicate.id))!;
  }

  return createMemory(input);
}

// ── Delete ────────────────────────────────────────────────────────

/** Delete a single memory */
export async function deleteMemory(id: string): Promise<void> {
  await db.agentMemories.delete(id);
}

/** Delete all memories for an agent */
export async function deleteAgentMemories(agentId: string): Promise<void> {
  await db.agentMemories.where('agentId').equals(agentId).delete();
  log.info(`Deleted all memories for agent ${agentId}`);
}

/** Delete expired memories (cleanup) */
export async function cleanupExpiredMemories(): Promise<number> {
  const now = Date.now();
  const all = await db.agentMemories.toArray();
  const expired = all.filter((r) => r.expiresAt && r.expiresAt <= now);
  await db.agentMemories.bulkDelete(expired.map((r) => r.id));
  if (expired.length > 0) {
    log.info(`Cleaned up ${expired.length} expired memories`);
  }
  return expired.length;
}

// ── Stats ─────────────────────────────────────────────────────────

/** Get memory statistics for an agent */
export async function getMemoryStats(agentId: string): Promise<{
  total: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  topCategories: Array<{ category: string; count: number }>;
}> {
  const records = await db.agentMemories.where('agentId').equals(agentId).toArray();
  const now = Date.now();
  const active = records.filter((r) => !r.expiresAt || r.expiresAt > now);

  const byType: Record<MemoryType, number> = {
    core: 0,
    preference: 0,
    fact: 0,
    progress: 0,
    question: 0,
    decision: 0,
  };
  const categoryMap: Record<string, number> = {};

  for (const r of active) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    categoryMap[r.category] = (categoryMap[r.category] ?? 0) + 1;
  }

  const topCategories = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const avgImportance =
    active.length > 0 ? active.reduce((sum, r) => sum + r.importance, 0) / active.length : 0;

  return { total: active.length, byType, avgImportance, topCategories };
}
