import { describe, expect, it } from 'vitest';
import { runPhotoSolverEvaluation } from '../../../evals/photo-solver/runner';
import { OfflineAdapter } from '../../../evals/photo-solver/adapters/offline-adapter';
import { loadPhotoSolverCases } from '../../../evals/photo-solver/dataset-loader';

const file = 'evals/photo-solver/dataset/cases.jsonl';

describe('photo solver runner', () => {
  it('evaluates all 20 offline cases and aggregates groups', async () => {
    const cases = await loadPhotoSolverCases(file);
    const report = await runPhotoSolverEvaluation(cases, new OfflineAdapter(), {
      runMode: 'offline',
      generatedAt: 'fixed',
    });
    expect(report.cases).toHaveLength(20);
    expect(report.aggregate.totalCases).toBe(20);
    expect(report.aggregate.evaluatedCases).toBe(20);
    expect(Object.keys(report.aggregate.byStage).length).toBeGreaterThan(0);
    expect(Object.keys(report.aggregate.bySubject).length).toBeGreaterThan(0);
  });

  it('continues after a single live adapter failure', async () => {
    const cases = (await loadPhotoSolverCases(file)).slice(0, 2);
    const adapter = {
      run: async (c: (typeof cases)[number]) => {
        if (c.id === cases[0].id) throw new Error('boom');
        return new OfflineAdapter().run(c);
      },
    };
    const report = await runPhotoSolverEvaluation(cases, adapter, {
      runMode: 'live',
      generatedAt: 'fixed',
    });
    expect(report.cases[0].status).toBe('error');
    expect(report.cases[1].status).not.toBe('error');
    expect(report.aggregate.errorCases).toBe(1);
  });

  it('records skipped results', async () => {
    const cases = (await loadPhotoSolverCases(file)).slice(0, 1);
    const report = await runPhotoSolverEvaluation(
      cases,
      {
        run: async () => ({
          recognition: {},
          retrievedDocuments: [],
          evidence: [],
          timing: { totalMs: 1 },
          skipped: true,
          skipReason: 'not supported',
        }),
      },
      { runMode: 'offline', generatedAt: 'fixed' },
    );
    expect(report.cases[0].status).toBe('skipped');
    expect(report.aggregate.skippedCases).toBe(1);
  });
});
