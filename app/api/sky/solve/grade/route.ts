/**
 * POST /api/sky/solve/grade
 * Grading endpoint: compares user answer with correct answer.
 */
import { gradeAnswer } from '@/lib/solve/grader';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerTranslation } from '@/lib/server/i18n';
import { createLogger } from '@/lib/logger';
import { trackMistake } from '@/lib/mistakes';
import type { MistakeRecord } from '@/lib/mistakes';

const log = createLogger('API:SkySolveGrade');

export async function POST(req: Request) {
  const locale = req.headers.get('X-Locale') || 'zh-CN';
  try {
    const body = await req.json();
    const { problem, correctAnswer, userAnswer, stepByStep, mistakeId, knowledgePoints } = body;

    if (!problem || !correctAnswer || !userAnswer) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        getServerTranslation(locale, 'api.missingFields'),
      );
    }

    const steps: string[] | undefined = Array.isArray(stepByStep)
      ? stepByStep.map((s: { content?: string; text?: string }) => s?.content ?? s?.text ?? '')
      : undefined;

    const result = await gradeAnswer(problem, correctAnswer, userAnswer, steps);

    // 错误答案写入错题本
    if (!result.isCorrect) {
      try {
        const record: MistakeRecord = {
          id: mistakeId || `mistake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          problem,
          userAnswer,
          correctAnswer,
          cause: result.cause,
          solvedAt: new Date(),
          reviewed: false,
          reviewCount: 0,
          knowledgePoints: knowledgePoints ?? [],
        };
        await trackMistake(record);
        log.info('批改结果已存入错题本');
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        log.error('错题本存储失败:', errMsg, e instanceof Error ? e.stack : '');
        return apiError(
          API_ERROR_CODES.INTERNAL_ERROR,
          500,
          `${getServerTranslation(locale, 'api.recordFailed')}: ${errMsg}`,
        );
      }
    }

    return apiSuccess({ ...result });
  } catch (err) {
    log.error('Grade API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      getServerTranslation(locale, 'api.queryFailed'),
      err instanceof Error ? err.message : undefined,
    );
  }
}
