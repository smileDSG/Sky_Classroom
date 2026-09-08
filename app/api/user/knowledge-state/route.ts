/**
 * GET/POST /api/user/knowledge-state
 *
 * Authoritative per-user knowledge state access. All operations are scoped
 * to the authenticated user; the client cannot read or write another user's
 * knowledge state.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { knowledgeStateSchema } from '@/lib/adaptive-learning/contracts';

const log = createLogger('API:UserKnowledgeState');

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const storage = await getRequiredServerStorage();
    const dao = createKnowledgeStateDAO(storage);
    const states = await dao.list(auth.user.id);

    return apiSuccess({ states });
  } catch (err) {
    log.error('KnowledgeState GET error:', err);
    return apiError('INTERNAL_ERROR', 500, '加载知识状态失败');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const parsed = knowledgeStateSchema.safeParse({
      ...body,
      userId: auth.user.id,
    });

    if (!parsed.success) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        '知识状态格式错误',
        parsed.error.message,
      );
    }

    const storage = await getRequiredServerStorage();
    const dao = createKnowledgeStateDAO(storage);
    await dao.set(auth.user.id, parsed.data);

    return apiSuccess({ state: parsed.data });
  } catch (err) {
    log.error('KnowledgeState POST error:', err);
    return apiError('INTERNAL_ERROR', 500, '保存知识状态失败');
  }
}
