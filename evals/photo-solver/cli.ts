import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { LiveAdapter } from './adapters/live-adapter';
import { OfflineAdapter } from './adapters/offline-adapter';
import type { PhotoSolverAdapter } from './adapters/types';
import { loadPhotoSolverCases } from './dataset-loader';
import { writeEvaluationReport } from './report/report-writer';
import { runPhotoSolverEvaluation } from './runner';
import type { PhotoSolverCaseFilters } from './types';

export interface CliOptions {
  mode: 'offline' | 'live';
  subject?: string;
  stage?: string;
  tags: string[];
  dataset: string;
  documents: string;
  outputDir: string;
}

export interface CliDependencies {
  loadCases?: typeof loadPhotoSolverCases;
  createOfflineAdapter?: (documentsPath: string) => PhotoSolverAdapter;
  createLiveAdapter?: () => PhotoSolverAdapter;
  runEvaluation?: typeof runPhotoSolverEvaluation;
  writeReport?: typeof writeEvaluationReport;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '../..');

function requireValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
  return value;
}

export function parseCliArgs(args: string[]): CliOptions {
  const knownOptions = new Set([
    '--mode',
    '--subject',
    '--stage',
    '--tag',
    '--dataset',
    '--documents',
    '--output-dir',
  ]);
  const options: CliOptions = {
    mode: 'offline',
    tags: [],
    dataset: path.join(repoRoot, 'evals/photo-solver/dataset/cases.jsonl'),
    documents: path.join(repoRoot, 'evals/photo-solver/dataset/documents.jsonl'),
    outputDir: path.join(repoRoot, 'evals/photo-solver/reports'),
  };
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (!option.startsWith('--')) throw new Error(`unexpected argument: ${option}`);
    if (!knownOptions.has(option)) throw new Error(`unknown option: ${option}`);
    const value = requireValue(args, index, option);
    index++;
    switch (option) {
      case '--mode':
        if (value !== 'offline' && value !== 'live') {
          throw new Error('--mode must be offline or live');
        }
        options.mode = value;
        break;
      case '--subject':
        options.subject = value;
        break;
      case '--stage':
        options.stage = value;
        break;
      case '--tag':
        options.tags.push(value);
        break;
      case '--dataset':
        options.dataset = path.resolve(value);
        break;
      case '--documents':
        options.documents = path.resolve(value);
        break;
      case '--output-dir':
        options.outputDir = path.resolve(value);
        break;
    }
  }
  return options;
}

export async function runPhotoSolverCli(args: string[], dependencies: CliDependencies = {}) {
  const options = parseCliArgs(args);
  const filters: PhotoSolverCaseFilters = {
    subject: options.subject,
    stage: options.stage,
    tags: options.tags.length ? options.tags : undefined,
  };
  const cases = await (dependencies.loadCases ?? loadPhotoSolverCases)(options.dataset, filters);
  const adapter =
    options.mode === 'live'
      ? (dependencies.createLiveAdapter ?? (() => new LiveAdapter()))()
      : (dependencies.createOfflineAdapter ?? ((documents) => new OfflineAdapter(documents)))(
          options.documents,
        );
  const report = await (dependencies.runEvaluation ?? runPhotoSolverEvaluation)(cases, adapter, {
    runMode: options.mode,
    filters: {
      subject: options.subject,
      stage: options.stage,
      tags: options.tags.length ? options.tags : undefined,
    },
  });
  const paths = await (dependencies.writeReport ?? writeEvaluationReport)(report, {
    outputDir: options.outputDir,
  });
  return {
    mode: options.mode,
    totalCases: report.aggregate.totalCases,
    passedCases: report.aggregate.passedCases,
    failedCases: report.aggregate.failedCases + report.aggregate.errorCases,
    skippedCases: report.aggregate.skippedCases,
    ...paths,
  };
}

async function main() {
  const summary = await runPhotoSolverCli(process.argv.slice(2));
  console.log(
    `photo-solver ${summary.mode}: ${summary.totalCases} cases, ${summary.passedCases} passed, ${summary.failedCases} failed, ${summary.skippedCases} skipped`,
  );
  console.log(`reports: ${summary.jsonPath}, ${summary.markdownPath}`);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entry === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
