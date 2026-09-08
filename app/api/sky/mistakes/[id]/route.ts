/**
 * DELETE /api/sky/mistakes/:id
 *
 * Remove a mistake by ID.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SkyMistakes');

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    if (!id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少 id 参数');
    }

    const storage = await getRequiredServerStorage();
    const dao = createMistakeBookDAO(storage);
    const deleted = await dao.delete(auth.user.id, id);
    if (!deleted) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '错题不存在');
    }
    log.info('Mistake deleted:', id);
    return apiSuccess({ deleted: true, id });
  } catch (err) {
    log.error('Mistakes DELETE error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '删除错题失败');
  }
}
