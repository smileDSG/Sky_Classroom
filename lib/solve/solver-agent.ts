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
import type { ProblemSpec, SolverAgentType } from './types';
import type { ProviderId } from '@/lib/ai/providers';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { buildSolverPrompt, buildKnowledgePointsPrompt } from './solver-prompts';
import { SOLVE_THINKING_CONFIG } from './solver-constants';
import { validateConfidence, MIN_VALIDATED_CONFIDENCE } from './confidence-validator';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveGraph');

// ── Agent → provider/model mapping ───────────────────────────────

const AGENT_MODEL_MAP: Record<SolverAgentType, { providerId: ProviderId; modelId: string }> = {
  universal: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
  science: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
  humanities: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
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
  questionType?: 'choice' | 'fill' | 'solve' | 'judge';
  options?: string[];
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
 *   universal   → deepseek / deepseek-v4-flash
 *   science     → glm / glm-5.1
 *   humanities  → qwen / qwen3.6-plus
 *   grading     → deepseek / deepseek-v4-flash
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
  problemSpec?: ProblemSpec | null,
  adaptiveGuidance?: string | null,
): Promise<ParsedSolution | null> {
  const modelConfig = resolveSolverModel(agentType);
  const modelWithInfo = getModel(modelConfig);

  const systemPrompt = buildSolverPrompt(
    agentType,
    problemText,
    problemImage ?? undefined,
    undefined,
    undefined,
    undefined,
    adaptiveGuidance
      ? {
          customInstructions: adaptiveGuidance,
          detailLevel: 'detailed',
          showStepByStep: true,
        }
      : undefined,
    problemSpec,
  );

  const result = await callLLM(
    {
      model: modelWithInfo.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: problemText }] as any,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
    'solve-agent',
    { retries: 1 },
    SOLVE_THINKING_CONFIG,
  );

  const parsed = parseSolutionResponse(result.text);
  if (parsed) return parsed;

  // DeepSeek (thinking off) occasionally answers in prose instead of the
  // requested JSON — salvage genuine prose so the solve still yields usable
  // content. JSON-shaped responses that failed validation (e.g. empty
  // solution fields) are NOT salvaged: returning null lets the hybrid
  // strategy try another agent instead of accepting a JSON string as the
  // solution. The confidence validator scores salvaged prose low, so it is
  // only accepted as a last resort by the tertiary agent. The answer field is
  // left empty so generateOutput extracts a concise answer from the prose.
  const text = result.text?.trim() ?? '';
  if (!text || text.startsWith('{') || text.startsWith('[') || /^```/.test(text)) {
    return null;
  }
  log.warn(
    `[SolveGraph] agent ${agentType} returned non-JSON answer; salvaging prose (${text.length} chars)`,
  );
  return {
    solution: text,
    answer: '',
    confidence: 0.4,
    steps: [],
    knowledgePoints: [],
    similarQuestions: [],
  };
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
  problemSpec?: ProblemSpec | null,
  adaptiveGuidance?: string | null,
): Promise<{ solution: ParsedSolution; usedAgents: SolverAgentType[] }> {
  // Primary
  const primaryResult = await solveOnce(
    primary,
    problemText,
    problemImage,
    problemSpec,
    adaptiveGuidance,
  );
  if (primaryResult) {
    const validated = validateConfidence(primaryResult, primary);
    if (validated >= MIN_VALIDATED_CONFIDENCE) {
      return { solution: primaryResult, usedAgents: [primary] };
    }
  }

  // Secondary fallback
  const fallbacks: SolverAgentType[] = (
    ['science', 'humanities', 'universal'] as SolverAgentType[]
  ).filter((t) => t !== primary);

  const secondaryResult = await solveOnce(
    fallbacks[0],
    problemText,
    problemImage,
    problemSpec,
    adaptiveGuidance,
  );
  if (secondaryResult) {
    const validated = validateConfidence(secondaryResult, fallbacks[0]);
    if (validated >= MIN_VALIDATED_CONFIDENCE) {
      return { solution: secondaryResult, usedAgents: [primary, fallbacks[0]] };
    }
  }

  // Tertiary: last resort — accept whatever we get
  if (fallbacks.length > 1) {
    const tertiaryResult = await solveOnce(
      fallbacks[1],
      problemText,
      problemImage,
      problemSpec,
      adaptiveGuidance,
    );
    if (tertiaryResult) {
      return { solution: tertiaryResult, usedAgents: [primary, fallbacks[0], fallbacks[1]] };
    }
  }

  // All failed — return whatever we have
  const calledAgents: SolverAgentType[] =
    fallbacks.length > 1 ? [primary, fallbacks[0], fallbacks[1]] : [primary, fallbacks[0]];

  return {
    solution: primaryResult ??
      secondaryResult ?? {
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
 * Generate 2-4 knowledge points when the solver didn't return any.
 */
async function generateKnowledgePoints(
  problemText: string,
  solution: ParsedSolution,
): Promise<ParsedSolution['knowledgePoints']> {
  try {
    const modelWithInfo = getModel(resolveSolverModel('universal'));
    const result = await callLLM(
      {
        model: modelWithInfo.model,
        system: buildKnowledgePointsPrompt(
          problemText,
          solution.answer || solution.solution.slice(0, 300),
        ),
        messages: [{ role: 'user', content: '请生成知识点 JSON。' }] as any,
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
      'knowledge-points-gen',
      { retries: 0 },
      SOLVE_THINKING_CONFIG,
    );

    const parsed = parseJsonResponse<
      | { knowledgePoints?: { name?: unknown; description?: unknown; difficulty?: unknown }[] }
      | { name?: unknown }[]
    >(result.text || '');
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>)?.knowledgePoints)
        ? ((parsed as Record<string, unknown>).knowledgePoints as {
            name?: unknown;
            description?: unknown;
            difficulty?: unknown;
          }[])
        : null;
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (
          item,
        ): item is {
          name: string;
          description: string;
          difficulty: 'easy' | 'medium' | 'hard';
        } => {
          const rec = item as Record<string, unknown>;
          return typeof rec?.name === 'string' && rec.name.trim().length > 0;
        },
      )
      .map((item) => ({
        name: item.name,
        description: typeof item.description === 'string' ? item.description : '',
        difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty as string)
          ? (item.difficulty as 'easy' | 'medium' | 'hard')
          : 'medium',
      }));
  } catch (err) {
    log.warn(
      `[SolveGraph] knowledge-point generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/**
 * Generate 2 similar questions when the solver didn't return any.
 * The UI's 同类题 tab depends on these, so a missing array gets filled here.
 */
async function generateSimilarQuestions(
  problemText: string,
  solution: ParsedSolution,
): Promise<ParsedSolution['similarQuestions']> {
  try {
    const modelWithInfo = getModel(resolveSolverModel('universal'));
    const result = await callLLM(
      {
        model: modelWithInfo.model,
        system:
          '你是出题专家。基于原题、解答和知识点，出2道同类型的练习题（考查相同知识点、难度相近、不与原题重复）。\n' +
          '只返回 JSON 数组，不要任何其他文字：[{"problem":"题目内容（含LaTeX用$...$）","difficulty":3,"knowledgePoint":"考查的知识点"}]，difficulty为1-5的整数。',
        messages: [
          {
            role: 'user',
            content: `原题：${problemText}\n解答要点：${solution.solution.slice(0, 400)}`,
          },
        ] as any,
        temperature: 0.5,
        maxOutputTokens: 1024,
      },
      'similar-questions-gen',
      { retries: 0 },
      SOLVE_THINKING_CONFIG,
    );

    const parsed = parseJsonResponse<
      | { problem?: unknown; difficulty?: unknown; knowledgePoint?: unknown }[]
      | Record<string, unknown>
    >(result.text || '');
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>)?.questions)
        ? ((parsed as Record<string, unknown>).questions as {
            problem?: unknown;
            difficulty?: unknown;
            knowledgePoint?: unknown;
          }[])
        : null;
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (item): item is { problem: string; difficulty: number; knowledgePoint: string } =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).problem === 'string',
      )
      .map((item) => ({
        problem: item.problem,
        difficulty: typeof item.difficulty === 'number' ? item.difficulty : 3,
        knowledgePoint: typeof item.knowledgePoint === 'string' ? item.knowledgePoint : '',
      }));
  } catch (err) {
    log.warn(
      `[SolveGraph] similar-question generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
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
  const { problemText, problemImage, problemSpec, agentRoute } = state;

  if (!problemText) {
    log.error('[SolveGraph] solveWithAgentNode: empty problemText');
    return { error: 'Empty problem text' };
  }

  const agentType = agentRoute ?? 'universal';
  log.info(`[SolveGraph] Solving with agent: ${agentType}`);

  try {
    const { solution: parsed, usedAgents } = await solveWithHybrid(
      agentType,
      problemText,
      problemImage,
      problemSpec,
      state.adaptiveGuidance,
    );

    // 同类题/知识点 tab 必须有内容：先过滤模型返回的脏数据，仍为空时就地生成
    let similarQuestions = (parsed.similarQuestions ?? []).filter(
      (item) => item && typeof item.problem === 'string' && item.problem.trim().length > 0,
    );
    if (similarQuestions.length === 0) {
      similarQuestions = await generateSimilarQuestions(problemText, parsed);
    }

    let knowledgePoints = (parsed.knowledgePoints ?? []).filter(
      (k) => k && typeof k.name === 'string' && k.name.trim().length > 0,
    );
    if (knowledgePoints.length === 0) {
      knowledgePoints = await generateKnowledgePoints(problemText, parsed);
    }

    return {
      solution: parsed.solution,
      parsedAnswer: parsed.answer ?? null,
      parsedSteps: parsed.steps ?? [],
      parsedKnowledgePoints: knowledgePoints.map((k) => ({
        name: k.name,
        description: k.description,
        difficulty: k.difficulty,
      })),
      parsedSimilarQuestions: similarQuestions,
      questionType: parsed.questionType ?? null,
      options: parsed.options ?? null,
      agentId: usedAgents[usedAgents.length - 1] ?? agentType,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[SolveGraph] solveWithAgentNode failed: ${message}`);
    return { error: message };
  }
}
