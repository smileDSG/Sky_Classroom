import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { evaluationReportSchema, type EvaluationReport } from '../types';

async function writeReport(
  report: EvaluationReport,
  options: { outputDir: string },
): Promise<{ jsonPath: string; markdownPath: string }> {
  const valid = evaluationReportSchema.parse(report);
  if (!options.outputDir?.trim()) throw new Error('outputDir is required');
  const outputDir = resolve(options.outputDir);
  try {
    if (!(await stat(outputDir)).isDirectory()) throw new Error('outputDir must be a directory');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, 'latest.json'),
    markdownPath = join(outputDir, 'latest.md');
  const groups = (title: string, values: Record<string, Record<string, number>>) => [
    `## ${title}`,
    '',
    ...Object.keys(values)
      .sort()
      .flatMap((k) => [
        `### ${k}`,
        ...Object.entries(values[k])
          .sort()
          .map(([m, v]) => `- ${m}: ${v}`),
      ]),
    '',
  ];
  const details = valid.cases.map(
    (c) =>
      `### ${c.caseId}\n- status: ${c.status}\n- latencyMs: ${c.latencyMs}\n- recognition: ${JSON.stringify(c.recognition)}\n- retrieval: ${JSON.stringify(c.retrieval)}\n- answer: ${JSON.stringify(c.answer)}\n- usage: ${JSON.stringify(c.tokenUsage ?? {})}`,
  );
  const md = [
    '# Photo Solver Evaluation',
    '## Overview',
    '',
    ...Object.entries(valid.aggregate.metrics)
      .sort()
      .map(([k, v]) => `- ${k}: ${v}`),
    '',
    ...groups('By Stage', valid.aggregate.byStage),
    ...groups('By Subject', valid.aggregate.bySubject),
    ...groups('By Tag', valid.aggregate.byTag),
    '## Failures',
    '',
    ...valid.cases
      .filter((c) => c.status === 'failed' || c.status === 'error')
      .map((c) => `- ${c.caseId}: ${c.failure ?? 'metric threshold not met'}`),
    '',
    '## Skipped',
    '',
    ...valid.cases
      .filter((c) => c.status === 'skipped')
      .map((c) => `- ${c.caseId}: ${c.skipReason ?? 'unspecified'}`),
    '',
    '## Cases',
    '',
    ...details,
    '',
  ].join('\n');
  const stamp = `.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`,
    jsonTemp = join(outputDir, stamp + '.json'),
    mdTemp = join(outputDir, stamp + '.md');
  try {
    await writeFile(jsonTemp, JSON.stringify(valid, null, 2) + '\n');
    await writeFile(mdTemp, md);
    await rename(jsonTemp, jsonPath);
    await rename(mdTemp, markdownPath);
  } catch (error) {
    await Promise.allSettled([rm(jsonTemp, { force: true }), rm(mdTemp, { force: true })]);
    throw error;
  }
  return { jsonPath, markdownPath };
}

let writeQueue: Promise<unknown> = Promise.resolve();
export function writeEvaluationReport(
  report: EvaluationReport,
  options: { outputDir: string },
): Promise<{ jsonPath: string; markdownPath: string }> {
  const operation = writeQueue.then(() => writeReport(report, options));
  writeQueue = operation.catch(() => undefined);
  return operation;
}
