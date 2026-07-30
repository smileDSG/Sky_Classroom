/**
 * State Manager — Orchestrator State Definition and Management
 *
 * Defines the LangGraph state annotation and provides utilities
 * for building initial state, message trimming, and version control.
 */

import { Annotation } from '@langchain/langgraph';
import type { LanguageModel } from 'ai';

import type { StatelessChatRequest } from '@/lib/types/chat';
import type { ThinkingConfig } from '@/lib/types/provider';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { AgentTurnSummary, WhiteboardActionRecord } from './types';
import { COMPRESSION_TARGET } from './config';
import { compressMessageHistory } from './conversation-compression';

type MessageRole = 'user' | 'assistant' | 'system' | 'agent' | 'tool';
type MessageLike = { role: MessageRole; content?: unknown };

/**
 * LangGraph state annotation for the orchestration graph
 */
export const OrchestratorState = Annotation.Root({
  // Input (set once at graph entry)
  messages: Annotation<StatelessChatRequest['messages']>,
  storeState: Annotation<StatelessChatRequest['storeState']>,
  availableAgentIds: Annotation<string[]>,
  maxTurns: Annotation<number>,
  languageModel: Annotation<LanguageModel>,
  thinkingConfig: Annotation<ThinkingConfig | null>,
  discussionContext: Annotation<{ topic: string; prompt?: string } | null>,
  triggerAgentId: Annotation<string | null>,
  userProfile: Annotation<{ nickname?: string; bio?: string } | null>,
  /** Server-built learner teaching projection (authoritative) */
  teachingProjection: Annotation<string | null>,
  /** Request-scenced agent configs for generated agents (not in the default registry) */
  agentConfigOverrides: Annotation<Record<string, AgentConfig>>,

  // Mutable (updated by nodes)
  currentAgentId: Annotation<string | null>,
  turnCount: Annotation<number>,
  agentResponses: Annotation<AgentTurnSummary[]>({
    reducer: (prev, update) => [...prev, ...update],
    default: () => [],
  }),
  whiteboardLedger: Annotation<WhiteboardActionRecord[]>({
    reducer: (prev, update) => [...prev, ...update],
    default: () => [],
  }),
  shouldEnd: Annotation<boolean>,
  totalActions: Annotation<number>,
});

export type OrchestratorStateType = typeof OrchestratorState.State;

/**
 * Build initial state for the orchestration graph from a StatelessChatRequest
 * and a pre-created LanguageModel instance.
 */
export function buildInitialState(
  request: StatelessChatRequest,
  languageModel: LanguageModel,
  thinkingConfig?: ThinkingConfig,
): typeof OrchestratorState.State {
  // Build request-scoped agent config overrides for generated agents.
  const agentConfigOverrides: Record<string, AgentConfig> = {};
  if (request.config.agentConfigs?.length) {
    for (const cfg of request.config.agentConfigs) {
      agentConfigOverrides[cfg.id] = {
        ...cfg,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  const discussionContext = request.config.discussionTopic
    ? {
        topic: request.config.discussionTopic,
        prompt: request.config.discussionPrompt,
      }
    : null;

  const incoming = request.directorState;
  const turnCount = incoming?.turnCount ?? 0;

  return {
    messages: request.messages,
    storeState: request.storeState,
    availableAgentIds: request.config.agentIds,
    maxTurns: turnCount + 1,
    languageModel,
    thinkingConfig: thinkingConfig ?? null,
    discussionContext,
    triggerAgentId: request.config.triggerAgentId || null,
    userProfile: request.userProfile || null,
    teachingProjection: request.teachingProjection || null,
    agentConfigOverrides,
    currentAgentId: null,
    turnCount,
    agentResponses: incoming?.agentResponses ?? [],
    whiteboardLedger: incoming?.whiteboardLedger ?? [],
    shouldEnd: false,
    totalActions: 0,
  };
}

/**
 * Trim and compress message history when it grows too large.
 * Uses conversation summarization to keep context manageable.
 */
export function maybeCompressHistory(messages: MessageLike[]): MessageLike[] {
  if (messages.length <= COMPRESSION_TARGET) {
    return messages;
  }

  return compressMessageHistory(messages);
}

/**
 * Look up an agent config: request-scoped overrides first, then global registry.
 * Keeps the server stateless — generated agent configs travel with the request.
 */
export function resolveAgent(
  state: OrchestratorStateType,
  agentId: string,
): AgentConfig | undefined {
  return state.agentConfigOverrides[agentId] ?? useAgentRegistrySafe()?.getAgent(agentId);
}

/**
 * Lazy import of the agent registry to avoid circular dependencies.
 */
let registryCache: { getAgent: (id: string) => AgentConfig | undefined } | null = null;

function useAgentRegistrySafe() {
  if (!registryCache) {
    const { useAgentRegistry } = require('@/lib/orchestration/registry/store');
    registryCache = useAgentRegistry.getState();
  }
  return registryCache;
}
