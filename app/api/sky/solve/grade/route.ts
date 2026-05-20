/**
 * POST /api/sky/solve/grade
 * Grading endpoint: compares user answer with correct answer.
 */
import { gradeAnswer } from '@/lib/solve/grader';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { trackMistake } from '@/lib/mistakes';
import type { MistakeRecord } from '@/lib/mistakes';

const log = createLogger('API:SkySolveGrade');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { problem, correctAnswer, userAnswer, stepByStep, mistakeId, knowledgePoints } = body;

    if (!problem || !correctAnswer || !userAnswer) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        '缺少必填字段: problem, correctAnswer, userAnswer',
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
          `错题本存储失败: ${errMsg}`,
        );
      }
    }

    return apiSuccess({ ...result });
  } catch (err) {
    log.error('Grade API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '批改失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
