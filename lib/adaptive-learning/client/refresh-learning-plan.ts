export interface LearningPlanRefreshData {
  plan?: { id?: string; version?: number } | null;
  view?: {
    nextTask?: { id?: string; nodeId?: string; type?: string } | null;
  } | null;
}

/**
 * Ask the server to materialize the latest profile-driven plan projection.
 * Evidence writes remain the source of truth; refresh failures must not break
 * the tool that produced the evidence.
 */
export async function refreshLearningPlanAfterEvidence(): Promise<LearningPlanRefreshData | null> {
  try {
    const response = await fetch('/api/sky/learning-plan?view=today', {
      credentials: 'include',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: LearningPlanRefreshData }
      | null;
    if (!response.ok || !payload?.success || !payload.data) return null;
    return payload.data;
  } catch {
    return null;
  }
}
