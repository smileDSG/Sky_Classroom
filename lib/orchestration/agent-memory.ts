/**
 * Agent Memory — Cross-Turn Context Retention
 *
 * Agents can remember key information from recent turns to maintain
 * coherent multi-turn conversations. Short-term memory tracks the
 * last N turns' content and actions.
 * Extended in P6-002 with typed memory entries, importance scoring,
 * and search capabilities for cross-turn preference tracking.
 */

import type { AgentTurnSummary } from './types';
import { AGENT_MEMORY_TURNS } from './config';

export interface AgentMemory {
  /** Summaries of recent turns by this agent */
  recentTurns: Array<{
    contentPreview: string;
    actionNames: string[];
  }>;
  /** Running list of key facts mentioned by this agent */
  keyFacts: string[];
}

// ─── P6-002: Typed memory entries ───

export interface MemoryEntry {
  id: string;
  type: 'preference' | 'fact' | 'progress' | 'question' | 'decision';
  content: string;
  turnNumber: number;
  importance: number; // 0-1
  source: string;
}

export interface TypedMemory {
  agentId: string;
  entries: MemoryEntry[];
  maxEntries: number;
}

export function createTypedMemory(agentId: string, maxEntries = 50): TypedMemory {
  return { agentId, entries: [], maxEntries };
}

export function addTypedMemory(
  memory: TypedMemory,
  type: MemoryEntry['type'],
  content: string,
  turnNumber: number,
  importance = 0.5,
): MemoryEntry {
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    content,
    turnNumber,
    importance,
    source: memory.agentId,
  };
  memory.entries.push(entry);
  if (memory.entries.length > memory.maxEntries) {
    memory.entries.sort((a, b) => a.importance - b.importance);
    memory.entries.shift();
  }
  return entry;
}

export function searchTypedMemory(memory: TypedMemory, query: string): MemoryEntry[] {
  const q = query.toLowerCase();
  return memory.entries.filter((e) => e.content.toLowerCase().includes(q));
}

export function buildTypedMemoryContext(memory: TypedMemory): string {
  if (memory.entries.length === 0) return '[No previous memories]';
  const prefs = memory.entries.filter((e) => e.type === 'preference');
  const decisions = memory.entries.filter((e) => e.type === 'decision');
  const progress = memory.entries.filter((e) => e.type === 'progress');
  const lines = ['[Agent Memory]'];
  if (prefs.length) lines.push(`Preferences: ${prefs.map((p) => p.content).join('; ')}`);
  if (decisions.length) lines.push(`Decisions: ${decisions.slice(-3).map((d) => d.content).join('; ')}`);
  if (progress.length) lines.push(`Progress: ${progress.map((p) => p.content).join('; ')}`);
  return lines.join('\n');
}

// ─── Original implementation ───

/**
 * Extract agent memory from the agent response history.
 * Keeps only the most recent turns for the specified agent.
 */
export function getAgentMemory(agentResponses: AgentTurnSummary[], agentId: string): AgentMemory {
  const agentTurns = agentResponses.filter((r) => r.agentId === agentId);
  const recentTurns = agentTurns.slice(-AGENT_MEMORY_TURNS).map((turn) => ({
    contentPreview: turn.contentPreview,
    actionNames: turn.whiteboardActions?.map((a) => a.actionName) ?? [],
  }));

  // Extract key facts from content previews (simple heuristic: first sentence)
  const keyFacts = agentTurns
    .map((turn) => turn.contentPreview.split(/[.!?]/)[0]?.trim())
    .filter(Boolean)
    .slice(-AGENT_MEMORY_TURNS);

  return { recentTurns, keyFacts };
}

/**
 * Format agent memory as a text block for inclusion in the system prompt.
 */
export function formatAgentMemory(memory: AgentMemory): string {
  if (memory.recentTurns.length === 0) return '';

  const lines = ['\nYour recent activity:'];
  for (const turn of memory.recentTurns) {
    lines.push(`- Said: "${turn.contentPreview}"`);
    if (turn.actionNames.length > 0) {
      lines.push(`  Actions: ${turn.actionNames.join(', ')}`);
    }
  }

  if (memory.keyFacts.length > 0) {
    lines.push('\nKey points you made:');
    for (const fact of memory.keyFacts) {
      lines.push(`- ${fact}`);
    }
  }

  return lines.join('\n');
}
