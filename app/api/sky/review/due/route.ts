/**
 * GET /api/sky/review/due
 *
 * Returns mistakes due for review based on Ebbinghaus scheduling.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { buildReviewSchedule, getMasteryProgress } from '@/lib/schedule/review-scheduler';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SkyReviewDue');

let _daoPromise: ReturnType<typeof initDAO> | null = null;

async function initDAO() {
  const storage = await getRequiredServerStorage();
  return createMistakeBookDAO(storage);
}

async function getDAO() {
  if (!_daoPromise) {
    _daoPromise = initDAO().catch((error) => {
      _daoPromise = null;
      throw error;
    });
  }
  return _daoPromise;
}

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const dao = await getDAO();
    const { items: mistakes } = await dao.list(auth.user.id, { pageSize: 9999 });

    const schedule = buildReviewSchedule(mistakes);
    const progress = getMasteryProgress(mistakes);

    log.info(`Review due: ${schedule.today?.count ?? 0} items`);

    return apiSuccess({
      dueToday: schedule.today?.items ?? [],
      dueCount: schedule.today?.count ?? 0,
      upcoming: schedule.upcoming,
      overdue: schedule.overdue,
      completed: schedule.completed,
      total: schedule.total,
      progress,
    });
  } catch (err) {
    log.error('Review due API error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '复习计划查询失败');
  }
}
