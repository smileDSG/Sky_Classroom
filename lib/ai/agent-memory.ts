/**
 * O-004 — Agent memory engine.
 *
 * Short-term memory: sliding window of recent messages.
 * Long-term memory: persistent key facts extracted from conversations.
 * Supports summarisation and context injection for LLM system prompts.
 */

export interface MemoryEntry {
  id: string;
  topic: string;
  fact: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AgentMemory {
  shortTerm: ConversationTurn[];
  longTerm: MemoryEntry[];
}

const MAX_SHORT_TERM = 20;
const MAX_LONG_TERM = 50;

// ── Short-term memory ─────────────────────────────────────────────

/** Add a turn to the short-term sliding window */
export function addTurn(memory: AgentMemory, turn: ConversationTurn): AgentMemory {
  const shortTerm = [...memory.shortTerm, turn].slice(-MAX_SHORT_TERM);
  return { ...memory, shortTerm };
}

/** Get recent N turns */
export function getRecentTurns(memory: AgentMemory, n = 5): ConversationTurn[] {
  return memory.shortTerm.slice(-n);
}

// ── Long-term memory ──────────────────────────────────────────────

/** Add a fact to long-term memory, deduplicating by topic */
export function rememberFact(
  memory: AgentMemory,
  topic: string,
  fact: string,
): AgentMemory {
  const now = Date.now();
  const existingIdx = memory.longTerm.findIndex((e) => e.topic === topic);
  const longTerm = [...memory.longTerm];

  if (existingIdx >= 0) {
    longTerm[existingIdx] = {
      ...longTerm[existingIdx],
      fact,
      lastAccessed: now,
      accessCount: longTerm[existingIdx].accessCount + 1,
    };
  } else {
    longTerm.push({
      id: `mem-${now}-${Math.random().toString(36).slice(2, 6)}`,
      topic,
      fact,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
    });
  }

  // Evict oldest if over limit
  if (longTerm.length > MAX_LONG_TERM) {
    longTerm.sort((a, b) => a.lastAccessed - b.lastAccessed);
    longTerm.shift();
  }

  return { ...memory, longTerm };
}

/** Retrieve facts matching a topic (fuzzy). Updates access counts in-place. */
export function recallFacts(memory: AgentMemory, query: string): MemoryEntry[] {
  const q = query.toLowerCase();
  const now = Date.now();
  const results: MemoryEntry[] = [];

  for (const entry of memory.longTerm) {
    if (
      entry.topic.toLowerCase().includes(q) ||
      entry.fact.toLowerCase().includes(q)
    ) {
      entry.lastAccessed = now;
      entry.accessCount += 1;
      results.push({ ...entry });
    }
  }

  return results.sort((a, b) => b.accessCount - a.accessCount);
}

/** Get the most frequently accessed facts */
export function getTopFacts(memory: AgentMemory, n = 5): MemoryEntry[] {
  return [...memory.longTerm]
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, n);
}

// ── Summarisation ─────────────────────────────────────────────────

/** Summarise recent conversation into a compressed context string */
export function summariseMemory(memory: AgentMemory): string {
  const parts: string[] = [];

  // Recent conversation
  if (memory.shortTerm.length > 0) {
    const recent = memory.shortTerm.slice(-6);
    parts.push('【近期对话】');
    for (const turn of recent) {
      const label = turn.role === 'user' ? '学生' : 'AI';
      const preview = turn.content.slice(0, 100).replace(/\n/g, ' ');
      parts.push(`${label}：${preview}`);
    }
  }

  // Key facts
  const topFacts = getTopFacts(memory, 5);
  if (topFacts.length > 0) {
    parts.push('');
    parts.push('【学生关键信息】');
    for (const f of topFacts) {
      parts.push(`- ${f.topic}：${f.fact}`);
    }
  }

  return parts.join('\n');
}

/** Build a context injection string for the system prompt */
export function injectMemoryContext(
  basePrompt: string,
  memory: AgentMemory,
): string {
  const summary = summariseMemory(memory);
  if (!summary) return basePrompt;
  return `${basePrompt}\n\n以下是该学生的历史学习记录，请在回答时参考：\n${summary}`;
}

// ── Factory ────────────────────────────────────────────────────────

export function createMemory(): AgentMemory {
  return { shortTerm: [], longTerm: [] };
}
