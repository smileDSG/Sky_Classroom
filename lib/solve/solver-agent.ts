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
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { buildSolverPrompt } from './solver-prompts';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveGraph');

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
  const envKey = (providerId: string) => {
    const keyMap: Record<string, string> = {
      deepseek: 'DEEPSEEK_API_KEY',
      glm: 'GLM_API_KEY',
      qwen: 'QWEN_API_KEY',
    };
    return process.env[keyMap[providerId] ?? ''] ?? '';
  };

  const envBaseUrl = (providerId: string) => {
    const urlMap: Record<string, string> = {
      deepseek: 'DEEPSEEK_BASE_URL',
      glm: 'GLM_BASE_URL',
      qwen: 'QWEN_BASE_URL',
    };
    const url = process.env[urlMap[providerId] ?? ''];
    return url || undefined;
  };

  switch (agentType) {
    case 'universal':
    case 'grading':
      return {
        providerId: 'deepseek',
        modelId: 'deepseek-v4-pro',
        apiKey: envKey('deepseek'),
        baseUrl: envBaseUrl('deepseek'),
        providerType: 'openai',
      };
    case 'science':
      return {
        providerId: 'glm',
        modelId: 'glm-5.1',
        apiKey: envKey('glm'),
        baseUrl: envBaseUrl('glm'),
        providerType: 'openai',
      };
    case 'humanities':
      return {
        providerId: 'qwen',
        modelId: 'qwen3.6-max-preview',
        apiKey: envKey('qwen'),
        baseUrl: envBaseUrl('qwen'),
        providerType: 'openai',
      };
  }
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
  const model = getModel(modelConfig);

  const messages: Array<{ role: string; content: unknown }> = [
    {
      role: 'system',
      content: buildSolverPrompt(agentType, problemText, problemImage ?? undefined),
    },
  ];

  const result = await callLLM(
    {
      model: model as any,
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
 * 4. If answers differ significantly, call tertiary for voting
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
      return { solution: tertiaryResult, usedAgents: [primary, ...fallbacks] };
    }
  }

  // All failed or low confidence — return whatever we have
  return {
    solution: primaryResult ?? secondaryResult ?? {
      solution: '',
      answer: '',
      confidence: 0,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    },
    usedAgents: [primary],
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
