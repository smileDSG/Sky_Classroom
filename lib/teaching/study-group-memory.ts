/**
 * Study Group Memory — Extract and persist key discussion points across sessions.
 *
 * Since /api/chat is stateless, memory is maintained client-side and
 * injected into the discussion prompt on each request.
 */

export interface StudyGroupMemory {
  entries: Array<{
    agentName: string;
    content: string;
    timestamp: number;
  }>;
}

const MAX_MEMORY_ENTRIES = 20;
const MAX_MEMORY_CHARS = 800;

/**
 * Create an empty study group memory.
 */
export function createStudyGroupMemory(): StudyGroupMemory {
  return { entries: [] };
}

/**
 * Extract key points from a batch of discussion messages.
 * Only keeps agent messages (not user messages) and truncates long ones.
 */
export function extractMemoryFromMessages(
  messages: Array<{ agentName: string; content: string; role: 'agent' | 'user' }>,
): StudyGroupMemory {
  const entries = messages
    .filter((m) => m.role === 'agent' && m.content.trim().length > 0)
    .map((m) => ({
      agentName: m.agentName,
      content: m.content.slice(0, 200),
      timestamp: Date.now(),
    }));

  return { entries };
}

/**
 * Merge new entries into existing memory, keeping the most recent ones
 * and capping total size.
 */
export function mergeMemory(
  existing: StudyGroupMemory,
  incoming: StudyGroupMemory,
): StudyGroupMemory {
  const merged = [...existing.entries, ...incoming.entries];
  // Deduplicate by content similarity (exact match for simplicity)
  const seen = new Set<string>();
  const deduped = merged.filter((e) => {
    const key = `${e.agentName}:${e.content.slice(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Keep most recent, cap at MAX_MEMORY_ENTRIES
  const limited = deduped.slice(-MAX_MEMORY_ENTRIES);
  return { entries: limited };
}

/**
 * Format memory entries as a prompt snippet for the director.
 */
export function formatMemoryForPrompt(memory: StudyGroupMemory): string {
  if (memory.entries.length === 0) return '';

  const lines = ['\n# 之前讨论要点'];
  for (const entry of memory.entries.slice(-6)) {
    lines.push(`- ${entry.agentName}: ${entry.content.slice(0, 120)}`);
  }

  const result = lines.join('\n');
  if (result.length > MAX_MEMORY_CHARS) {
    return result.slice(0, MAX_MEMORY_CHARS) + '...';
  }
  return result;
}
