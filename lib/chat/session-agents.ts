import type { SessionType } from '@/lib/types/chat';

export const QA_AGENT_ID = 'default-2';
export const QA_STUDENT_AGENT_ID = 'default-3';
export const TEACHER_AGENT_ID = 'default-1';

/**
 * Q&A answers come from the single assistant, but a student agent joins the
 * turn so the classroom feels interactive (assistant answers, then a student
 * chimes in with a follow-up question). Keeping it to one student avoids the
 * answer being drowned out by a full roundtable.
 */
export function getAgentIdsForSession(
  sessionType: SessionType,
  selectedAgentIds: string[] | undefined,
): string[] {
  if (sessionType === 'qa') {
    return [QA_AGENT_ID, QA_STUDENT_AGENT_ID];
  }

  if (selectedAgentIds && selectedAgentIds.length > 0) {
    return [...selectedAgentIds];
  }

  return [TEACHER_AGENT_ID];
}

export function getTriggerAgentIdForSession(sessionType: SessionType): string | undefined {
  return sessionType === 'qa' ? QA_AGENT_ID : undefined;
}
