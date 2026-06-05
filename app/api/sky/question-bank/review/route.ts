/**
 * Question Bank Review Queue API
 *
 * GET  — List questions pending review (verified = false)
 * POST — Approve, reject, or update a pending question
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { search, count, update, deleteById } from '@/lib/question-bank/dao';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:QB:Review');

// ── GET ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);
    const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0);

    const [questions, total] = await Promise.all([
      search({ verified: false, limit, offset }),
      count({ verified: false }),
    ]);

    return apiSuccess({ questions, total, limit, offset });
  } catch (err: any) {
    log.error('GET review queue failed:', err);
    return apiError('INTERNAL_ERROR', 500, '获取审核队列失败', err.message);
  }
}

// ── POST ────────────────────────────────────────────────────────────

const PostBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal('reject'),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal('update'),
    id: z.string().min(1),
    data: z.object({
      subject: z.string().optional(),
      grade: z.string().optional(),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
      questionType: z.enum(['choice', 'fill', 'solve', 'judge']).optional(),
      content: z.string().optional(),
      answer: z.string().optional(),
      explanation: z.string().optional(),
      knowledgePoints: z.array(z.string()).optional(),
      image: z.string().optional(),
      options: z.array(z.string()).optional(),
      source: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PostBodySchema.safeParse(body);

    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, '请求参数错误', parsed.error.message);
    }

    const { action, id } = parsed.data;

    switch (action) {
      case 'approve': {
        const ok = await update(id, { verified: true });
        if (!ok) {
          return apiError('NOT_FOUND', 404, '题目不存在或已是审核通过状态');
        }
        return apiSuccess({ id, action: 'approve', verified: true });
      }

      case 'reject': {
        const ok = await deleteById(id);
        if (!ok) {
          return apiError('NOT_FOUND', 404, '题目不存在');
        }
        return apiSuccess({ id, action: 'reject', deleted: true });
      }

      case 'update': {
        const ok = await update(id, { ...parsed.data.data, verified: true });
        if (!ok) {
          return apiError('NOT_FOUND', 404, '题目不存在');
        }
        return apiSuccess({ id, action: 'update', verified: true });
      }
    }
  } catch (err: any) {
    log.error('POST review queue failed:', err);
    return apiError('INTERNAL_ERROR', 500, '审核操作失败', err.message);
  }
}
