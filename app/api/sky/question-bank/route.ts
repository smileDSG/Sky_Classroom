/**
 * GET/POST /api/sky/question-bank
 * Question bank query and auto-save endpoint.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import {
  findSimilarQuestions,
  saveToQuestionBank,
  listQuestionBankEntries,
  isProblemInBank,
} from '@/lib/solve/question-bank';
import type { QuestionBankEntry } from '@/lib/solve/types';

const log = createLogger('API:SkyQuestionBank');

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || '';
    const agentType = url.searchParams.get('agentType') || '';
    const verified = url.searchParams.get('verified');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));

    let entries: QuestionBankEntry[];
    let total: number;

    if (query) {
      const matches = await findSimilarQuestions(query, 0.3);
      entries = matches;
      if (agentType) {
        entries = entries.filter((e) => e.agentId === agentType);
      }
      if (verified !== null && verified !== undefined) {
        entries = entries.filter((e) => e.verified === (verified === 'true'));
      }
      total = entries.length;
      const start = (page - 1) * limit;
      entries = entries.slice(start, start + limit);
    } else {
      const allEntries = await listQuestionBankEntries(1000);
      let filtered = allEntries;
      if (agentType) {
        filtered = filtered.filter((e) => e.agentId === agentType);
      }
      if (verified !== null && verified !== undefined) {
        filtered = filtered.filter((e) => e.verified === (verified === 'true'));
      }
      total = filtered.length;
      const start = (page - 1) * limit;
      entries = filtered.slice(start, start + limit);
    }

    return apiSuccess({
      questions: entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    log.error('Question bank GET error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '题库查询失败', err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { problemText, problemImage, answer, steps, knowledgePoints, agentId } = body;

    if (!problemText || !answer) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        '缺少必填字段: problemText, answer',
      );
    }

    const exists = await isProblemInBank(problemText);
    if (exists) {
      return apiSuccess({
        id: '',
        saved: false,
        message: '题目已存在于题库中',
        duplicated: true,
      });
    }

    const entry = await saveToQuestionBank({
      problemText,
      problemImage: problemImage ?? undefined,
      answer,
      steps: steps ?? [],
      knowledgePoints: knowledgePoints ?? [],
      agentId: agentId ?? 'universal',
      solvedAt: new Date(),
      verified: false,
    });

    log.info(`题目已入库: ${entry.id}`);

    return apiSuccess({
      id: entry.id,
      saved: true,
      duplicated: false,
    });
  } catch (err) {
    log.error('Question bank POST error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '题库保存失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
