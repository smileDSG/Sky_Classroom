import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeEvaluationReport } from '../../../evals/photo-solver/report/report-writer';
import { runPhotoSolverEvaluation } from '../../../evals/photo-solver/runner';
import { OfflineAdapter } from '../../../evals/photo-solver/adapters/offline-adapter';
import { loadPhotoSolverCases } from '../../../evals/photo-solver/dataset-loader';

describe('report writer', () => {
  it('writes deterministic JSON and markdown atomically, creating directory', async () => {
    const report = await runPhotoSolverEvaluation(
      (await loadPhotoSolverCases('evals/photo-solver/dataset/cases.jsonl')).slice(0, 1),
      new OfflineAdapter(),
      { runMode: 'offline', generatedAt: 'fixed' },
    );
    const dir = await mkdtemp(join(tmpdir(), 'photo-report-'));
    const first = await writeEvaluationReport(report, { outputDir: join(dir, 'nested') });
    const json1 = await readFile(first.jsonPath, 'utf8');
    const md = await readFile(first.markdownPath, 'utf8');
    const second = await writeEvaluationReport(report, { outputDir: join(dir, 'nested') });
    expect(await readFile(second.jsonPath, 'utf8')).toBe(json1);
    expect(md).toContain('Overview');
    expect(md).toContain(report.cases[0].caseId);
  });
});
