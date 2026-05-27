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
import type { FourPartOutput } from './types';
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
  const { findSolveCacheMatches } = await import('./solve-cache');
  const matches = await findSolveCacheMatches(state.problemText, 0.70);

  if (matches.length > 0) {
    log.info(`[SolveGraph] checkSolveCache: hit (similarity=${matches[0] ? 'found' : 'none'})`);
    const hit = matches[0];
    return {
      fromSolveCache: true,
      solution: hit.solution,
      agentId: hit.agentId,
      parsedSteps: [],
      parsedKnowledgePoints: [],
      parsedSimilarQuestions: [],
    };
  }

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
  const { findSimilarQuestions } = await import('./question-bank');
  const matches = await findSimilarQuestions(state.problemText, 0.85);

  if (matches.length > 0) {
    log.info(`[SolveGraph] checkQuestionBank: hit (similarity=${matches[0]._similarity?.toFixed(2)})`);
    const hit = matches[0];
    return {
      fromQuestionBank: true,
      solution: hit.answer,
      agentId: hit.agentId,
      parsedSteps: hit.steps ?? [],
      parsedKnowledgePoints: (hit.knowledgePoints ?? []).map((k) => ({
        name: k.name,
        description: k.description,
        difficulty: k.difficulty,
      })),
      parsedSimilarQuestions: hit.similarQuestions ?? [],
    };
  }

  log.info('[SolveGraph] checkQuestionBank: miss');
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
  const { problemText } = state;

  const scienceKeywords = ['物理', '化学', '数学', '力学', '微积分', '代数', '几何', '方程', '计算', '求解', '证明'];
  const humanitiesKeywords = ['语文', '历史', '政治', '地理', '文学', '作文', '阅读', '分析', '论述', '谈谈'];

  let scienceScore = 0;
  let humanitiesScore = 0;

  for (const kw of scienceKeywords) {
    if (problemText.includes(kw)) scienceScore++;
  }
  for (const kw of humanitiesKeywords) {
    if (problemText.includes(kw)) humanitiesScore++;
  }

  let route: SolveGraphState['agentRoute'];
  if (scienceScore > humanitiesScore) {
    route = 'science';
  } else if (humanitiesScore > scienceScore) {
    route = 'humanities';
  } else {
    route = 'universal';
  }

  log.info(`[SolveGraph] routeToAgent: ${route} (science=${scienceScore}, humanities=${humanitiesScore})`);

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

  log.info(`[SolveGraph] gradeAnswer: isCorrect=${gradeResult.isCorrect}, score=${gradeResult.score}`);

  return { gradeResult };
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
    return {
      fourPartOutput: {
        answer: '解题失败',
        steps: [],
        knowledgePoints: [],
        similarQuestions: [],
      },
    };
  }

  // Build raw solution object from solver output
  const raw = {
    answer: solution,
    steps: state.parsedSteps ?? [],
    knowledgePoints: (state.parsedKnowledgePoints ?? []).map((k) => ({
      name: k.name,
      description: k.description,
      difficulty: k.difficulty as 'easy' | 'medium' | 'hard',
    })),
    similarQuestions: state.parsedSimilarQuestions ?? [],
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
export function afterCheckSolveCache(state: SolveGraphState): 'checkQuestionBank' | 'generateOutput' {
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
): SolveGraphState {
  return {
    problemText,
    problemImage: problemImage ?? null,
    userAnswer: userAnswer ?? null,
    agentId: 'universal',
    selectedAgentId: null,
    agentRoute: null,
    solution: null,
    parsedSteps: [],
    parsedKnowledgePoints: [],
    parsedSimilarQuestions: [],
    gradeResult: null,
    votingResults: [],
    fourPartOutput: null,
    fromQuestionBank: false,
    fromSolveCache: false,
    error: null,
  };
}
