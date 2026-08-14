import { describe, expect, it } from 'vitest';

import { buildAbilityShadowReport } from '@/lib/adaptive-learning/profile/shadow-report-service';
import { buildVirtualShadowFixture } from '@/lib/adaptive-learning/simulation/virtual-shadow-fixture';

describe('virtual student shadow fixture', () => {
  it('feeds 24 simulated chains into Shadow report without storage', () => {
    const fixture = buildVirtualShadowFixture({ runCount: 24, seed: 7 });
    const report = buildAbilityShadowReport(fixture.events, fixture.decisions, fixture.outcomes);

    expect(fixture.source).toBe('simulation');
    expect(fixture.runs).toHaveLength(24);
    expect(report.status).toBe('ready');
    expect(report.eligibleResponses).toBe(24);
    expect(report.outcomes).toMatchObject({
      status: 'ready',
      eligibleOutcomes: 24,
      overall: { sessions: 24 },
      baseline: { sessions: 12 },
      newModel: { sessions: 12 },
    });
    expect(fixture.outcomes.every((outcome) => outcome.userId.startsWith('simulation-user:'))).toBe(
      true,
    );
  });

  it('is reproducible for report inputs with the same seed', () => {
    const first = buildVirtualShadowFixture({ runCount: 20, seed: 11 });
    const second = buildVirtualShadowFixture({ runCount: 20, seed: 11 });

    expect(second.events).toEqual(first.events);
    expect(second.decisions).toEqual(first.decisions);
    expect(second.outcomes).toEqual(first.outcomes);
    expect(buildAbilityShadowReport(second.events, second.decisions, second.outcomes)).toEqual(
      buildAbilityShadowReport(first.events, first.decisions, first.outcomes),
    );
  });

  it('does not require a database or external LLM', () => {
    const fixture = buildVirtualShadowFixture({ runCount: 20 });
    expect(fixture.runs.every((run) => run.modelMode === 'mock')).toBe(true);
    expect(fixture.events.every((event) => event.source === 'virtual-student-shadow')).toBe(true);
  });
});
