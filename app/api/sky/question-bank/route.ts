/**
 * GET/POST /api/sky/question-bank
 * Question bank query and auto-save endpoint.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { hashProblemText } from '@/lib/solve/question-bank-utils';
import {
  count,
  deleteById,
  findByHash,
  findById,
  insertOne,
  search,
} from '@/lib/question-bank/dao';
import type { QuestionBankFilter, QuestionBankInsert } from '@/lib/question-bank/types';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '@/lib/server/auth/helpers';

const log = createLogger('API:SkyQuestionBank');
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const QUESTION_TYPES = new Set(['choice', 'fill', 'solve', 'judge']);

const QuestionBankCreateSchema = z.object({
  content: z.string().min(1).max(20000),
  problemText: z.string().max(20000).optional(),
  answer: z.string().min(1).max(20000),
  subject: z.string().max(100).optional(),
  grade: z.string().max(100).optional(),
  difficulty: z.string().max(20).optional(),
  questionType: z.string().max(50).optional(),
  explanation: z.string().max(20000).optional(),
  solution: z.string().max(20000).optional(),
  knowledgePoints: z.array(z.string().max(200)).max(20).optional(),
  image: z.string().max(2000).optional(),
  problemImage: z.string().max(2000).optional(),
  options: z.array(z.unknown()).max(20).optional(),
  source: z.string().max(100).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  verified: z.boolean().optional(),
});

type KnowledgePointInput = string | { name?: unknown };

function normalizeDifficulty(value: unknown): QuestionBankInsert['difficulty'] {
  return typeof value === 'string' && DIFFICULTIES.has(value)
    ? (value as QuestionBankInsert['difficulty'])
    : 'medium';
}

function normalizeQuestionType(value: unknown): QuestionBankInsert['questionType'] {
  return typeof value === 'string' && QUESTION_TYPES.has(value)
    ? (value as QuestionBankInsert['questionType'])
    : 'solve';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: KnowledgePointInput) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && typeof item.name === 'string')
        return item.name.trim();
      return '';
    })
    .filter(Boolean);
}

function normalizeOptions(value: unknown): string[] | undefined {
  const options = normalizeStringArray(value);
  return options.length > 0 ? options : undefined;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || '';
    const subject = url.searchParams.get('subject') || '';
    const grade = url.searchParams.get('grade') || '';
    const difficulty = url.searchParams.get('difficulty') || '';
    const questionType = url.searchParams.get('questionType') || '';
    const knowledgePoint = url.searchParams.get('knowledgePoint') || '';
    const verified = url.searchParams.get('verified');
    const id = url.searchParams.get('id');
    const adjacent = url.searchParams.get('adjacent') === 'true';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));

    if (id && !adjacent) {
      const question = await findById(id);
      return apiSuccess({ question });
    }

    const filter: QuestionBankFilter = adjacent
      ? { limit: 100, offset: 0 }
      : { limit, offset: (page - 1) * limit };

    if (query) filter.keyword = query;
    if (subject) filter.subject = subject;
    if (grade) filter.grade = grade;
    if (DIFFICULTIES.has(difficulty))
      filter.difficulty = difficulty as QuestionBankFilter['difficulty'];
    if (QUESTION_TYPES.has(questionType))
      filter.questionType = questionType as QuestionBankFilter['questionType'];
    if (knowledgePoint.trim()) filter.knowledgePoint = knowledgePoint.trim();
    if (verified !== null && verified !== undefined) filter.verified = verified === 'true';

    const [questions, total] = await Promise.all([search(filter), count(filter)]);

    if (id && adjacent) {
      const index = questions.findIndex((question) => question.id === id);
      return apiSuccess({
        prevId: index > 0 ? questions[index - 1].id : null,
        nextId: index >= 0 && index < questions.length - 1 ? questions[index + 1].id : null,
      });
    }

    return apiSuccess({
      questions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Question bank GET error:', err);

    if (message.includes('Access denied for user')) {
      return apiSuccess({
        questions: [],
        total: 0,
        page: 1,
        limit: Math.min(
          100,
          Math.max(1, parseInt(new URL(req.url).searchParams.get('limit') || '10', 10)),
        ),
        totalPages: 0,
      });
    }

    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '题库查询失败', message);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const idsParam = url.searchParams.get('ids');
    const id = url.searchParams.get('id');

    if (idsParam) {
      const ids = idsParam
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing ids parameter');
      }
      const results = await Promise.all(ids.map((item) => deleteById(item)));
      return apiSuccess({ deleted: results.filter(Boolean).length });
    }

    if (!id) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing id or ids parameter');
    }

    const deleted = await deleteById(id);
    return apiSuccess({ deleted: deleted ? 1 : 0 });
  } catch (err) {
    log.error('Question bank DELETE error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '题库删除失败');
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const rawBody = (await req.json()) as unknown;
    const parsed = QuestionBankCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '无效的题目数据');
    }
    const body = parsed.data;
    const content = String(body.content ?? body.problemText ?? '').trim();
    const answer = String(body.answer ?? '').trim();

    if (!content || !answer) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, '缺少必填字段: content, answer');
    }

    const problemHash = hashProblemText(content);
    const existing = await findByHash(problemHash);
    if (existing) {
      return apiSuccess({
        id: existing.id,
        saved: false,
        message: '题目已存在于题库中',
        duplicated: true,
      });
    }

    const entry = await insertOne({
      subject: String(body.subject ?? '').trim(),
      grade: String(body.grade ?? '').trim(),
      difficulty: normalizeDifficulty(body.difficulty),
      questionType: normalizeQuestionType(body.questionType),
      content,
      answer,
      explanation: String(body.explanation ?? body.solution ?? '').trim(),
      knowledgePoints: normalizeStringArray(body.knowledgePoints),
      image:
        typeof body.image === 'string'
          ? body.image
          : typeof body.problemImage === 'string'
            ? body.problemImage
            : undefined,
      options: normalizeOptions(body.options),
      source: typeof body.source === 'string' ? body.source : undefined,
      tags: normalizeStringArray(body.tags),
      verified: typeof body.verified === 'boolean' ? body.verified : true,
    });

    log.info(`题目已入库: ${entry.id}`);

    return apiSuccess({
      id: entry.id,
      question: entry,
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
