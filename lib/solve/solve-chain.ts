/**
 * Solve Chain — orchestrates the multi-agent solve pipeline.
 *
 * Chain: analyze → solve → verify → (correct?) → knowledge + similar
 *
 * Timeout control:
 *   - Single step: dynamic (min of remaining budget and 20s cap)
 *   - Total chain: 60s (reduced from 120s for snappier UX)
 *
 * Performance optimizations:
 *   - analyze runs in parallel with the checking phase
 *   - knowledge-gen and similar-question search run in parallel
 *   - verify skipped when analysis confidence > 0.8 (heuristic trust)
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
import { postProcessMathContent } from './math-postprocessor';
import type { ProblemSpec } from './types';

const log = createLogger('SolveChain');

// ── Timeouts (ms) ──────────────────────────────────────────────────

const TOTAL_CHAIN_TIMEOUT = 120_000;
const MAX_STEP_TIMEOUT = 30_000;
const MIN_STEP_TIMEOUT = 5_000;

/** Confidence threshold above which we skip the verify step. */
const HIGH_CONFIDENCE_THRESHOLD = 0.7;

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
  let timer: ReturnType<typeof setTimeout> | undefined;
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
 *   analyze → solve → verify → (correct?) → knowledge + similar (parallel)
 *
 * Each step has a dynamic timeout (min of remaining budget and 15s);
 * the entire chain has a 60s timeout.
 * A failed step emits a warning but does not stop the chain.
 *
 * @param analyzePromise — optional pre-started analyze promise for parallel execution.
 *   Pass the result of `analyzeProblem(problemText)` started during the checking phase.
 *   If omitted, analyze runs synchronously in Step 1 (same as before).
 */
export async function runSolveChain(
  problemText: string,
  problemImage?: string | null,
  onStreamEvent?: (event: StreamEvent) => void,
  signal?: AbortSignal,
  analyzePromise?: Promise<import('./agents/analyze-types').AnalysisResult>,
  problemSpec?: ProblemSpec | null,
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

    // ── Step 1 & 2: Analyze + Solve in parallel ───────────────────
    // Start solve immediately with universal model (fastest).
    // Analyze runs in parallel — if it indicates a different agent type,
    // we'll run a correction step after solve completes.
    log.info('[SolveChain] Step 1+2: Analyze + Solve (parallel)');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }

    const analyzeToRun = analyzePromise ?? analyzeProblem(problemText);
    const t_analyze = Date.now();
    const analyzePromiseWithTimeout = withTimeout(
      analyzeToRun,
      getStepTimeout(Date.now() - startTime),
      'analyze',
    );

    // Start solve immediately with universal agent (fastest model)
    const initialAgentType: SolverAgentType = 'universal';

    // Run solve and analyze in parallel
    const t_parallel = Date.now();
    const [solveResultRaw, analysisResult] = await Promise.all([
      (async () => {
        const t_solve = Date.now();
        try {
          const solvePromise = solveStreamCollect(
            initialAgentType,
            problemText,
            problemImage ?? null,
            onStreamEvent,
            problemSpec ?? null,
          );
          const result = await withTimeout(
            solvePromise,
            getStepTimeout(Date.now() - startTime),
            'solve',
          );
          log.info(`[SolveChain] Solve took ${Date.now() - t_solve}ms, ok=${result.ok}`);
          return result;
        } catch (err) {
          log.info(`[SolveChain] Solve failed after ${Date.now() - t_solve}ms`);
          return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      analyzePromiseWithTimeout,
    ]);
    log.info(`[SolveChain] Parallel phase took ${Date.now() - t_parallel}ms`);

    // Process analyze result
    if (analysisResult.ok) {
      analysis = analysisResult.value;
      log.info(
        `[SolveChain] Analyze: subject=${analysis.subject}, confidence=${analysis.confidence}`,
      );
    } else {
      warnings.push('分析步骤超时或失败，跳过');
    }

    // Process solve result
    if (solveResultRaw.ok) {
      const solveResult = solveResultRaw.value;
      solution = solveResult.solution || '';
      steps = solveResult.steps;
      answer = solveResult.answer;
      if (solveResult.knowledgePoints.length > 0) {
        knowledgePoints = solveResult.knowledgePoints;
      }
      if (solveResult.similarQuestions.length > 0) {
        similarQuestions = solveResult.similarQuestions;
      }
      log.info(
        `[SolveChain] Solve result: answer=${answer?.slice(0, 30) || 'none'}, steps=${steps.length}`,
      );
    } else {
      warnings.push('解题步骤超时或失败');
      log.warn(`[SolveChain] Solve failed: ${solveResultRaw.error}`);
    }

    // If analyze indicates a different agent type AND solve failed or produced no answer,
    // try again with the correct agent type
    if (analysis && !answer) {
      const correctAgentType = mapSubjectToAgentType(analysis.subject);
      if (correctAgentType !== initialAgentType) {
        log.info(`[SolveChain] Retrying with correct agent type: ${correctAgentType}`);
        try {
          const retryPromise = solveStreamCollect(
            correctAgentType,
            problemText,
            problemImage ?? null,
            onStreamEvent,
            problemSpec ?? null,
          );
          const retryResult = await withTimeout(
            retryPromise,
            getStepTimeout(Date.now() - startTime),
            'solve-retry',
          );
          if (retryResult.ok) {
            solution = retryResult.value.solution || '';
            steps = retryResult.value.steps;
            answer = retryResult.value.answer;
            if (retryResult.value.knowledgePoints.length > 0) {
              knowledgePoints = retryResult.value.knowledgePoints;
            }
            if (retryResult.value.similarQuestions.length > 0) {
              similarQuestions = retryResult.value.similarQuestions;
            }
          }
        } catch (err) {
          warnings.push(`重试解题异常: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // ── Step 2.5: Regex post-processing ─────────────────────────────
    // Apply regex-based math formatting (Unicode conversion, bare functions,
    // fraction wrapping, etc.). The LLM prompt already instructs proper
    // LaTeX output, so this is just a safety net for edge cases.
    if (solution) {
      solution = postProcessMathContent(solution);
      steps = steps.map((s) => ({ ...s, content: postProcessMathContent(s.content) }));
      answer = postProcessMathContent(answer);
    }

    // ── Step 3: Verify ─────────────────────────────────────────────
    log.info('[SolveChain] Step 3: Verify');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }
    // Skip verify conditions:
    // 1. High confidence from analysis (≥0.7)
    // 2. Pure numeric answer (detected by regex)
    // 3. Short problem (<50 chars) — likely simple
    const highConfidence = analysis?.confidence ?? 0;
    const isPureNumericAnswer = answer && /^[\d.,\s\-+*/()]+$/.test(answer.replace(/\s/g, ''));
    const isShortProblem = problemText.length < 50;
    const skipVerify =
      highConfidence >= HIGH_CONFIDENCE_THRESHOLD || isPureNumericAnswer || isShortProblem;
    if (skipVerify) {
      const reason =
        highConfidence >= HIGH_CONFIDENCE_THRESHOLD
          ? '分析置信度较高'
          : isPureNumericAnswer
            ? '纯数字答案'
            : '短题目（<50字符）';
      log.info(`[SolveChain] Step 3: Verify skipped (${reason})`);
      verification = {
        isCorrect: true,
        confidence: highConfidence || 0.8,
        reasoning: `校验已跳过：${reason}`,
      };
    } else if (answer) {
      const verifyResult = await withTimeout(
        verifyAnswer(problemText, answer, problemSpec),
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
        steps =
          correctResult.value.steps.length > 0
            ? correctResult.value.steps.map((s) => ({ ...s, keyPoints: s.keyPoints ?? [] }))
            : steps;
      } else {
        warnings.push('修正步骤超时或失败，保留原答案');
      }
    }

    // ── Step 5+6: Knowledge points + Similar questions (parallel) ──
    log.info('[SolveChain] Step 5+6: Knowledge + Similar (parallel)');
    if (chainAbort.signal.aborted) {
      throw new Error('Chain aborted');
    }

    // Start both operations in parallel
    const knowledgePromise =
      knowledgePoints.length === 0 && answer
        ? withTimeout(
            generateKnowledgePoints(problemText, answer),
            getStepTimeout(Date.now() - startTime),
            'knowledge-gen',
          )
        : Promise.resolve({ ok: true as const, value: knowledgePoints });

    const currentHash = hashProblemText(problemText);
    const kpNames =
      knowledgePoints.length > 0 ? knowledgePoints.map((kp) => ({ name: kp.name })) : [];
    const similarPromise =
      similarQuestions.length === 0 && kpNames.length > 0 && answer
        ? (async () => {
            try {
              const kbSimilar = await findSimilarByKnowledgePoints(
                problemText,
                kpNames,
                currentHash,
                3,
              );
              if (kbSimilar.length >= 2) {
                return kbSimilar.map((q) => ({
                  problem: q.problem,
                  difficulty: q.difficulty,
                  knowledgePoint: q.knowledgePoint,
                  answer: q.answer,
                }));
              }
            } catch (err) {
              log.warn('[SolveChain] Similar question lookup failed:', err);
            }
            return [];
          })()
        : Promise.resolve(similarQuestions);

    const [kpResult, similarResult] = await Promise.all([knowledgePromise, similarPromise]);
    if (kpResult.ok) knowledgePoints = kpResult.value;
    if (similarResult.length > 0) similarQuestions = similarResult;

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
  problemSpec?: ProblemSpec | null,
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

  for await (const event of streamSolve(agentType, problemText, problemImage, problemSpec)) {
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
      return 'universal';
    default:
      return 'universal';
  }
}
