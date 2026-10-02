/**
 * POST /api/sky/solve/explain
 * Solve + generate four-part output endpoint.
 * Executes the SolveGraph LangGraph pipeline.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { createSolveGraph, buildSolveInitialState } from '@/lib/solve/solve-graph';
import { saveToQuestionBank, isProblemInBank } from '@/lib/solve/question-bank';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { validateProblemSpec } from '@/lib/recognition/problem-spec-parser';
import { safeErrorMessage } from '@/lib/server/sanitize-error';

const log = createLogger('API:SkySolveExplain');

export async function POST(req: Request) {
  try {
    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;

    const body = await req.json();
    const {
      problem,
      problemImage,
      problemSpec: rawProblemSpec,
      userAnswer,
      agentId,
      useHighPrecision,
      outputFormat,
    } = body;

    if (!problem) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required field: problem',
      );
    }

    let problemSpec = null;
    if (rawProblemSpec != null) {
      try {
        problemSpec = validateProblemSpec(rawProblemSpec);
      } catch (err) {
        return apiError(
          API_ERROR_CODES.INVALID_REQUEST,
          400,
          'Invalid problemSpec',
          safeErrorMessage(err),
        );
      }
    }

    log.info(`[Explain] Solving: ${problem.slice(0, 60)}...`);

    const graph = createSolveGraph();
    const initialState = buildSolveInitialState(
      problem,
      problemImage ?? null,
      userAnswer ?? null,
      problemSpec ?? null,
    );

    const startTime = performance.now();
    const finalState = await graph.invoke(initialState);
    const solvingTime = Math.round(performance.now() - startTime);

    if (finalState.error) {
      log.error(`[Explain] Graph error: ${finalState.error}`);
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, `解题失败: ${finalState.error}`);
    }

    const output = finalState.fourPartOutput ?? {
      answer: finalState.solution ?? '',
      solution: finalState.solution ?? '',
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
      questionType: undefined,
      options: undefined,
    };

    log.info(`[Explain] 耗时 ${solvingTime}ms, 缓存命中=${finalState.fromQuestionBank}`);

    // 非题库命中的题目自动入库
    if (!finalState.fromQuestionBank && output.answer) {
      try {
        const alreadyInBank = await isProblemInBank(problem);
        if (!alreadyInBank) {
          await saveToQuestionBank({
            problemText: problem,
            problemImage: problemImage ?? undefined,
            answer: output.answer,
            solution: output.solution ?? '',
            knowledgePoints: (output.knowledgePoints ?? []).map((kp) => ({
              name: kp.name,
              description: kp.description,
              difficulty: kp.difficulty,
            })),
            similarQuestions: output.similarQuestions ?? [],
            agentId: agentId ?? 'universal',
            solvedAt: Date.now(),
            verified: false,
            questionType: output.questionType,
            options: output.options,
          });
          log.info('[Explain] 题目已自动入库');
        }
      } catch (e) {
        log.error('题库入库失败:', e);
      }
    }

    await recordUsage(quota.userId, quota.planType, 'llmCalls');
    return apiSuccess({
      ...output,
      fromQuestionBank: finalState.fromQuestionBank ?? false,
      solvingTime,
      agentsUsed: [finalState.agentRoute ?? 'universal'],
    });
  } catch (err) {
    log.error('Explain API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '解题失败',
      err instanceof Error ? safeErrorMessage(err) : undefined,
    );
  }
}
