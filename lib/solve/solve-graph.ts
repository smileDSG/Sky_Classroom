/**
 * Solve Graph — LangGraph StateGraph for the solve pipeline.
 *
 * Topology:
 *   START → checkSolveCache → checkQuestionBank → routeToAgent → solveWithAgent → gradeAnswer → generateOutput → END
 *                │(hit)            │(hit)
 *                └─────────────────┴─────────────────────────────────────────────┘
 *
 * Nodes:
 *   - checkSolveCache: Look up in solve cache (near-match, threshold 0.70)
 *   - checkQuestionBank: Look up in question bank cache (exact match, threshold 0.85)
 *   - routeToAgent: Classify problem type and select agent
 *   - solveWithAgent: Call LLM to solve (imported from solver-agent.ts)
 *   - gradeAnswer: Compare user answer with solution (if provided)
 *   - generateOutput: Format as four-part output
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { SolveGraphAnnotation, type SolveGraphState } from './solve-graph-state';
import { solveWithAgentNode } from './solver-agent';
import type { FourPartOutput, ProblemSpec } from './types';
import { classifyProblem } from './solver-constants';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveGraph');

// ── Node implementations ──

/**
 * checkSolveCache node.
 *
 * Looks up the problem in the solve cache (lower threshold 0.70).
 * If found, returns the cached solution and skips to generateOutput.
 */
async function checkSolveCacheNode(
  state: SolveGraphState,
  _config: LangGraphRunnableConfig,
): Promise<Partial<SolveGraphState>> {
  const t0 = Date.now();
  const { findSolveCacheMatches } = await import('./solve-cache');
  const matches = await findSolveCacheMatches(state.problemText, 0.7);

  if (matches.length > 0) {
    log.info(`[SolveGraph] checkSolveCache: hit in ${Date.now() - t0}ms`);
    const hit = matches[0];
    return {
      fromSolveCache: true,
      solution: hit.solution,
      parsedAnswer: hit.answer ?? null,
      agentId: hit.agentId,
      // Cache entries store the full structured solve output, so hits render
      // the same report (steps / knowledge points / similar) as fresh solves.
      parsedSteps: hit.steps ?? [],
      parsedKnowledgePoints: hit.knowledgePoints ?? [],
      parsedSimilarQuestions: hit.similarQuestions ?? [],
    };
  }

  log.info(`[SolveGraph] checkSolveCache: miss in ${Date.now() - t0}ms`);
  return { fromSolveCache: false };
}

/**
 * checkQuestionBank node.
 *
 * Looks up the problem in the question bank. If found, returns
 * the cached solution and skips to generateOutput.
 */
async function checkQuestionBankNode(
  state: SolveGraphState,
  _config: LangGraphRunnableConfig,
): Promise<Partial<SolveGraphState>> {
  const t0 = Date.now();
  const { findSimilarQuestions } = await import('./question-bank');
  const matches = await findSimilarQuestions(state.problemText, 0.85);

  if (matches.length > 0) {
    log.info(
      `[SolveGraph] checkQuestionBank: hit in ${Date.now() - t0}ms (similarity=${matches[0]._similarity?.toFixed(2)})`,
    );
    const hit = matches[0];
    return {
      fromQuestionBank: true,
      solution: hit.answer,
      parsedAnswer: hit.answer ?? null,
      agentId: hit.agentId,
      parsedSteps: hit.steps ?? [],
      parsedKnowledgePoints: (hit.knowledgePoints ?? []).map((k) => ({
        name: k.name,
        description: k.description,
        difficulty: k.difficulty,
      })),
      parsedSimilarQuestions: hit.similarQuestions ?? [],
      questionType: hit.questionType ?? null,
      options: hit.options ?? null,
    };
  }

  log.info(`[SolveGraph] checkQuestionBank: miss in ${Date.now() - t0}ms`);
  return { fromQuestionBank: false };
}

/**
 * routeToAgent node.
 *
 * Classifies the problem and selects the appropriate agent type.
 * Uses keyword heuristics for now (rule-based routing).
 * Can be enhanced with LLM-based classification later.
 *
 * Science keywords: 物理, 化学, 数学, 力学, 微积分, 代数, 几何, 方程, 计算, 求解, 证明
 * Humanities keywords: 语文, 历史, 政治, 地理, 文学, 作文, 阅读, 分析, 论述, 谈谈
 */
async function routeToAgentNode(
  state: SolveGraphState,
  _config: LangGraphRunnableConfig,
): Promise<Partial<SolveGraphState>> {
  const route = classifyProblem(state.problemText, state.problemSpec);
  log.info(`[SolveGraph] routeToAgent: ${route}`);
  return { agentRoute: route };
}

/**
 * gradeAnswer node.
 *
 * If userAnswer is provided, compare with the solution using the grader
 * engine. Otherwise, skip grading.
 */
async function gradeAnswerNode(
  state: SolveGraphState,
  _config: LangGraphRunnableConfig,
): Promise<Partial<SolveGraphState>> {
  const { userAnswer, solution } = state;

  if (!userAnswer) {
    log.info('[SolveGraph] gradeAnswer: no user answer, skipping');
    return {};
  }

  if (!solution) {
    log.warn('[SolveGraph] gradeAnswer: no solution to compare against');
    return { error: 'No solution available for grading' };
  }

  const { gradeAnswer: gradeFn } = await import('./grader');
  const gradeResult = await gradeFn(state.problemText, solution, userAnswer);

  log.info(
    `[SolveGraph] gradeAnswer: isCorrect=${gradeResult.isCorrect}, score=${gradeResult.score}`,
  );

  return { gradeResult };
}

/**
 * Extract a concise answer from a full solution string.
 * Looks for answer markers ("答案是", "所以", etc.) and extracts the trailing text.
 * Falls back to the last sentence if no marker found.
 */
function extractConciseAnswer(solution: string): string {
  const answerMarkers = [
    /答案[是为：:]\s*([^\n。]{1,80})/,
    /故[为是]?\s*([^\n。]{1,80})$/,
    /因此(?:可得)?\s*([^\n。]{1,80})$/,
    /所以(?:有)?\s*([^\n。]{1,80})$/,
    /最终结果[是为：:]?\s*([^\n。]{1,80})/,
    /解[为得：:]\s*([^\n。]{1,80})/,
  ];

  for (const marker of answerMarkers) {
    const match = solution.match(marker);
    const candidate = match?.[1]?.trim();
    // Skip degenerate matches (single characters, pure punctuation) and fall
    // through to the last-sentence fallback which is more readable.
    if (candidate && candidate.length >= 2) {
      return candidate;
    }
  }

  // Fallback: last sentence
  const sentences = solution.split(/[。！？\n]+/).filter((s) => s.trim());
  if (sentences.length > 0) {
    return sentences[sentences.length - 1].trim();
  }
  return solution;
}

/**
 * generateOutput node.
 *
 * Format the solution into a FourPartOutput structure using the
 * four-part-output generator. If grading was done, include grade
 * result and mistake analysis.
 */
async function generateOutputNode(
  state: SolveGraphState,
  _config: LangGraphRunnableConfig,
): Promise<Partial<SolveGraphState>> {
  const { solution } = state;

  if (!solution) {
    log.error('[SolveGraph] generateOutput: no solution');
    // Return an error state (not a sentinel output) so the job runner marks
    // the job failed and never persists the failure into the question bank
    // or solve cache, where it would poison later cache hits.
    return {
      error: '未能生成解题结果，请稍后重试',
    };
  }

  // Build raw solution object from solver output.
  // The model's own concise answer (e.g. "A" / "轨迹a") is the answer banner;
  // fall back to derivation-based extraction when absent (cache hits from
  // older entries, or salvaged prose).
  const hasSteps = state.parsedSteps && state.parsedSteps.length > 0;
  const conciseAnswer =
    state.parsedAnswer?.trim() || (hasSteps ? solution : extractConciseAnswer(solution));

  const raw = {
    answer: conciseAnswer,
    solution,
    steps: state.parsedSteps ?? [],
    knowledgePoints: (state.parsedKnowledgePoints ?? []).map((k) => ({
      name: k.name,
      description: k.description,
      difficulty: k.difficulty as 'easy' | 'medium' | 'hard',
    })),
    similarQuestions: state.parsedSimilarQuestions ?? [],
    questionType: state.questionType ?? undefined,
    options: state.options ?? undefined,
  };

  let fourPartOutput: FourPartOutput;

  // If grading was done, produce graded output with mistake analysis
  if (state.gradeResult && !state.gradeResult.isCorrect) {
    const { generateGradedFourPartOutput } = await import('./four-part-output');
    fourPartOutput = generateGradedFourPartOutput(raw, state.gradeResult);
  } else {
    const { generateFourPartOutput } = await import('./four-part-output');
    fourPartOutput = generateFourPartOutput(raw);
  }

  log.info('[SolveGraph] generateOutput: done');
  return { fourPartOutput };
}

// ── Conditional edges ──

/**
 * After checkSolveCache: if hit, skip to generateOutput.
 */
export function afterCheckSolveCache(
  state: SolveGraphState,
): 'checkQuestionBank' | 'generateOutput' {
  return state.fromSolveCache ? 'generateOutput' : 'checkQuestionBank';
}

/**
 * After checkQuestionBank: if hit, skip to generateOutput.
 */
export function afterCheckBank(state: SolveGraphState): 'routeToAgent' | 'generateOutput' {
  return state.fromQuestionBank ? 'generateOutput' : 'routeToAgent';
}

/**
 * After solveWithAgent: if error, skip grading and go to generateOutput.
 */
export function afterSolve(state: SolveGraphState): 'gradeAnswer' | 'generateOutput' {
  return state.error ? 'generateOutput' : 'gradeAnswer';
}

// ── Graph factory ──

/**
 * Create the compiled SolveGraph.
 */
export function createSolveGraph() {
  const graph = new StateGraph(SolveGraphAnnotation)
    .addNode('checkSolveCache', checkSolveCacheNode)
    .addNode('checkQuestionBank', checkQuestionBankNode)
    .addNode('routeToAgent', routeToAgentNode)
    .addNode('solveWithAgent', solveWithAgentNode)
    .addNode('gradeAnswer', gradeAnswerNode)
    .addNode('generateOutput', generateOutputNode)
    .addEdge(START, 'checkSolveCache')
    .addConditionalEdges('checkSolveCache', afterCheckSolveCache, {
      checkQuestionBank: 'checkQuestionBank',
      generateOutput: 'generateOutput',
    })
    .addConditionalEdges('checkQuestionBank', afterCheckBank, {
      routeToAgent: 'routeToAgent',
      generateOutput: 'generateOutput',
    })
    .addEdge('routeToAgent', 'solveWithAgent')
    .addConditionalEdges('solveWithAgent', afterSolve, {
      gradeAnswer: 'gradeAnswer',
      generateOutput: 'generateOutput',
    })
    .addEdge('gradeAnswer', 'generateOutput')
    .addEdge('generateOutput', END);

  return graph.compile();
}

/**
 * Build initial state for a solve request.
 */
export function buildSolveInitialState(
  problemText: string,
  problemImage?: string | null,
  userAnswer?: string | null,
  problemSpec?: ProblemSpec | null,
  adaptiveGuidance?: string | null,
): SolveGraphState {
  return {
    problemText,
    problemImage: problemImage ?? null,
    problemSpec: problemSpec ?? null,
    userAnswer: userAnswer ?? null,
    adaptiveGuidance: adaptiveGuidance ?? null,
    agentId: 'universal',
    selectedAgentId: null,
    agentRoute: null,
    solution: null,
    parsedAnswer: null,
    parsedSteps: [],
    parsedKnowledgePoints: [],
    parsedSimilarQuestions: [],
    questionType: null,
    options: null,
    gradeResult: null,
    votingResults: [],
    fourPartOutput: null,
    fromQuestionBank: false,
    fromSolveCache: false,
    error: null,
  };
}
