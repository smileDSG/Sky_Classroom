/**
 * Solve Chain — orchestrates the multi-agent solve pipeline.
 *
 * Chain: analyze → solve → verify → (correct?) → knowledge → similar
 *
 * Timeout control:
 *   - Single step: dynamic (min of remaining budget and 20s cap)
 *   - Total chain: 120s
 *
 * Error degradation: a single step failure does not block subsequent steps;
 * the step is marked with a warning flag and the chain continues.
 */

import { analyzeProblem } from './agents/analyze-agent';
import type { AnalysisResult } from './agents/analyze-types';
import { verifyAnswer } from './agents/verify-agent';
import { correctAnswer, type CorrectResult } from './agents/correct-agent';
import { streamSolve, type StreamEvent } from './streaming-solver';
import { classifyProblem } from './solver-constants';
import type { SolverAgentType } from './types';
import { buildKnowledgePointsPrompt } from './solver-prompts';
import { findSimilarByKnowledgePoints, hashProblemText } from './question-bank';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveChain');

// ── Timeouts (ms) ──────────────────────────────────────────────────

const TOTAL_CHAIN_TIMEOUT = 120_000;
const MAX_STEP_TIMEOUT = 20_000;
const MIN_STEP_TIMEOUT = 5_000;

/** Dynamic step timeout: use remaining chain budget, capped between min and max. */
function getStepTimeout(elapsed: number): number {
  const remaining = TOTAL_CHAIN_TIMEOUT - elapsed;
  return Math.min(MAX_STEP_TIMEOUT, Math.max(MIN_STEP_TIMEOUT, remaining));
}

// ── Types ──────────────────────────────────────────────────────────

/** Full result returned after the chain completes. */
export interface SolveChainResult {
  /** Analysis from C-001 */
  analysis: AnalysisResult | null;

  /** 完整详细的解题推导过程 */
  solution: string;

  /** Streaming steps from the solve agent */
  steps: { label: string; content: string; keyPoints: string[] }[];

  /** Final answer */
  answer: string;

  /** Verification from C-002 */
  verification: {
    isCorrect: boolean;
    confidence: number;
    suggestedAnswer?: string;
    reasoning: string;
  } | null;

  /** Correction from C-003 (only set when verify failed) */
  correction: CorrectResult | null;

  /** Knowledge points */
  knowledgePoints: { name: string; description: string; difficulty: string }[];

  /** Similar questions from KB */
  similarQuestions: {
    problem: string;
    difficulty: number;
    knowledgePoint: string;
    answer?: string;
  }[];

  /** Warnings from steps that failed or were skipped */
  warnings: string[];

  /** Metadata */
  metadata: {
    duration: number;
    stepsCompleted: number;
    hasCorrection: boolean;
    totalSteps: number;
  };
}

// ── Timeout helper ─────────────────────────────────────────────────

/** Run a promise with a timeout. Returns { ok: false, error } on timeout. */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    const value = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return { ok: true, value };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[SolveChain] ${label} failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

// ── Knowledge points generator (reuse existing pattern) ────────────

async function generateKnowledgePoints(
  problemText: string,
  answer: string,
): Promise<{ name: string; description: string; difficulty: string }[]> {
  try {
    const { callLLM } = await import('@/lib/ai/llm');
    const { getModel } = await import('@/lib/ai/providers');
    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    const { resolveSolverModel } = await import('./solver-constants');

    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);
    const prompt = buildKnowledgePointsPrompt(problemText, answer);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
      'chain-knowledge-gen',
      { retries: 1 },
      undefined,
      '你是知识点总结专家。请直接输出 JSON，不要输出其他内容。',
    );

    const parsed = parseJsonResponse<any>(result.text || '');
    if (parsed && Array.isArray(parsed.knowledgePoints)) {
      return parsed.knowledgePoints.map((k: any) => ({
        name: k.name || '',
        description: k.description || '',
        difficulty: k.difficulty || 'medium',
      }));
    }
  } catch (err) {
    log.warn('[SolveChain] Knowledge point generation failed:', err);
  }
  return [];
}

// ── Main chain function ────────────────────────────────────────────

/**
 * Execute the full solve chain for a problem.
 *
 * This runs the complete pipeline:
 *   analyze → solve → verify → (correct?) → knowledge → similar
 *
 * Each step has a dynamic timeout (min of remaining budget and 20s);
 * the entire chain has a 120s timeout.
 * A failed step emits a warning but does not stop the chain.
 */
export async function runSolveChain(
  problemText: string,
  problemImage?: string | null,
  onStreamEvent?: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<SolveChainResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // ── Overall chain timeout ────────────────────────────────────────
  const chainAbort = new AbortController();
  // Wire up external signal (e.g. client disconnect) if provided
  if (signal) {
    if (signal.aborted) {
      chainAbort.abort();
    }
    signal.addEventListener('abort', () => chainAbort.abort());
  }
  const chainTimer = setTimeout(() => {
    chainAbort.abort();
    log.warn('[SolveChain] Total chain timeout reached');
  }, TOTAL_CHAIN_TIMEOUT);

  try {
    let analysis: SolveChainResult['analysis'] = null;
    let solution = '';
    let steps: SolveChainResult['steps'] = [];
    let answer = '';
    let verification: SolveChainResult['verification'] = null;
    let correction: SolveChainResult['correction'] = null;
    let knowledgePoints: SolveChainResult['knowledgePoints'] = [];
    let similarQuestions: SolveChainResult['similarQuestions'] = [];

    // ── Step 1: Analyze ────────────────────────────────────────────
    log.info('[SolveChain] Step 1: Analyze');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }
    const analysisResult = await withTimeout(
      analyzeProblem(problemText),
      getStepTimeout(Date.now() - startTime),
      'analyze',
    );
    if (analysisResult.ok) {
      analysis = analysisResult.value;
    } else {
      warnings.push('分析步骤超时或失败，跳过');
    }

    // ── Step 2: Solve (streaming) ─────────────────────────────────
    log.info('[SolveChain] Step 2: Solve');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }
    const agentType = analysis
      ? mapSubjectToAgentType(analysis.subject)
      : classifyProblem(problemText);

    try {
      const solvePromise = solveStreamCollect(
        agentType,
        problemText,
        problemImage ?? null,
        onStreamEvent,
      );
      const solveResult = await withTimeout(
        solvePromise,
        getStepTimeout(Date.now() - startTime),
        'solve',
      );
      if (solveResult.ok) {
        solution = solveResult.value.solution || '';
        steps = solveResult.value.steps;
        answer = solveResult.value.answer;
        // If solver already returned knowledge points, use them
        if (solveResult.value.knowledgePoints.length > 0) {
          knowledgePoints = solveResult.value.knowledgePoints;
        }
        if (solveResult.value.similarQuestions.length > 0) {
          similarQuestions = solveResult.value.similarQuestions;
        }
      } else {
        warnings.push('解题步骤超时或失败');
      }
    } catch (err) {
      warnings.push(`解题步骤异常: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Step 3: Verify ─────────────────────────────────────────────
    log.info('[SolveChain] Step 3: Verify');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }
    if (answer) {
      const verifyResult = await withTimeout(
        verifyAnswer(problemText, answer),
        getStepTimeout(Date.now() - startTime),
        'verify',
      );
      if (verifyResult.ok) {
        verification = {
          isCorrect: verifyResult.value.isCorrect,
          confidence: verifyResult.value.confidence,
          suggestedAnswer: verifyResult.value.suggestedAnswer,
          reasoning: verifyResult.value.reasoning,
        };
      } else {
        warnings.push('校验步骤超时或失败');
      }
    } else {
      warnings.push('无答案，跳过校验');
    }

    // ── Step 4: Correct (if verify failed) ─────────────────────────
    if (verification && !verification.isCorrect && verification.suggestedAnswer) {
      log.info('[SolveChain] Step 4: Correct');
      if (chainAbort.signal.aborted) {
        throw new Error('Chain aborted');
      }
      const correctResult = await withTimeout(
        correctAnswer(problemText, answer, verification.suggestedAnswer, verification.reasoning),
        getStepTimeout(Date.now() - startTime),
        'correct',
      );
      if (correctResult.ok && correctResult.value) {
        correction = correctResult.value;
        answer = correctResult.value.answer;
        // Update steps with corrected version
        steps = correctResult.value.steps.length > 0 ? correctResult.value.steps : steps;
      } else {
        warnings.push('修正步骤超时或失败，保留原答案');
      }
    }

    // ── Step 5: Knowledge points (if not from solver) ──────────────
    log.info('[SolveChain] Step 5: Knowledge points');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }
    if (knowledgePoints.length === 0 && answer) {
      const kpResult = await withTimeout(
        generateKnowledgePoints(problemText, answer),
        getStepTimeout(Date.now() - startTime),
        'knowledge-gen',
      );
      if (kpResult.ok) {
        knowledgePoints = kpResult.value;
      } else {
        warnings.push('知识点生成超时或失败');
      }
    }

    // ── Step 6: Similar questions (if not from solver) ─────────────
    log.info('[SolveChain] Step 6: Similar questions');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }
    if (similarQuestions.length === 0 && knowledgePoints.length > 0) {
      try {
        const currentHash = hashProblemText(problemText);
        const kbSimilar = await findSimilarByKnowledgePoints(
          problemText,
          knowledgePoints.map((kp) => ({ name: kp.name })),
          currentHash,
          3,
        );
        if (kbSimilar.length >= 2) {
          similarQuestions = kbSimilar.map((q) => ({
            problem: q.problem,
            difficulty: q.difficulty,
            knowledgePoint: q.knowledgePoint,
            answer: q.answer,
          }));
        }
      } catch (err) {
        log.warn('[SolveChain] Similar question lookup failed:', err);
        // Not a warning — KB lookup is optional
      }
    }

    // ── Build result ───────────────────────────────────────────────
    const duration = Date.now() - startTime;
    const stepsCompleted = 6 - warnings.length;

    return {
      analysis,
      solution,
      steps,
      answer,
      verification,
      correction,
      knowledgePoints,
      similarQuestions,
      warnings,
      metadata: {
        duration,
        stepsCompleted,
        hasCorrection: correction !== null,
        totalSteps: 6,
      },
    };
  } finally {
    clearTimeout(chainTimer);
  }
}

// ── Internal helpers ───────────────────────────────────────────────

/** Collect all events from streamSolve into a single result object. */
async function solveStreamCollect(
  agentType: SolverAgentType,
  problemText: string,
  problemImage: string | null,
  onStreamEvent?: (event: StreamEvent) => void,
): Promise<{
  solution: string;
  steps: SolveChainResult['steps'];
  answer: string;
  knowledgePoints: SolveChainResult['knowledgePoints'];
  similarQuestions: SolveChainResult['similarQuestions'];
}> {
  const steps: SolveChainResult['steps'] = [];
  let solution = '';
  let answer = '';
  let knowledgePoints: SolveChainResult['knowledgePoints'] = [];
  let similarQuestions: SolveChainResult['similarQuestions'] = [];

  for await (const event of streamSolve(agentType, problemText, problemImage)) {
    // Forward event to caller if provided (for SSE streaming)
    onStreamEvent?.(event);

    if (event.type === 'solution') {
      solution = event.solution;
    } else if (event.type === 'step') {
      steps.push({ label: event.label, content: event.content, keyPoints: event.keyPoints });
    } else if (event.type === 'answer') {
      answer = event.answer;
    } else if (event.type === 'knowledge') {
      knowledgePoints = event.points;
    } else if (event.type === 'similar') {
      similarQuestions = event.questions;
    }
  }

  return { solution, steps, answer, knowledgePoints, similarQuestions };
}

/** Map analysis subject to solver agent type for optimal routing. */
function mapSubjectToAgentType(subject: AnalysisResult['subject']): SolverAgentType {
  switch (subject) {
    case 'math':
    case 'physics':
    case 'chemistry':
    case 'biology':
      return 'science';
    case 'chinese':
    case 'history':
    case 'geography':
    case 'politics':
    case 'english':
      return 'humanities';
    case 'unknown':
    default: {
      const _exhaustive: never = subject;
      void _exhaustive;
      return 'universal';
    }
  }
}
