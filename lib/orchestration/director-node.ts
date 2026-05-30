/**
 * Director Node — LLM Routing + Rule Engine
 *
 * Unified director: decides which agent speaks next.
 * Strategy varies by agent count:
 *   Single agent — pure code logic, zero LLM calls
 *   Multi agent — LLM-based with code fast-paths
 */

import { END } from '@langchain/langgraph';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';

import { AISdkLangGraphAdapter } from './ai-sdk-adapter';
import type { StatelessEvent } from '@/lib/types/chat';
import type { OrchestratorStateType } from './state-manager';
import { resolveAgent } from './state-manager';
import { buildDirectorPrompt, parseDirectorDecision } from './director-prompt';
import { convertMessagesToOpenAI } from './summarizers/message-converter';
import { summarizeConversation } from './summarizers/conversation-summary';
import { createLogger } from '@/lib/logger';

const log = createLogger('DirectorNode');

/**
 * Unified director: decides which agent speaks next.
 */
export async function directorNode(
  state: OrchestratorStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<OrchestratorStateType>> {
  const write = createSafeWriter(config);
  const isSingleAgent = state.availableAgentIds.length <= 1;

  // Turn limit check
  if (state.turnCount >= state.maxTurns) {
    log.info(`[Director] Turn limit reached (${state.turnCount}/${state.maxTurns}), ending`);
    return { shouldEnd: true };
  }

  // Single agent: code-only director
  if (isSingleAgent) {
    return handleSingleAgent(state, write);
  }

  // Multi agent: fast-path when triggerAgentId is set (user initiated Q&A)
  if (state.triggerAgentId) {
    const triggerId = state.triggerAgentId;
    if (state.availableAgentIds.includes(triggerId)) {
      log.info(`[Director] User triggered: dispatching agent "${triggerId}"`);
      write({ type: 'thinking', data: { stage: 'agent_loading', agentId: triggerId } });
      return { currentAgentId: triggerId, shouldEnd: false };
    }
    log.warn(
      `[Director] Trigger agent "${triggerId}" not in available agents, falling through to LLM`,
    );
  }

  // Multi agent: LLM-based decision
  return handleMultiAgent(state, config, write);
}

export function directorCondition(state: OrchestratorStateType): 'agent_generate' | typeof END {
  return state.shouldEnd ? END : 'agent_generate';
}

// ── Internal helpers ──

function createSafeWriter(config: LangGraphRunnableConfig) {
  const rawWrite = config.writer as ((chunk: StatelessEvent) => void) | undefined;
  return (chunk: StatelessEvent) => {
    try {
      rawWrite?.(chunk);
    } catch {
      /* controller closed after abort */
    }
  };
}

function handleSingleAgent(
  state: OrchestratorStateType,
  write: (chunk: StatelessEvent) => void,
): Partial<OrchestratorStateType> {
  const agentId = state.availableAgentIds[0] || 'default-1';

  if (state.turnCount === 0) {
    log.info(`[Director] Single agent: dispatching "${agentId}"`);
    write({ type: 'thinking', data: { stage: 'agent_loading', agentId } });
    return { currentAgentId: agentId, shouldEnd: false };
  }

  log.info(`[Director] Single agent: cueing user after "${agentId}"`);
  write({ type: 'cue_user', data: { fromAgentId: agentId } });
  return { shouldEnd: true };
}

async function handleMultiAgent(
  state: OrchestratorStateType,
  config: LangGraphRunnableConfig,
  write: (chunk: StatelessEvent) => void,
): Promise<Partial<OrchestratorStateType>> {
  const agents = state.availableAgentIds
    .map((id) => resolveAgent(state, id))
    .filter((a): a is NonNullable<typeof a> => a != null);

  if (agents.length === 0) {
    return { shouldEnd: true };
  }

  write({ type: 'thinking', data: { stage: 'director' } });

  const openaiMessages = convertMessagesToOpenAI(state.messages);
  const conversationSummary = summarizeConversation(openaiMessages);

  const prompt = buildDirectorPrompt(
    agents,
    conversationSummary,
    state.agentResponses,
    state.turnCount,
    state.discussionContext,
    state.triggerAgentId,
    state.whiteboardLedger,
    state.userProfile || undefined,
    state.storeState.whiteboardOpen,
  );

  const adapter = new AISdkLangGraphAdapter(state.languageModel, state.thinkingConfig ?? undefined);

  try {
    const result = await adapter._generate(
      [new SystemMessage(prompt), new HumanMessage('Decide which agent should speak next.')],
      { signal: config.signal } as Record<string, unknown>,
    );

    const content = result.generations[0]?.text || '';
    log.info(`[Director] Raw decision: ${content}`);

    const decision = parseDirectorDecision(content);

    if (decision.shouldEnd || !decision.nextAgentId) {
      return { shouldEnd: true };
    }

    if (decision.nextAgentId === 'USER') {
      write({ type: 'cue_user', data: { fromAgentId: state.currentAgentId || undefined } });
      return { shouldEnd: true };
    }

    if (!agents.some((a) => a.id === decision.nextAgentId)) {
      log.warn(`[Director] Unknown agent "${decision.nextAgentId}", ending`);
      return { shouldEnd: true };
    }

    write({ type: 'thinking', data: { stage: 'agent_loading', agentId: decision.nextAgentId } });
    log.info(`[Director] Decision: dispatch agent "${decision.nextAgentId}"`);
    return { currentAgentId: decision.nextAgentId, shouldEnd: false };
  } catch (error) {
    log.error('[Director] Error:', error);
    return { shouldEnd: true };
  }
}
