import { describe, expect, it } from 'vitest';

import {
  getAgentIdsForSession,
  getTriggerAgentIdForSession,
  QA_AGENT_ID,
} from '@/lib/chat/session-agents';

describe('session agent routing', () => {
  it('routes Q&A to a single teaching assistant instead of the selected roundtable agents', () => {
    expect(getAgentIdsForSession('qa', ['default-1', 'default-2', 'default-3'])).toEqual([
      QA_AGENT_ID,
    ]);
    expect(getTriggerAgentIdForSession('qa')).toBe(QA_AGENT_ID);
  });

  it('keeps selected agents for discussion sessions', () => {
    expect(getAgentIdsForSession('discussion', ['default-1', 'default-2', 'default-3'])).toEqual([
      'default-1',
      'default-2',
      'default-3',
    ]);
    expect(getTriggerAgentIdForSession('discussion')).toBeUndefined();
  });
});
