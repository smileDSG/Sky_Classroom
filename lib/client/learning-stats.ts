import type { LearningStatsResponse } from '@/lib/teaching/learning-path-types';

let inFlightRequest: Promise<LearningStatsResponse> | null = null;

/** Deduplicate concurrent stats reads from the shell and dashboard page. */
export function fetchLearningStats(): Promise<LearningStatsResponse> {
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = fetch('/api/sky/learning-stats', { credentials: 'include' })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error('学习统计查询失败');
      return data as LearningStatsResponse;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}
