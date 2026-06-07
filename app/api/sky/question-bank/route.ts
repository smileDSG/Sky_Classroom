/**
 * GET/POST/DELETE /api/sky/question-bank
 *
 * Query and manage questions in the dedicated MySQL question_bank table.
 * Replaces the legacy KB-backed question bank with the new relational schema.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { search, count, insertOne, deleteById, deleteByIds, update, findById, findAdjacentIds } from '@/lib/question-bank/dao';
import type { QuestionBankInsert } from '@/lib/question-bank/types';

const log = createLogger('API:SkyQuestionBank');

// ── GET ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const id = searchParams.get('id');
    if (id) {
      const adjacent = searchParams.get('adjacent') === 'true';
      if (adjacent) {
        const adjacentIds = await findAdjacentIds(id, {
          subject: searchParams.get('subject') || undefined,
          grade: searchParams.get('grade') || undefined,
          difficulty: (searchParams.get('difficulty') as 'easy' | 'medium' | 'hard') || undefined,
          questionType: (searchParams.get('questionType') as 'choice' | 'fill' | 'solve' | 'judge') || undefined,
          verified: searchParams.has('verified')
            ? searchParams.get('verified') === 'true'
            : undefined,
          keyword: searchParams.get('query') || searchParams.get('keyword') || undefined,
        });
        return apiSuccess(adjacentIds);
      }

      const question = await findById(id);
      if (!question) {
        return apiError('NOT_FOUND', 404, '题目不存在');
      }
      return apiSuccess({ question });
    }

    const idsParam = searchParams.get('ids');
    const ids = idsParam
      ? idsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const filter = {
      keyword: searchParams.get('query') || searchParams.get('keyword') || undefined,
      subject: searchParams.get('subject') || undefined,
      grade: searchParams.get('grade') || undefined,
      difficulty: (searchParams.get('difficulty') as 'easy' | 'medium' | 'hard') || undefined,
      questionType: (searchParams.get('questionType') as 'choice' | 'fill' | 'solve' | 'judge') || undefined,
      verified: searchParams.has('verified')
        ? searchParams.get('verified') === 'true'
        : undefined,
      tags: searchParams.get('tags')
        ? searchParams.get('tags')!.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined,
      ids,
      limit: Math.min(100, Math.max(1, Number(searchParams.get('limit') || '20'))),
      offset: Math.max(0, (Number(searchParams.get('page') || '1') - 1) * Number(searchParams.get('limit') || '20')),
    };

    const [questions, total] = await Promise.all([
      search(filter),
      count({
        subject: filter.subject,
        grade: filter.grade,
        difficulty: filter.difficulty,
        questionType: filter.questionType,
        verified: filter.verified,
        keyword: filter.keyword,
        ids,
      }),
    ]);

    return apiSuccess({
      questions,
      total,
      page: Math.floor(filter.offset / filter.limit) + 1,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    });
  } catch (err: any) {
    log.error('Question bank GET error:', err);
    return apiError('INTERNAL_ERROR', 500, '题库查询失败', err.message);
  }
}

// ── POST ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry: QuestionBankInsert = {
      subject: body.subject ?? '未知学科',
      grade: body.grade ?? '',
      difficulty: body.difficulty ?? 'medium',
      questionType: body.questionType ?? 'solve',
      content: body.content ?? body.problemText ?? '',
      answer: body.answer ?? '',
      explanation: body.explanation ?? '',
      knowledgePoints: body.knowledgePoints ?? [],
      image: body.image ?? body.problemImage ?? undefined,
      options: body.options ?? undefined,
      source: body.source ?? undefined,
      tags: body.tags ?? [],
      verified: body.verified ?? true,
    };

    if (!entry.content || !entry.answer) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少必填字段: content, answer');
    }

    const row = await insertOne(entry);

    return apiSuccess({
      id: row.id,
      saved: true,
      duplicated: false,
    });
  } catch (err: any) {
    log.error('Question bank POST error:', err);
    if (err.message?.includes('Duplicate entry') || err.message?.includes('uq_problem_hash')) {
      return apiSuccess({ id: '', saved: false, duplicated: true, message: '题目已存在于题库中' });
    }
    return apiError('INTERNAL_ERROR', 500, '题库保存失败', err.message);
  }
}

// ── DELETE ──────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    const id = searchParams.get('id');

    if (idsParam) {
      const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return apiError('MISSING_REQUIRED_FIELD', 400, '缺少 id 参数');
      }
      const deleted = await deleteByIds(ids);
      return apiSuccess({ deleted, ids });
    }

    if (!id) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少 id 参数');
    }

    const ok = await deleteById(id);
    if (!ok) {
      return apiError('NOT_FOUND', 404, '题目不存在');
    }

    return apiSuccess({ deleted: true });
  } catch (err: any) {
    log.error('Question bank DELETE error:', err);
    return apiError('INTERNAL_ERROR', 500, '题库删除失败', err.message);
  }
}

// ── PATCH ───────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少 id 参数');
    }

    const body = await req.json();
    const ok = await update(id, body);
    if (!ok) {
      return apiError('NOT_FOUND', 404, '题目不存在');
    }

    return apiSuccess({ updated: true });
  } catch (err: any) {
    log.error('Question bank PATCH error:', err);
    return apiError('INTERNAL_ERROR', 500, '题库更新失败', err.message);
  }
}
