/**
 * Agent Node — Prompt Construction → LLM Call → JSON Parsing
 *
 * Handles generation for one agent, streaming events via config.writer().
 */

import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';

import { AISdkLangGraphAdapter } from './ai-sdk-adapter';
import type { StatelessEvent } from '@/lib/types/chat';
import type { OrchestratorStateType } from './state-manager';
import { resolveAgent } from './state-manager';
import { buildStructuredPrompt } from './prompt-builder';
import { getEffectiveActions } from './tool-schemas';
import { convertMessagesToOpenAI } from './summarizers/message-converter';
import { parseStructuredChunk, createParserState, finalizeParser } from './stateless-generate';
import type { AgentTurnSummary, WhiteboardActionRecord } from './types';
import { CONTENT_PREVIEW_MAX_LENGTH, EMPTY_HISTORY_PROMPT, AGENT_TURN_PROMPT } from './config';
import { createLogger } from '@/lib/logger';
import { getAgentMemory } from './agent-memory';

const log = createLogger('AgentNode');

export interface AgentGenerationResult {
  contentPreview: string;
  actionCount: number;
  whiteboardActions: WhiteboardActionRecord[];
}

/**
 * Run generation for one agent. Streams agent_start, text_delta,
 * action, and agent_end events via config.writer().
 */
export async function runAgentGeneration(
  state: OrchestratorStateType,
  agentId: string,
  config: LangGraphRunnableConfig,
): Promise<AgentGenerationResult> {
  const agentConfig = resolveAgent(state, agentId);
  if (!agentConfig) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const write = createSafeWriter(config);
  const messageId = `assistant-${agentId}-${Date.now()}`;

  write({
    type: 'agent_start',
    data: {
      messageId,
      agentId,
      agentName: agentConfig.name,
      agentAvatar: agentConfig.avatar,
      agentColor: agentConfig.color,
    },
  });

  // Compute effective actions: filter by scene type for defense-in-depth
  const currentScene = state.storeState.currentSceneId
    ? state.storeState.scenes.find((s) => s.id === state.storeState.currentSceneId)
    : undefined;
  const sceneType = currentScene?.type;
  const effectiveActions = getEffectiveActions(agentConfig.allowedActions, sceneType);

  // Enrich system prompt with agent memory
  const memory = getAgentMemory(state.agentResponses, agentId);
  const discussionContext = state.discussionContext || undefined;
  const systemPrompt = buildStructuredPrompt(
    agentConfig,
    state.storeState,
    discussionContext,
    state.whiteboardLedger,
    state.userProfile || undefined,
    state.agentResponses,
    memory,
    state.teachingProjection || undefined,
  );

  const openaiMessages = convertMessagesToOpenAI(state.messages, agentId);
  const adapter = new AISdkLangGraphAdapter(state.languageModel, state.thinkingConfig ?? undefined);

  const lcMessages = buildAgentMessages(openaiMessages, systemPrompt, agentId);
  const parserState = createParserState();

  const result = await streamAndParse(
    adapter,
    lcMessages,
    config,
    parserState,
    effectiveActions,
    agentConfig,
    agentId,
    messageId,
    write,
  );

  write({ type: 'agent_end', data: { messageId, agentId } });

  return result;
}

/**
 * Agent generate node — runs one agent, then loops back to director.
 */
export async function agentGenerateNode(
  state: OrchestratorStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<OrchestratorStateType>> {
  const agentId = state.currentAgentId;
  if (!agentId) {
    return { shouldEnd: true };
  }

  const agentConfig = resolveAgent(state, agentId);
  const result = await runAgentGeneration(state, agentId, config);

  if (!result.contentPreview && result.actionCount === 0) {
    log.warn(
      `[AgentGenerate] Agent "${agentConfig?.name || agentId}" produced empty response (no text, no actions)`,
    );
  }

  return {
    turnCount: state.turnCount + 1,
    totalActions: state.totalActions + result.actionCount,
    agentResponses: [
      {
        agentId,
        agentName: agentConfig?.name || agentId,
        contentPreview: result.contentPreview,
        actionCount: result.actionCount,
        whiteboardActions: result.whiteboardActions,
      },
    ],
    whiteboardLedger: result.whiteboardActions,
    currentAgentId: null,
  };
}

// ── Internal helpers ──

function createSafeWriter(config: LangGraphRunnableConfig) {
  const rawWrite = config.writer as ((chunk: StatelessEvent) => void) | undefined;
  return (chunk: StatelessEvent) => {
    try {
      rawWrite?.(chunk);
    } catch (e) {
      log.warn(`[AgentGenerate] write failed:`, e);
    }
  };
}

function buildAgentMessages(
  openaiMessages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  agentId: string,
): Array<SystemMessage | HumanMessage | AIMessage> {
  const messages = [
    new SystemMessage(systemPrompt),
    ...openaiMessages.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
  ];

  // Ensure the message list ends with a HumanMessage
  const lastMsg = messages[messages.length - 1];
  if (!messages.some((m) => m instanceof HumanMessage)) {
    messages.push(new HumanMessage(EMPTY_HISTORY_PROMPT));
  } else if (lastMsg instanceof AIMessage) {
    messages.push(new HumanMessage(AGENT_TURN_PROMPT));
  }

  // Highlight the latest student message so the AI answers the CURRENT question
  // Find the last HumanMessage and prepend a clear instruction
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] instanceof HumanMessage) {
      const content = (messages[i] as HumanMessage).content as string;
      if (content && !content.startsWith('[LATEST STUDENT MESSAGE')) {
        messages[i] = new HumanMessage(
          `[LATEST STUDENT MESSAGE — ANSWER THIS DIRECTLY]:\n${content}`,
        );
      }
      break;
    }
  }

  return messages;
}

async function streamAndParse(
  adapter: AISdkLangGraphAdapter,
  messages: Array<SystemMessage | HumanMessage | AIMessage>,
  config: LangGraphRunnableConfig,
  parserState: ReturnType<typeof createParserState>,
  effectiveActions: string[],
  agentConfig: { name: string },
  agentId: string,
  messageId: string,
  write: (chunk: StatelessEvent) => void,
): Promise<AgentGenerationResult> {
  let fullText = '';
  let actionCount = 0;
  const whiteboardActions: WhiteboardActionRecord[] = [];

  try {
    for await (const chunk of adapter.streamGenerate(messages, { signal: config.signal })) {
      if (chunk.type === 'delta') {
        const parseResult = parseStructuredChunk(chunk.content, parserState);

        if (parseResult.ordered.length > 0 || parseResult.textChunks.length > 0) {
          log.debug(
            `[AgentGenerate] Parse: ordered=${parseResult.ordered.length} (${parseResult.ordered.map((e) => e.type).join(',')}), textChunks=${parseResult.textChunks.length}, actions=${parseResult.actions.length}, done=${parseResult.isDone}`,
          );
        }

        let emittedTextCount = 0;
        for (const entry of parseResult.ordered) {
          if (entry.type === 'text') {
            const rawText = parseResult.textChunks[entry.index];
            if (!rawText) {
              log.warn(
                `[AgentGenerate] Ordered text entry index=${entry.index} but textChunks[${entry.index}] is empty`,
              );
              continue;
            }
            const text = rawText.replace(/^>+\s?/gm, '');
            if (!text) continue;
            fullText += text;
            write({ type: 'text_delta', data: { content: text, messageId } });
            emittedTextCount++;
          } else if (entry.type === 'action') {
            const ac = parseResult.actions[entry.index];
            if (!ac) continue;
            if (!effectiveActions.includes(ac.actionName)) {
              log.warn(
                `[AgentGenerate] Agent ${agentConfig.name} attempted disallowed action: ${ac.actionName}, skipping`,
              );
              continue;
            }
            actionCount++;
            if (ac.actionName.startsWith('wb_')) {
              whiteboardActions.push({
                actionName: ac.actionName as WhiteboardActionRecord['actionName'],
                agentId,
                agentName: agentConfig.name,
                params: ac.params,
              });
            }
            write({
              type: 'action',
              data: {
                actionId: ac.actionId,
                actionName: ac.actionName,
                params: ac.params,
                agentId,
                messageId,
              },
            });
          }
        }

        // Emit trailing partial text deltas
        for (let i = emittedTextCount; i < parseResult.textChunks.length; i++) {
          const rawText = parseResult.textChunks[i];
          if (!rawText) continue;
          const text = rawText.replace(/^>+\s?/gm, '');
          if (!text) continue;
          fullText += text;
          write({ type: 'text_delta', data: { content: text, messageId } });
        }
      }
    }

    // Finalize: emit any remaining content
    const finalResult = finalizeParser(parserState);
    for (const entry of finalResult.ordered) {
      if (entry.type === 'text') {
        const rawText = finalResult.textChunks[entry.index];
        if (!rawText) continue;
        const text = rawText.replace(/^>+\s?/gm, '');
        if (!text) continue;
        fullText += text;
        write({ type: 'text_delta', data: { content: text, messageId } });
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    log.error(`[AgentGenerate] Error for ${agentConfig.name}:`, error);
    write({
      type: 'error',
      data: { message: error instanceof Error ? error.message : String(error) },
    });
  }

  return {
    contentPreview: fullText.slice(0, CONTENT_PREVIEW_MAX_LENGTH),
    actionCount,
    whiteboardActions,
  };
}
