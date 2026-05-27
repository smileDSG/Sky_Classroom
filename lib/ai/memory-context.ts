/**
 * GAM-style Memory Context Builder
 *
 * Retrieves relevant memories and builds context strings for injection
 * into system prompts. This is the bridge between the memory store
 * and the LLM prompt.
 */

import {
  queryMemories,
  upsertMemory,
  type MemoryQueryOptions,
} from '@/lib/storage/dao/agent-memory';
import type { AgentMemoryRecord } from '@/lib/utils/database';
import type { MemoryType } from '@/lib/storage/dao/agent-memory';
import { createLogger } from '@/lib/logger';

const log = createLogger('MemoryContextBuilder');

// ── Memory retrieval ──────────────────────────────────────────────

/** Retrieve memories relevant to a conversation context */
export async function retrieveRelevantMemories(
  agentId: string,
  currentMessage: string,
  options?: {
    userId?: string;
    maxMemories?: number;
  },
): Promise<AgentMemoryRecord[]> {
  const maxMemories = options?.maxMemories ?? 15;

  // 1. Always include core memories (high importance)
  const coreMemories = await queryMemories({
    agentId,
    userId: options?.userId,
    type: 'core',
    limit: 5,
  });

  // 2. Get recent high-importance memories across all types
  const importantMemories = await queryMemories({
    agentId,
    userId: options?.userId,
    minImportance: 0.7,
    limit: 10,
  });

  // 3. Search for memories relevant to the current message
  const relevantMemories = await searchMemoriesByKeywords(
    agentId,
    currentMessage,
    options?.userId,
  );

  // Merge and deduplicate
  const allMemories = [...coreMemories, ...importantMemories, ...relevantMemories];
  const seen = new Set<string>();
  const unique: AgentMemoryRecord[] = [];

  for (const mem of allMemories) {
    if (!seen.has(mem.id)) {
      seen.add(mem.id);
      unique.push(mem);
    }
  }

  // Sort by importance, then recency
  unique.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return b.lastAccessed - a.lastAccessed;
  });

  return unique.slice(0, maxMemories);
}

/** Simple keyword-based memory search */
async function searchMemoriesByKeywords(
  agentId: string,
  text: string,
  userId?: string,
): Promise<AgentMemoryRecord[]> {
  // Extract keywords from the message (simple approach)
  const keywords = extractKeywords(text);
  if (keywords.length === 0) return [];

  const allMemories = await queryMemories({
    agentId,
    userId,
    limit: 50,
  });

  // Score each memory by keyword overlap
  const scored = allMemories.map((mem) => {
    const memText = `${mem.content} ${mem.category}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (memText.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    return { memory: mem, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.memory)
    .slice(0, 5);
}

/** Extract meaningful keywords from text */
function extractKeywords(text: string): string[] {
  // Remove common stop words and short words
  const stopWords = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
    '看', '好', '自己', '这', '他', '她', '它', '什么', '怎么', '那', '这个',
    '那个', '吗', '呢', '吧', '啊', '哦', '嗯', '能', '可以', '请', '帮',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
    'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
  ]);

  // Split by common delimiters
  const words = text.split(/[\s,，。！？；：、""''（）()\[\]{}<>《》\/\\|@#$%^&*+=~`]+/);
  return words.filter((w) => w.length >= 2 && !stopWords.has(w.toLowerCase()));
}

// ── Context building ──────────────────────────────────────────────

/** Build a formatted memory context string for system prompt injection */
export function buildMemoryContext(memories: AgentMemoryRecord[]): string {
  if (memories.length === 0) return '';

  const sections: string[] = [];

  // Group by type
  const grouped = groupByType(memories);

  // Core identity facts
  if (grouped.core.length > 0) {
    sections.push('【学生基本信息】');
    for (const mem of grouped.core) {
      sections.push(`- ${mem.content}`);
    }
  }

  // Preferences
  if (grouped.preference.length > 0) {
    sections.push('');
    sections.push('【学习偏好】');
    for (const mem of grouped.preference) {
      sections.push(`- ${mem.content}`);
    }
  }

  // Learning progress
  if (grouped.progress.length > 0) {
    sections.push('');
    sections.push('【学习进度】');
    for (const mem of grouped.progress) {
      sections.push(`- ${mem.content}`);
    }
  }

  // Knowledge facts
  if (grouped.fact.length > 0) {
    sections.push('');
    sections.push('【已知事实】');
    for (const mem of grouped.fact) {
      sections.push(`- ${mem.content}`);
    }
  }

  // Decisions
  if (grouped.decision.length > 0) {
    sections.push('');
    sections.push('【学习决定】');
    for (const mem of grouped.decision) {
      sections.push(`- ${mem.content}`);
    }
  }

  // Recent questions
  if (grouped.question.length > 0) {
    sections.push('');
    sections.push('【近期疑问】');
    for (const mem of grouped.question.slice(-3)) {
      sections.push(`- ${mem.content}`);
    }
  }

  return sections.join('\n');
}

/** Group memories by type */
function groupByType(
  memories: AgentMemoryRecord[],
): Record<MemoryType, AgentMemoryRecord[]> {
  const result: Record<MemoryType, AgentMemoryRecord[]> = {
    core: [],
    preference: [],
    fact: [],
    progress: [],
    question: [],
    decision: [],
  };

  for (const mem of memories) {
    result[mem.type].push(mem);
  }

  return result;
}

/** Inject memory context into a system prompt */
export function injectMemoryIntoPrompt(
  basePrompt: string,
  memories: AgentMemoryRecord[],
): string {
  const context = buildMemoryContext(memories);
  if (!context) return basePrompt;

  return `${basePrompt}\n\n以下是该学生的历史学习档案，请在回答时参考这些信息，使回答更加个性化：\n${context}`;
}

// ── Memory saving helpers ─────────────────────────────────────────

/** Save extracted memories to the store */
export async function saveExtractedMemories(
  agentId: string,
  extracted: Array<{
    type: MemoryType;
    category: string;
    content: string;
    importance: number;
  }>,
  conversationId?: string,
): Promise<void> {
  for (const mem of extracted) {
    try {
      await upsertMemory({
        agentId,
        type: mem.type,
        category: mem.category,
        content: mem.content,
        importance: mem.importance,
        sourceConversationId: conversationId,
      });
    } catch (err) {
      log.warn(`Failed to save memory: ${mem.content.slice(0, 30)}…`, err);
    }
  }
}
