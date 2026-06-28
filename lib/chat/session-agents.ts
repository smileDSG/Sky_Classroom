import type { SessionType } from '@/lib/types/chat';

export const QA_AGENT_ID = 'default-2';
export const TEACHER_AGENT_ID = 'default-1';

/**
 * Q&A is a direct help flow, not a roundtable discussion. Keep it on a single
 * assistant so the answer does not get split across teacher/student turns.
 */
export function getAgentIdsForSession(
  sessionType: SessionType,
  selectedAgentIds: string[] | undefined,
): string[] {
  if (sessionType === 'qa') {
    return [QA_AGENT_ID];
  }

  if (selectedAgentIds && selectedAgentIds.length > 0) {
    return [...selectedAgentIds];
  }

  return [TEACHER_AGENT_ID];
}

export function getTriggerAgentIdForSession(sessionType: SessionType): string | undefined {
  return sessionType === 'qa' ? QA_AGENT_ID : undefined;
}
