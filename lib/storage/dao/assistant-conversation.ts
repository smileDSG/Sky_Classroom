/**
 * Assistant Conversation DAO
 *
 * Manages persistent conversation history for Sky Assistant.
 * Supports creating, loading, and searching past conversations.
 */

// Re-export for convenience
export type { AssistantConversationRecord } from '@/lib/utils/database';

import {
  db,
  type AssistantConversationRecord,
  type AssistantMessage,
} from '@/lib/utils/database';
import { createLogger } from '@/lib/logger';

const log = createLogger('AssistantConversationDAO');

// ── Create ────────────────────────────────────────────────────────

/** Create a new conversation record */
export async function createConversation(input: {
  mode: 'anime' | 'normal';
  subject?: string;
  difficulty?: string;
  style?: string;
  firstMessage?: string;
}): Promise<AssistantConversationRecord> {
  const now = Date.now();
  const title = input.firstMessage
    ? input.firstMessage.slice(0, 50).replace(/\n/g, ' ')
    : '新对话';

  const record: AssistantConversationRecord = {
    id: `conv-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    mode: input.mode,
    subject: input.subject,
    difficulty: input.difficulty,
    style: input.style,
    messages: [],
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.assistantConversations.add(record);
  log.info(`Created conversation ${record.id}`);
  return record;
}

/** Append a message to an existing conversation */
export async function appendMessage(
  conversationId: string,
  message: AssistantMessage,
): Promise<void> {
  const conv = await db.assistantConversations.get(conversationId);
  if (!conv) {
    log.warn(`Conversation ${conversationId} not found`);
    return;
  }

  const messages = [...conv.messages, message];
  await db.assistantConversations.update(conversationId, {
    messages,
    messageCount: messages.filter((m) => m.role !== 'system').length,
    updatedAt: Date.now(),
  });
}

/** Append multiple messages at once (for batch save) */
export async function appendMessages(
  conversationId: string,
  newMessages: AssistantMessage[],
): Promise<void> {
  const conv = await db.assistantConversations.get(conversationId);
  if (!conv) return;

  const messages = [...conv.messages, ...newMessages];
  await db.assistantConversations.update(conversationId, {
    messages,
    messageCount: messages.filter((m) => m.role !== 'system').length,
    updatedAt: Date.now(),
  });
}

/** Update conversation summary */
export async function updateSummary(
  conversationId: string,
  summary: string,
): Promise<void> {
  await db.assistantConversations.update(conversationId, {
    summary,
    updatedAt: Date.now(),
  });
}

// ── Read ──────────────────────────────────────────────────────────

/** Get a single conversation by ID */
export async function getConversation(
  id: string,
): Promise<AssistantConversationRecord | undefined> {
  return db.assistantConversations.get(id);
}

/** List recent conversations, newest first */
export async function listConversations(options?: {
  mode?: 'anime' | 'normal';
  limit?: number;
  offset?: number;
}): Promise<AssistantConversationRecord[]> {
  let collection = db.assistantConversations.orderBy('updatedAt');

  let records = await collection.reverse().toArray();

  if (options?.mode) {
    records = records.filter((r) => r.mode === options.mode);
  }

  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;
  return records.slice(offset, offset + limit);
}

/** Search conversations by title or message content */
export async function searchConversations(
  query: string,
  limit = 10,
): Promise<AssistantConversationRecord[]> {
  const q = query.toLowerCase();
  const all = await db.assistantConversations.orderBy('updatedAt').reverse().toArray();

  return all
    .filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true;
      return r.messages.some((m) => m.content.toLowerCase().includes(q));
    })
    .slice(0, limit);
}

// ── Delete ────────────────────────────────────────────────────────

/** Delete a conversation */
export async function deleteConversation(id: string): Promise<void> {
  await db.assistantConversations.delete(id);
  log.info(`Deleted conversation ${id}`);
}

/** Delete all conversations */
export async function deleteAllConversations(): Promise<void> {
  await db.assistantConversations.clear();
  log.info('Deleted all conversations');
}

// ── Stats ─────────────────────────────────────────────────────────

/** Get conversation statistics */
export async function getConversationStats(): Promise<{
  total: number;
  byMode: Record<string, number>;
  totalMessages: number;
}> {
  const all = await db.assistantConversations.toArray();
  const byMode: Record<string, number> = {};
  let totalMessages = 0;

  for (const conv of all) {
    byMode[conv.mode] = (byMode[conv.mode] ?? 0) + 1;
    totalMessages += conv.messageCount;
  }

  return { total: all.length, byMode, totalMessages };
}
