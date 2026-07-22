import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evaluationReportSchema, type EvaluationReport } from '../types';
export async function writeEvaluationReport(
  report: EvaluationReport,
  options: { outputDir: string },
): Promise<{ jsonPath: string; markdownPath: string }> {
  const valid = evaluationReportSchema.parse(report);
  await mkdir(options.outputDir, { recursive: true });
  const jsonPath = join(options.outputDir, 'latest.json'),
    markdownPath = join(options.outputDir, 'latest.md');
  const groups = (title: string, values: Record<string, Record<string, number>>) => [
    `## ${title}`,
    '',
    ...Object.keys(values)
      .sort()
      .map((k) => `- ${k}`),
    '',
  ];
  const md = [
    '# Photo Solver Evaluation',
    '## Overview',
    '',
    `- Total: ${valid.aggregate.totalCases}`,
    `- Passed: ${valid.aggregate.passedCases}`,
    `- Failed: ${valid.aggregate.failedCases}`,
    `- Skipped: ${valid.aggregate.skippedCases}`,
    '',
    ...groups('By Stage', valid.aggregate.byStage),
    ...groups('By Subject', valid.aggregate.bySubject),
    ...groups('By Tag', valid.aggregate.byTag),
    '## Cases',
    '',
    ...valid.cases.map(
      (c) =>
        `- ${c.caseId}: ${c.status}${c.failure ? ` — ${c.failure}` : ''}${c.skipReason ? ` — ${c.skipReason}` : ''}`,
    ),
    '',
  ].join('\n');
  const stamp = '.tmp-' + process.pid;
  await writeFile(join(options.outputDir, stamp + '.json'), JSON.stringify(valid, null, 2) + '\n');
  await writeFile(join(options.outputDir, stamp + '.md'), md);
  await rename(join(options.outputDir, stamp + '.json'), jsonPath);
  await rename(join(options.outputDir, stamp + '.md'), markdownPath);
  return { jsonPath, markdownPath };
}
