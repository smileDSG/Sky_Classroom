import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import {
  buildMathResourceIndex,
  type BuildMathResourceIndexInput,
  type BuildMathResourceIndexResult,
} from '@/lib/adaptive-learning/resources/index-builder';

const OPTION_FIELDS = {
  '--workspace-root': 'workspaceRoot',
  '--source-dir': 'sourceDir',
  '--manifest': 'manifestPath',
  '--index': 'indexPath',
  '--report': 'reportPath',
  '--pack': 'curriculumPackId',
  '--index-version': 'indexVersion',
  '--generated-at': 'generatedAt',
} as const satisfies Record<string, keyof BuildMathResourceIndexInput>;

type ResourceIndexOption = keyof typeof OPTION_FIELDS;
type ResourceIndexBuild = (
  input: BuildMathResourceIndexInput,
) => Promise<Pick<BuildMathResourceIndexResult, 'report'>>;

export interface ResourceIndexCliDependencies {
  build?: ResourceIndexBuild;
  stdout?: (output: string) => void;
  stderr?: (output: string) => void;
}

function isResourceIndexOption(argument: string): argument is ResourceIndexOption {
  return Object.hasOwn(OPTION_FIELDS, argument);
}

export function parseResourceIndexCliArgs(argv: string[]): BuildMathResourceIndexInput {
  const values: Partial<BuildMathResourceIndexInput> = {};
  const seen = new Set<ResourceIndexOption>();

  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    if (!option.startsWith('--')) {
      throw new Error(`unexpected argument: ${option}`);
    }
    if (!isResourceIndexOption(option)) {
      throw new Error(`unknown option: ${option}`);
    }
    if (seen.has(option)) {
      throw new Error(`duplicate option: ${option}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.trim().length === 0 || value.startsWith('--')) {
      throw new Error(`${option} requires a value`);
    }

    seen.add(option);
    values[OPTION_FIELDS[option]] = value;
  }

  for (const option of Object.keys(OPTION_FIELDS) as ResourceIndexOption[]) {
    if (!seen.has(option)) {
      throw new Error(`missing required option: ${option}`);
    }
  }

  return values as BuildMathResourceIndexInput;
}

function normalizeCliError(cause: unknown): AdaptiveLearningError {
  if (cause instanceof AdaptiveLearningError) return cause;

  return new AdaptiveLearningError({
    code: 'RESOURCE_INDEX_UNAVAILABLE',
    message: cause instanceof Error ? cause.message : String(cause),
    retryable: false,
    stage: 'resource-index-cli',
    details: {},
    cause,
  });
}

export async function runResourceIndexCli(
  argv: string[],
  dependencies: ResourceIndexCliDependencies = {},
): Promise<0 | 1> {
  const stdout = dependencies.stdout ?? ((output) => process.stdout.write(output));
  const stderr = dependencies.stderr ?? ((output) => process.stderr.write(output));

  try {
    const result = await (dependencies.build ?? buildMathResourceIndex)(
      parseResourceIndexCliArgs(argv),
    );
    stdout(
      `${JSON.stringify({
        success: true,
        statusCounts: result.report.statusCounts,
        resourceGapNodeIds: result.report.resourceGapNodeIds,
      })}\n`,
    );
    return 0;
  } catch (cause) {
    const error = normalizeCliError(cause);
    stderr(
      `${JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          stage: error.stage,
          details: error.details ?? {},
        },
      })}\n`,
    );
    return 1;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entryUrl === import.meta.url) {
  void runResourceIndexCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
