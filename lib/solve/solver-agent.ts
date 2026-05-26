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
import { resolveSolverModel } from './solver-constants';
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

interface SolveOnceResult {
  parsed: ParsedSolution | null;
  rawText: string;
}

/**
 * Build a degraded ParsedSolution from raw LLM text when JSON parsing fails.
 * Uses the raw text as both solution and answer so the user still sees output.
 */
function rawAsSolution(rawText: string): ParsedSolution {
  const cleaned = rawText.trim();
  return {
    solution: cleaned,
    answer: cleaned,
    confidence: 0.2,
    steps: [],
    knowledgePoints: [],
    similarQuestions: [],
  };
}

/**
 * Solve with a single agent (primary or fallback).
 * Returns both the parsed result and the raw LLM text for fallback.
 */
async function solveOnce(
  agentType: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): Promise<SolveOnceResult> {
  const modelConfig = resolveSolverModel(agentType);
  const modelWithInfo = getModel(modelConfig);

  const systemPrompt = buildSolverPrompt(agentType, problemText, problemImage ?? undefined);

  const messages: Array<{ role: string; content: unknown }> = [
    {
      role: 'user',
      content: problemText,
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
    undefined,
    systemPrompt,
  );

  const rawText = result.text || '';
  const parsed = parseSolutionResponse(rawText);
  if (!parsed) {
    log.warn(`[SolveGraph] ${agentType} returned non-JSON, using raw text fallback (${rawText.length} chars)`);
  }
  return { parsed, rawText };
}

/**
 * Hybrid strategy: run primary + secondary in parallel.
 *
 * 1. Fire primary and first fallback concurrently
 * 2. If primary confidence >= 0.7, return immediately
 * 3. If secondary confidence >= 0.7, use it
 * 4. Otherwise try tertiary as last resort
 *
 * This cuts worst-case latency from 3 serial calls to 2 serial rounds.
 */
async function solveWithHybrid(
  primary: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): Promise<{ solution: ParsedSolution; usedAgents: SolverAgentType[] }> {
  const CONFIDENCE_THRESHOLD = 0.7;
  const fallbacks: SolverAgentType[] = (['science', 'humanities', 'universal'] as SolverAgentType[]).filter(
    (t) => t !== primary,
  );

  // Run primary and first fallback in parallel
  const [primaryResult, secondaryResult] = await Promise.all([
    solveOnce(primary, problemText, problemImage),
    solveOnce(fallbacks[0], problemText, problemImage),
  ]);

  if (primaryResult.parsed && primaryResult.parsed.confidence >= CONFIDENCE_THRESHOLD) {
    return { solution: primaryResult.parsed, usedAgents: [primary] };
  }

  if (secondaryResult.parsed && secondaryResult.parsed.confidence >= CONFIDENCE_THRESHOLD) {
    return { solution: secondaryResult.parsed, usedAgents: [primary, fallbacks[0]] };
  }

  // Both low confidence — try tertiary
  if (fallbacks.length > 1) {
    const tertiaryResult = await solveOnce(fallbacks[1], problemText, problemImage);
    if (tertiaryResult.parsed && tertiaryResult.parsed.confidence >= CONFIDENCE_THRESHOLD) {
      return { solution: tertiaryResult.parsed, usedAgents: [primary, fallbacks[0], fallbacks[1]] };
    }

    // Pick best by confidence across all three
    const best = [primaryResult, secondaryResult, tertiaryResult]
      .filter((r) => r.parsed)
      .sort((a, b) => (b.parsed!.confidence) - (a.parsed!.confidence));
    if (best[0]?.parsed) {
      return { solution: best[0].parsed, usedAgents: [primary, fallbacks[0], fallbacks[1]] };
    }
  }

  // All JSON parsing failed — fall back to best raw text
  const best = [primaryResult, secondaryResult]
    .filter((r) => r.parsed)
    .sort((a, b) => (b.parsed!.confidence) - (a.parsed!.confidence));

  const fallbackSolution =
    best[0]?.parsed ??
    rawAsSolution(primaryResult.rawText || secondaryResult.rawText || '');

  log.warn(`[SolveGraph] Fallback used, conf=${fallbackSolution.confidence}`);

  return {
    solution: fallbackSolution,
    usedAgents: fallbacks.length > 1 ? [primary, fallbacks[0], fallbacks[1]] : [primary, fallbacks[0]],
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
