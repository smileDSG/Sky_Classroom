/**
 * POST /api/sky/solve/grade
 * Grading endpoint: compares user answer with correct answer.
 */
import { gradeAnswer } from '@/lib/solve/grader';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import type { ErrorType } from '@/lib/storage/dao/mistakes';
import type { MistakeCause } from '@/lib/solve/types';

const log = createLogger('API:SkySolveGrade');

/** Map grader's MistakeCause to DAO's ErrorType */
function mapCauseToErrorType(cause: MistakeCause): ErrorType {
  const map: Record<MistakeCause, ErrorType> = {
    'concept-unclear': 'concept',
    'calculation-error': 'calculation',
    'misreading': 'reading',
    'method-wrong': 'reasoning',
    'careless': 'careless',
    'format-error': 'careless',
  };
  return map[cause] ?? 'concept';
}

let _daoPromise: ReturnType<typeof createMistakeBookDAO> | null = null;
async function getMistakeDAO() {
  if (!_daoPromise) {
    const storage = await getServerStorage();
    _daoPromise = createMistakeBookDAO(storage);
  }
  return _daoPromise;
}


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

    // 错误答案写入错题本（使用统一存储 DAO）
    if (!result.isCorrect) {
      try {
        const dao = await getMistakeDAO();
        await dao.add({
          id: mistakeId || `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          problemText: problem,
          userAnswer,
          correctAnswer,
          errorType: mapCauseToErrorType(result.cause),
          errorExplanation: result.errorAnalysis,
          knowledgePoints: knowledgePoints ?? [],
          sourceSessionId: undefined,
        });
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
