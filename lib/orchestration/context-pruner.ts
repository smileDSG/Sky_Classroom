/**
 * Context Pruner — Smart Context Window Management
 *
 * Intelligently trims conversation context to fit within model
 * token limits while preserving the most important information:
 * - System prompts (always preserved)
 * - Recent messages (last N turns)
 * - Key information from older messages (questions, decisions)
 * - Tool call results (referenced by ID)
 *
 * Uses layered compression from conversation-compression.ts
 * for older message summarization.
 */

import { compressConversation } from './conversation-compression';

type MessageRole = 'user' | 'assistant' | 'system' | 'agent' | 'tool';

interface Message {
  role: MessageRole;
  content?: string | unknown;
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

interface ContextBudget {
  maxTokens: number;
  maxMessages: number;
}

// Common model context windows
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-3-5-haiku': 200_000,
  'claude-sonnet-4-6': 200_000,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gemini-2.5-flash': 1_000_000,
  'deepseek-v4-pro': 128_000,
  'qwen3': 131_072,
};

/**
 * Get context window for a model.
 */
export function getContextWindow(modelId: string): number {
  for (const [pattern, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelId.includes(pattern)) return size;
  }
  return 128_000; // Default fallback
}

/**
 * Estimate token count for a message.
 */
function estimateMessageTokens(msg: Message): number {
  const content = typeof msg.content === 'string' ? msg.content : '';
  const baseTokens = Math.ceil(content.length / 3); // Rough estimate
  const roleOverhead = 4; // Role name overhead
  const toolOverhead = msg.tool_calls ? msg.tool_calls.length * 20 : 0;
  return baseTokens + roleOverhead + toolOverhead;
}

/**
 * Smart context pruning.
 *
 * Strategy:
 * 1. Always keep system messages
 * 2. Keep the most recent messages intact
 * 3. Compress older messages using layered compression
 * 4. If still over budget, drop oldest non-essential messages
 */
export function pruneContext(
  messages: Message[],
  modelId: string,
  options?: {
    /** Fraction of context window to use (default 0.8). */
    windowFraction?: number;
    /** Minimum messages to preserve at the end. */
    minRecent?: number;
  },
): Message[] {
  const windowFraction = options?.windowFraction ?? 0.8;
  const minRecent = options?.minRecent ?? 5;

  const maxTokens = getContextWindow(modelId) * windowFraction;
  const maxMessages = Math.max(minRecent, 10);

  // Calculate current token usage
  const totalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

  // No pruning needed
  if (totalTokens <= maxTokens && messages.length <= maxMessages) {
    return messages;
  }

  // Convert to conversation format for compression
  const convMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
    name: m.name,
  }));

  // Apply layered compression
  const compressed = compressConversation(convMessages, {
    maxMessages,
    maxTokens: Math.floor(maxTokens),
    preserveSystemMessages: true,
  });

  // Convert back to Message format
  return compressed.map((m, i) => {
    const original = messages.find(
      (orig) =>
        orig.role === m.role &&
        typeof orig.content === 'string' &&
        orig.content === m.content,
    );
    return original || { role: m.role as MessageRole, content: m.content };
  });
}

/**
 * Check if adding a new message would exceed the context budget.
 */
export function wouldExceedBudget(
  messages: Message[],
  newMessage: Message,
  modelId: string,
  windowFraction = 0.8,
): boolean {
  const maxTokens = getContextWindow(modelId) * windowFraction;
  const currentTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  const newTokens = estimateMessageTokens(newMessage);
  return currentTokens + newTokens > maxTokens;
}
