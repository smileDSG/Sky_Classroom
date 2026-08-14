import { describe, expect, it } from 'vitest';

import { buildDiagnosticCandidates } from '@/lib/adaptive-learning/profile/diagnostic-candidates';

describe('diagnostic candidates', () => {
  it('uses replay as a diagnostic signal and only propagates suspicion to prerequisites', () => {
    const candidates = buildDiagnosticCandidates({
      signals: [
        {
          eventId: 'replay-1',
          type: 'segment-replayed',
          nodeIds: ['a-star'],
          payload: { replayCount: 3 },
        },
      ],
      edges: [
        { from: 'state-space', to: 'heuristic-search', relation: 'prerequisite' },
        { from: 'heuristic-search', to: 'a-star', relation: 'prerequisite' },
      ],
    });

    expect(candidates[0]).toMatchObject({ nodeId: 'a-star', sourceEventIds: ['replay-1'] });
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'heuristic-search' }),
        expect.objectContaining({ nodeId: 'state-space' }),
      ]),
    );
  });
});
