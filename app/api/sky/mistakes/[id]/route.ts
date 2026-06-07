/**
 * DELETE /api/sky/mistakes/:id
 *
 * Remove a mistake by ID.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SkyMistakes');

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '缺少 id 参数');
    }

    const storage = await getServerStorage();
    const dao = createMistakeBookDAO(storage);
    await dao.delete(id);
    log.info('Mistake deleted:', id);
    return apiSuccess({ deleted: true, id });
  } catch (err) {
    log.error('Mistakes DELETE error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '删除错题失败');
  }
}
