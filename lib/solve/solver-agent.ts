/**
 * Solver Agent Node — LLM-based problem solving.
 *
 * This node:
 * 1. Resolves the model based on agentRoute
 * 2. Builds the system prompt
 * 3. Calls the LLM via callLLM()
 * 4. Parses the JSON response
 * 5. Implements hybrid strategy: if confidence < 0.7, triggers fallback
 */

import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { SolveGraphState } from './solve-graph-state';
import type { SolverAgentType } from './types';
import type { ProviderId } from '@/lib/ai/providers';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { buildSolverPrompt } from './solver-prompts';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveGraph');

// ── Agent → provider/model mapping ───────────────────────────────

const AGENT_MODEL_MAP: Record<SolverAgentType, { providerId: ProviderId; modelId: string }> = {
  universal: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
  science: { providerId: 'qwen', modelId: 'qwen3.6-plus' },
  humanities: { providerId: 'qwen', modelId: 'qwen3.6-plus' },
  grading: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
};

const ENV_KEY_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  glm: 'GLM_API_KEY',
  qwen: 'QWEN_API_KEY',
};

const ENV_URL_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_BASE_URL',
  glm: 'GLM_BASE_URL',
  qwen: 'QWEN_BASE_URL',
};

/**
 * Parsed solution from LLM response.
 */
interface ParsedSolution {
  solution: string;
  answer: string;
  confidence: number;
  steps: { label: string; content: string; keyPoints?: string[] }[];
  knowledgePoints: { name: string; description: string; difficulty: 'easy' | 'medium' | 'hard' }[];
  similarQuestions: { problem: string; difficulty: number; knowledgePoint: string }[];
}

/**
 * Parse LLM response text into a structured solution.
 * Uses json-repair for resilient parsing.
 */
export function parseSolutionResponse(text: string): ParsedSolution | null {
  const parsed = parseJsonResponse<ParsedSolution>(text);
  if (!parsed) return null;
  if (!parsed.solution || !parsed.answer) return null;
  if (typeof parsed.confidence !== 'number') parsed.confidence = 0.5;
  return parsed;
}

/**
 * Resolve the ModelConfig for a given solver agent type.
 *
 * Agent type → provider/model mapping:
 *   universal   → deepseek / deepseek-v4-pro
 *   science     → glm / glm-5.1
 *   humanities  → qwen / qwen3.6-max-preview
 *   grading     → deepseek / deepseek-v4-pro
 *
 * API key and base URL come from environment variables.
 */
function resolveSolverModel(agentType: SolverAgentType): Parameters<typeof getModel>[0] {
  const { providerId, modelId } = AGENT_MODEL_MAP[agentType];
  const apiKey = process.env[ENV_KEY_MAP[providerId] ?? ''] ?? '';
  const baseUrl = process.env[ENV_URL_MAP[providerId] ?? ''];

  return {
    providerId,
    modelId,
    apiKey,
    baseUrl: baseUrl || undefined,
    providerType: 'openai',
  };
}

/**
 * Solve with a single agent (primary or fallback).
 */
async function solveOnce(
  agentType: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): Promise<ParsedSolution | null> {
  const modelConfig = resolveSolverModel(agentType);
  const modelWithInfo = getModel(modelConfig);

  const messages: Array<{ role: string; content: unknown }> = [
    {
      role: 'system',
      content: buildSolverPrompt(agentType, problemText, problemImage ?? undefined),
    },
  ];

  const result = await callLLM(
    {
      model: modelWithInfo.model,
      messages: messages as any,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
    'solve-agent',
    { retries: 1 },
  );

  return parseSolutionResponse(result.text);
}

/**
 * Hybrid strategy: primary agent first, fallback if confidence low.
 *
 * 1. Call primary agent
 * 2. If confidence >= 0.7, return immediately
 * 3. If confidence < 0.7, call secondary agent
 * 4. If secondary also low, try tertiary as last resort
 */
async function solveWithHybrid(
  primary: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): Promise<{ solution: ParsedSolution; usedAgents: SolverAgentType[] }> {
  const CONFIDENCE_THRESHOLD = 0.7;

  // Primary
  const primaryResult = await solveOnce(primary, problemText, problemImage);
  if (primaryResult && primaryResult.confidence >= CONFIDENCE_THRESHOLD) {
    return { solution: primaryResult, usedAgents: [primary] };
  }

  // Secondary fallback
  const fallbacks: SolverAgentType[] = (['science', 'humanities', 'universal'] as SolverAgentType[]).filter(
    (t) => t !== primary,
  );

  const secondaryResult = await solveOnce(fallbacks[0], problemText, problemImage);
  if (secondaryResult && secondaryResult.confidence >= CONFIDENCE_THRESHOLD) {
    return { solution: secondaryResult, usedAgents: [primary, fallbacks[0]] };
  }

  // Tertiary: last resort
  if (fallbacks.length > 1) {
    const tertiaryResult = await solveOnce(fallbacks[1], problemText, problemImage);
    if (tertiaryResult) {
      return { solution: tertiaryResult, usedAgents: [primary, fallbacks[0], fallbacks[1]] };
    }
  }

  // All failed or low confidence — return whatever we have, tracking all agents tried
  const calledAgents: SolverAgentType[] = fallbacks.length > 1
    ? [primary, fallbacks[0], fallbacks[1]]
    : [primary, fallbacks[0]];

  return {
    solution: primaryResult ?? secondaryResult ?? {
      solution: '',
      answer: '',
      confidence: 0,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    },
    usedAgents: calledAgents,
  };
}

/**
 * Solve agent node function.
 *
 * Input: problemText + agentRoute
 * Output: solution (or error)
 */
export async function solveWithAgentNode(
  state: SolveGraphState,
  _config: LangGraphRunnableConfig,
): Promise<Partial<SolveGraphState>> {
  const { problemText, problemImage, agentRoute } = state;

  if (!problemText) {
    log.error('[SolveGraph] solveWithAgentNode: empty problemText');
    return { error: 'Empty problem text' };
  }

  const agentType = agentRoute ?? 'universal';
  log.info(`[SolveGraph] Solving with agent: ${agentType}`);

  try {
    const { solution, usedAgents } = await solveWithHybrid(agentType, problemText, problemImage);

    return {
      solution: solution.solution,
      agentId: usedAgents[usedAgents.length - 1] ?? agentType,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[SolveGraph] solveWithAgentNode failed: ${message}`);
    return { error: message };
  }
}
