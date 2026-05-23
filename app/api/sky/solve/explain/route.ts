/**
 * POST /api/sky/solve/explain
 * Solve + generate four-part output endpoint.
 * Executes the SolveGraph LangGraph pipeline.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerTranslation } from '@/lib/server/i18n';
import { createLogger } from '@/lib/logger';
import { createSolveGraph, buildSolveInitialState } from '@/lib/solve/solve-graph';
import { saveToQuestionBank, isProblemInBank } from '@/lib/solve/question-bank';

const log = createLogger('API:SkySolveExplain');

export async function POST(req: Request) {
  const locale = req.headers.get('X-Locale') || 'zh-CN';
  try {
    const body = await req.json();
    const { problem, problemImage, userAnswer, agentId, useHighPrecision, outputFormat } = body;

    if (!problem) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required field: problem',
      );
    }

    log.info(`[Explain] Solving: ${problem.slice(0, 60)}...`);

    const graph = createSolveGraph();
    const initialState = buildSolveInitialState(problem, problemImage ?? null, userAnswer ?? null);

    const startTime = performance.now();
    const finalState = await graph.invoke(initialState);
    const solvingTime = Math.round(performance.now() - startTime);

    if (finalState.error) {
      log.error(`[Explain] Graph error: ${finalState.error}`);
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        `${getServerTranslation(locale, 'api.generateFailed')}: ${finalState.error}`,
      );
    }

    const output = finalState.fourPartOutput ?? {
      answer: finalState.solution ?? '',
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
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
            steps: (output.steps ?? []).map(s => `${s.label}: ${s.content}`),
            knowledgePoints: (output.knowledgePoints ?? []).map(kp => kp.name),
            agentId: agentId ?? 'universal',
            solvedAt: Date.now(),
            verified: false,
          });
          log.info('[Explain] 题目已自动入库');
        }
      } catch (e) {
        log.error('题库入库失败:', e);
      }
    }

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
      getServerTranslation(locale, 'api.generateFailed'),
      err instanceof Error ? err.message : undefined,
    );
  }
}
