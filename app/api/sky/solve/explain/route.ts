/**
 * POST /api/sky/solve/explain
 * Solve + generate four-part output endpoint.
 * Executes the SolveGraph LangGraph pipeline.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { createSolveGraph, buildSolveInitialState } from '@/lib/solve/solve-graph';

const log = createLogger('API:SkySolveExplain');

export async function POST(req: Request) {
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

    const finalState = await graph.invoke(initialState);

    if (finalState.error) {
      log.error(`[Explain] Graph error: ${finalState.error}`);
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        `解题失败: ${finalState.error}`,
      );
    }

    const output = finalState.fourPartOutput ?? {
      answer: finalState.solution ?? '',
      steps: [],
      knowledgePoints: [],
      similarQuestions: [],
    };

    log.info(`[Explain] Done. fromQuestionBank=${finalState.fromQuestionBank}`);

    return apiSuccess({
      ...output,
      fromQuestionBank: finalState.fromQuestionBank ?? false,
      solvingTime: 0,
      agentsUsed: [finalState.agentRoute ?? 'universal'],
    });
  } catch (err) {
    log.error('Explain API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '解题失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
