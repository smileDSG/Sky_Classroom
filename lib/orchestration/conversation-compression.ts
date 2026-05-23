/**
 * Layered Conversation Compression
 *
 * Implements two-tier compression:
 * 1. Key information extraction — preserves questions, answers, decisions
 * 2. Sliding window — drops oldest messages beyond the window
 *
 * This replaces the naive string-slicing approach with adaptive
 * compression that understands conversation semantics.
 */

import { COMPRESSION_TARGET, COMPRESSION_MESSAGE_THRESHOLD } from './config';

type MessageRole = 'user' | 'assistant' | 'system' | 'agent' | 'tool';

interface MessageLike {
  role: MessageRole;
  content?: unknown;
}

interface ConversationMessage {
  role: MessageRole;
  content?: string | unknown;
  name?: string;
  metadata?: Record<string, unknown>;
}

interface KeyInfoResult {
  questions: string[];
  answers: string[];
  decisions: string[];
  topics: string[];
}

// ─── Key information extraction ───

function extractKeyInfo(messages: ConversationMessage[]): KeyInfoResult {
  const result: KeyInfoResult = {
    questions: [],
    answers: [],
    decisions: [],
    topics: [],
  };

  const questionKeywords = ['是什么', '为什么', '如何', '是否', 'what', 'why', 'how', '?'];
  const decisionKeywords = ['决定', '选择', '结论', '决定采用', 'decide', 'conclusion', 'agree'];

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';
    if (!content) continue;

    // Detect questions
    if (msg.role === 'user' && questionKeywords.some((kw) => content.includes(kw))) {
      result.questions.push(content.slice(0, 200));
    }

    // Detect answers (assistant responses after user questions)
    if (msg.role === 'assistant' && content.length > 50) {
      result.answers.push(content.slice(0, 300));
    }

    // Detect decisions/conclusions
    if (decisionKeywords.some((kw) => content.toLowerCase().includes(kw))) {
      result.decisions.push(content.slice(0, 200));
    }

    // Track topics from first messages
    if (result.topics.length < 5 && content.length > 20) {
      result.topics.push(content.slice(0, 100));
    }
  }

  return result;
}

function buildSummary(keyInfo: KeyInfoResult): string {
  const lines: string[] = ['[Conversation Summary]'];

  if (keyInfo.topics.length > 0) {
    lines.push(`Topics discussed: ${keyInfo.topics.join(' → ')}`);
  }
  if (keyInfo.questions.length > 0) {
    lines.push(`Key questions: ${keyInfo.questions.join('; ')}`);
  }
  if (keyInfo.answers.length > 0) {
    lines.push(`Key answers: ${keyInfo.answers.slice(0, 3).join('; ')}${keyInfo.answers.length > 3 ? '...' : ''}`);
  }
  if (keyInfo.decisions.length > 0) {
    lines.push(`Decisions: ${keyInfo.decisions.join('; ')}`);
  }

  return lines.join('\n');
}

// ─── Adaptive compression ───

/**
 * Estimate token count from message content.
 * Rough approximation: ~4 chars per token for English, ~1.5 for Chinese.
 */
function estimateTokens(content: string): number {
  const chineseChars = (content.match(/[一-鿿]/g) || []).length;
  const otherChars = content.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * Compress conversation history using layered approach:
 * 1. Extract key information (questions, answers, decisions)
 * 2. Build a compact summary of older messages
 * 3. Keep recent messages intact within the sliding window
 * 4. Respect token budget if provided
 */
export function compressConversation(
  messages: ConversationMessage[],
  options?: {
    maxMessages?: number;
    maxTokens?: number;
    preserveSystemMessages?: boolean;
  },
): ConversationMessage[] {
  const maxMessages = options?.maxMessages ?? COMPRESSION_TARGET;
  const maxTokens = options?.maxTokens ?? undefined;
  const preserveSystem = options?.preserveSystemMessages ?? true;

  // No compression needed
  if (messages.length <= COMPRESSION_MESSAGE_THRESHOLD) {
    return messages;
  }

  // Separate system messages
  const systemMessages = preserveSystem
    ? messages.filter((m) => m.role === 'system')
    : [];
  const nonSystemMessages = preserveSystem
    ? messages.filter((m) => m.role !== 'system')
    : messages;

  // Extract key information from older messages
  const messagesToSummarize = nonSystemMessages.slice(
    0,
    nonSystemMessages.length - maxMessages,
  );
  const keyInfo = extractKeyInfo(messagesToSummarize);
  const summary = buildSummary(keyInfo);

  // Create summary message
  const summaryMessage: ConversationMessage = {
    role: 'system',
    content: summary,
    name: 'compression',
    metadata: {
      compressedFrom: messagesToSummarize.length,
      keyInfo,
    },
  };

  // Keep recent messages
  const recentMessages = nonSystemMessages.slice(-maxMessages);

  let result = [...systemMessages, summaryMessage, ...recentMessages];

  // Apply token budget if specified
  if (maxTokens) {
    result = applyTokenBudget(result, maxTokens);
  }

  return result;
}

/**
 * Truncate messages to fit within a token budget.
 * Removes oldest non-system messages first.
 */
function applyTokenBudget(
  messages: ConversationMessage[],
  maxTokens: number,
): ConversationMessage[] {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  // Calculate system message token usage
  const systemTokens = systemMessages.reduce((sum, m) => {
    return sum + estimateTokens(typeof m.content === 'string' ? m.content : '');
  }, 0);

  let remainingTokens = maxTokens - systemTokens;
  const keptMessages: ConversationMessage[] = [];

  // Keep messages from newest to oldest until budget is exhausted
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msg = nonSystemMessages[i];
    const msgTokens = estimateTokens(typeof msg.content === 'string' ? msg.content : '');
    if (msgTokens <= remainingTokens) {
      keptMessages.unshift(msg);
      remainingTokens -= msgTokens;
    } else {
      break;
    }
  }

  return [...systemMessages, ...keptMessages];
}

export { estimateTokens, extractKeyInfo };

// ─── Backward-compatible alias ───

/** @deprecated Use `compressConversation` instead */
export function compressMessageHistory(messages: MessageLike[]): MessageLike[] {
  return compressConversation(messages as unknown as ConversationMessage[]);
}
