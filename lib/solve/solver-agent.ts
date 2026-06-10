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
import { validateConfidence, MIN_VALIDATED_CONFIDENCE } from './confidence-validator';
import {
  AGENT_MODEL_MAP,
  ENV_KEY_MAP,
  ENV_URL_MAP,
  VISION_MODELS,
  resolveSolverModel,
} from './solver-constants';
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
 * Solve with a single agent (primary or fallback).
 */
async function solveOnce(
  agentType: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): Promise<ParsedSolution | null> {
  const t0 = Date.now();
  // Only use image if a vision model is actually available
  const visionAvailable = VISION_MODELS.some((vm) => !!process.env[ENV_KEY_MAP[vm.providerId]]);
  const hasImage = !!problemImage && visionAvailable;
  const modelConfig = resolveSolverModel(agentType, hasImage);
  const modelWithInfo = getModel(modelConfig);

  const systemPrompt = buildSolverPrompt(agentType, problemText, problemImage ?? undefined);

  // Build multimodal message: image + text when image is available
  const userContent: any[] = [];
  if (problemImage) {
    userContent.push({ type: 'image', image: problemImage });
  }
  userContent.push({ type: 'text', text: problemText });

  const result = await callLLM(
    {
      model: modelWithInfo.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: hasImage ? userContent : problemText }] as any,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
    'solve-agent',
    { retries: 1, timeoutMs: 60_000 },
  );

  let parsed = parseSolutionResponse(result.text);
  log.info(`[SolveAgent] ${agentType} LLM call took ${Date.now() - t0}ms, parsed=${!!parsed}`);

  // Re-prompt with strict JSON constraint if parse failed
  if (!parsed) {
    log.warn('[SolveAgent] Initial parse failed, re-prompting with strict JSON prompt');
    const t1 = Date.now();

    const strictSystemPrompt = `${systemPrompt}

【重要】你的回答必须是纯 JSON 对象，不要任何代码块标记（\`\`\`）、解释文字或问候语。
JSON 必须包含：solution（字符串）、answer（字符串）、steps（数组）、knowledgePoints（数组）、similarQuestions（数组）。`;

    const strictResult = await callLLM(
      {
        model: modelWithInfo.model,
        system: strictSystemPrompt,
        messages: [{ role: 'user', content: hasImage ? userContent : problemText }] as any,
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
      'solve-agent-strict',
      { retries: 0, timeoutMs: 45_000 },
    );

    parsed = parseSolutionResponse(strictResult.text);
    log.info(
      `[SolveAgent] ${agentType} strict re-prompt took ${Date.now() - t1}ms, parsed=${!!parsed}`,
    );
    if (!parsed) {
      log.warn('[SolveAgent] Strict re-prompt also failed, returning null');
    }
  }

  return parsed;
}

/**
 * Hybrid strategy: primary agent first, fallback if validated confidence low.
 *
 * Uses post-hoc confidence validation (not self-reported LLM score).
 * Threshold: 0.55 — lower than the old 0.70 because validated scores are more reliable.
 *
 * 1. Call primary agent
 * 2. If validated confidence >= 0.55, return immediately
 * 3. If low, call secondary agent
 * 4. If secondary also low, try tertiary as last resort
 */
export async function solveWithHybrid(
  primary: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): Promise<{ solution: ParsedSolution; usedAgents: SolverAgentType[] }> {
  const t0 = Date.now();
  // Primary
  const primaryResult = await solveOnce(primary, problemText, problemImage);
  if (primaryResult) {
    const validated = validateConfidence(primaryResult, primary);
    log.info(
      `[SolveAgent] Primary (${primary}): confidence=${validated.toFixed(2)}, took ${Date.now() - t0}ms`,
    );
    if (validated >= MIN_VALIDATED_CONFIDENCE) {
      return { solution: primaryResult, usedAgents: [primary] };
    }
  }

  // Secondary fallback — only include providers with configured API keys
  const allTypes: SolverAgentType[] = ['science', 'humanities', 'universal'];
  const configuredFallbacks = allTypes.filter((t): t is SolverAgentType => {
    if (t === primary) return false;
    const { providerId } = AGENT_MODEL_MAP[t];
    const key = process.env[ENV_KEY_MAP[providerId] ?? ''] ?? '';
    return key.length > 0;
  });
  const fallbacks: SolverAgentType[] =
    configuredFallbacks.length > 0
      ? configuredFallbacks
      : (['universal'] as SolverAgentType[]).filter((t) => t !== primary);

  let secondaryResult: ParsedSolution | null = null;
  if (fallbacks.length > 0) {
    secondaryResult = await solveOnce(fallbacks[0], problemText, problemImage);
    if (secondaryResult) {
      const validated = validateConfidence(secondaryResult, fallbacks[0]);
      if (validated >= MIN_VALIDATED_CONFIDENCE) {
        return { solution: secondaryResult, usedAgents: [primary, fallbacks[0]] };
      }
    }

    // Tertiary: last resort — still validate, pick best of all three
    if (fallbacks.length > 1) {
      const tertiaryResult = await solveOnce(fallbacks[1], problemText, problemImage);
      if (tertiaryResult) {
        const validated = validateConfidence(tertiaryResult, fallbacks[1]);
        if (validated >= MIN_VALIDATED_CONFIDENCE) {
          return { solution: tertiaryResult, usedAgents: [primary, fallbacks[0], fallbacks[1]] };
        }
      }
      // All three below threshold — return the one with highest validated confidence
      const results = [
        { result: primaryResult, agent: primary },
        { result: secondaryResult, agent: fallbacks[0] },
        { result: tertiaryResult, agent: fallbacks[1] },
      ]
        .filter((r) => r.result !== null)
        .map((r) => ({
          result: r.result!,
          agent: r.agent,
          score: validateConfidence(r.result!, r.agent),
        }))
        .sort((a, b) => b.score - a.score);

      if (results.length > 0) {
        return { solution: results[0].result, usedAgents: results.map((r) => r.agent) };
      }
    }
  }

  // All failed — return the one with highest validated confidence
  const results = [
    { result: primaryResult, agent: primary },
    { result: secondaryResult, agent: fallbacks[0] },
    { result: fallbacks.length > 1 ? null : undefined, agent: fallbacks[1] ?? primary },
  ]
    .filter((r) => r.result !== null && r.result !== undefined)
    .map((r) => ({
      result: r.result!,
      agent: r.agent,
      score: validateConfidence(r.result!, r.agent),
    }))
    .sort((a, b) => b.score - a.score);

  if (results.length > 0) {
    return { solution: results[0].result, usedAgents: results.map((r) => r.agent) };
  }

  // Truly nothing — return empty solution
  return {
    solution: {
      solution: '',
      answer: '',
      confidence: 0,
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    },
    usedAgents: [primary, fallbacks[0], ...(fallbacks.length > 1 ? [fallbacks[1]] : [])],
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
    const t0 = Date.now();
    // Don't pass problemImage to solve — OCR already extracted the text.
    // Passing image forces vision models which are slower and may timeout.
    const { solution, usedAgents } = await solveWithHybrid(agentType, problemText, null);
    log.info(
      `[SolveGraph] solveWithAgentNode completed in ${Date.now() - t0}ms, agents=${usedAgents.join(',')}`,
    );

    return {
      solution: solution.solution,
      parsedSteps: solution.steps ?? [],
      parsedKnowledgePoints: (solution.knowledgePoints ?? []).map((k) => ({
        name: k.name,
        description: k.description,
        difficulty: k.difficulty,
      })),
      parsedSimilarQuestions: solution.similarQuestions ?? [],
      agentId: usedAgents[usedAgents.length - 1] ?? agentType,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[SolveGraph] solveWithAgentNode failed: ${message}`);
    return { error: message };
  }
}
