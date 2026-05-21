/**
 * Module C — Conversation history management.
 *
 * Utilities for managing chat message history: trimming, token estimation,
 * and context extraction. Designed for server-side use in API routes.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CHARS_PER_TOKEN = 4; // rough estimate for Chinese/English mixed text
const DEFAULT_MAX_TOKENS = 4000;

/** Estimate token count from text (rough heuristic). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimate total tokens for an array of messages. */
export function estimateMessageTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

/**
 * Trim oldest messages to fit within a token budget.
 * Always keeps at least the most recent user-assistant pair.
 */
export function trimMessages(
  messages: ChatMessage[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
): ChatMessage[] {
  if (messages.length === 0) return [];

  let total = estimateMessageTokens(messages);
  if (total <= maxTokens) return [...messages];

  const trimmed = [...messages];

  // Remove from the front, but always keep the last message
  while (trimmed.length > 1 && estimateMessageTokens(trimmed) > maxTokens) {
    trimmed.shift();
  }

  return trimmed;
}

/**
 * Extract recent conversation context up to maxTokens.
 * Returns messages from newest to oldest, respecting the token budget.
 */
export function getRecentContext(
  messages: ChatMessage[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
): ChatMessage[] {
  if (messages.length === 0) return [];

  const result: ChatMessage[] = [];
  let tokensUsed = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    if (tokensUsed + msgTokens > maxTokens && result.length > 0) break;
    result.unshift(messages[i]);
    tokensUsed += msgTokens;
  }

  return result;
}

/**
 * Build a conversation summary for context injection.
 * Summarises the last few exchanges into a brief format string.
 */
export function summarizeConversation(
  messages: ChatMessage[],
  maxExchanges: number = 3,
): string {
  const relevant = messages.filter((m) => m.role !== 'system');
  const recent = relevant.slice(-maxExchanges * 2); // pairs of user+assistant

  if (recent.length === 0) return '';

  const lines: string[] = ['【近期对话摘要】'];
  for (const m of recent) {
    const label = m.role === 'user' ? '学生' : 'AI';
    const preview = m.content.slice(0, 80).replace(/\n/g, ' ');
    lines.push(`${label}：${preview}${m.content.length > 80 ? '…' : ''}`);
  }

  return lines.join('\n');
}
