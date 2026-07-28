import 'server-only';

import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  manualVerificationManifestSchema,
  type GovernanceReport,
  type ManualVerificationManifest,
  type ResourceIndex,
} from '@/lib/adaptive-learning/contracts/resource';
import { getCurriculumPack } from '@/lib/adaptive-learning/curriculum/registry';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import {
  parseCrawledMathDocument,
  type CrawledMathDocument,
} from '@/lib/adaptive-learning/resources/crawled-document';
import { governMathResources } from '@/lib/adaptive-learning/resources/governance';

export interface BuildMathResourceIndexInput {
  workspaceRoot: string;
  sourceDir: string;
  manifestPath: string;
  indexPath: string;
  reportPath: string;
  curriculumPackId: string;
  indexVersion: string;
  generatedAt: string;
}

export interface BuildMathResourceIndexResult {
  index: ResourceIndex;
  report: GovernanceReport;
  indexPath: string;
  reportPath: string;
}

export interface BuildMathResourceIndexDependencies {
  readSourceFile?: (filePath: string) => Promise<string>;
  renameFile?: (sourcePath: string, targetPath: string) => Promise<void>;
}

interface ResolvedBuildPaths {
  workspaceRoot: string;
  sourceDir: string;
  manifestPath: string;
  indexPath: string;
  reportPath: string;
}

function buildError(
  code: 'INVALID_SCHEMA' | 'RESOURCE_INDEX_UNAVAILABLE',
  message: string,
  details: Record<string, unknown>,
  cause?: unknown,
): AdaptiveLearningError {
  return new AdaptiveLearningError({
    code,
    message,
    retryable: false,
    stage: 'resource-index-build',
    details,
    cause,
  });
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function resolveWithin(workspaceRoot: string, value: string, field: string): string {
  if (!value?.trim()) {
    throw buildError('INVALID_SCHEMA', `${field} is required`, { field, value });
  }
  const resolved = path.resolve(workspaceRoot, value);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw buildError('INVALID_SCHEMA', `${field} must stay within the workspace`, {
      field,
      value,
      workspaceRoot,
      resolvedPath: resolved,
    });
  }
  return resolved;
}

function resolveBuildPaths(input: BuildMathResourceIndexInput): ResolvedBuildPaths {
  if (!input.workspaceRoot?.trim()) {
    throw buildError('INVALID_SCHEMA', 'workspaceRoot is required', {
      field: 'workspaceRoot',
      value: input.workspaceRoot,
    });
  }
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const resolved = {
    workspaceRoot,
    sourceDir: resolveWithin(workspaceRoot, input.sourceDir, 'sourceDir'),
    manifestPath: resolveWithin(workspaceRoot, input.manifestPath, 'manifestPath'),
    indexPath: resolveWithin(workspaceRoot, input.indexPath, 'indexPath'),
    reportPath: resolveWithin(workspaceRoot, input.reportPath, 'reportPath'),
  };
  const comparable = [resolved.manifestPath, resolved.indexPath, resolved.reportPath].map((value) =>
    value.toLocaleLowerCase('en-US'),
  );
  if (new Set(comparable).size !== comparable.length) {
    throw buildError('INVALID_SCHEMA', 'Manifest, index, and report paths must be distinct', {
      manifestPath: resolved.manifestPath,
      indexPath: resolved.indexPath,
      reportPath: resolved.reportPath,
    });
  }
  return resolved;
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return !(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative));
}

async function validateFilesystemBoundaries(paths: ResolvedBuildPaths): Promise<void> {
  let realWorkspaceRoot: string;
  let realSourceDir: string;
  let realManifestPath: string;
  try {
    [realWorkspaceRoot, realSourceDir, realManifestPath] = await Promise.all([
      realpath(paths.workspaceRoot),
      realpath(paths.sourceDir),
      realpath(paths.manifestPath),
    ]);
  } catch (cause) {
    throw buildError(
      'RESOURCE_INDEX_UNAVAILABLE',
      'Workspace, source directory, or manifest is unavailable',
      {
        workspaceRoot: paths.workspaceRoot,
        sourceDir: paths.sourceDir,
        manifestPath: paths.manifestPath,
      },
      cause,
    );
  }

  for (const [field, candidate] of [
    ['sourceDir', realSourceDir],
    ['manifestPath', realManifestPath],
  ] as const) {
    if (!isWithin(realWorkspaceRoot, candidate)) {
      throw buildError('INVALID_SCHEMA', `${field} resolves outside the workspace`, {
        field,
        workspaceRoot: realWorkspaceRoot,
        resolvedPath: candidate,
      });
    }
  }

  const outputParents = [path.dirname(paths.indexPath), path.dirname(paths.reportPath)];
  try {
    await Promise.all(outputParents.map((directory) => mkdir(directory, { recursive: true })));
    const realOutputParents = await Promise.all(
      outputParents.map((directory) => realpath(directory)),
    );
    for (const candidate of realOutputParents) {
      if (!isWithin(realWorkspaceRoot, candidate)) {
        throw buildError('INVALID_SCHEMA', 'Output parent resolves outside the workspace', {
          workspaceRoot: realWorkspaceRoot,
          resolvedPath: candidate,
        });
      }
    }
  } catch (cause) {
    if (cause instanceof AdaptiveLearningError) throw cause;
    throw buildError(
      'RESOURCE_INDEX_UNAVAILABLE',
      'Output directories are unavailable',
      {
        indexPath: paths.indexPath,
        reportPath: paths.reportPath,
      },
      cause,
    );
  }
}

async function scanMarkdownFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    throw buildError(
      'RESOURCE_INDEX_UNAVAILABLE',
      'Resource source directory is unavailable',
      {
        sourceDir: directory,
      },
      cause,
    );
  }

  const files: string[] = [];
  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await scanMarkdownFiles(entryPath)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(entryPath);
  }
  return files.sort(compareText);
}

async function readManifest(manifestPath: string): Promise<ManualVerificationManifest> {
  let source: string;
  try {
    source = await readFile(manifestPath, 'utf8');
  } catch (cause) {
    throw buildError(
      'RESOURCE_INDEX_UNAVAILABLE',
      'Manual verification manifest is unavailable',
      {
        manifestPath,
      },
      cause,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (cause) {
    throw buildError(
      'INVALID_SCHEMA',
      'Manual verification manifest contains invalid JSON',
      {
        manifestPath,
      },
      cause,
    );
  }

  const parsed = manualVerificationManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw buildError('INVALID_SCHEMA', 'Manual verification manifest failed schema validation', {
      manifestPath,
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

function workspaceRelative(workspaceRoot: string, filePath: string): string {
  return path.relative(workspaceRoot, filePath).replace(/\\/gu, '/');
}

async function writeArtifacts(
  indexPath: string,
  reportPath: string,
  index: ResourceIndex,
  report: GovernanceReport,
  renameFile: (sourcePath: string, targetPath: string) => Promise<void>,
): Promise<void> {
  await Promise.all([
    mkdir(path.dirname(indexPath), { recursive: true }),
    mkdir(path.dirname(reportPath), { recursive: true }),
  ]);
  const suffix = `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const indexTemp = `${indexPath}${suffix}`;
  const reportTemp = `${reportPath}${suffix}`;
  const indexBackup = `${indexPath}${suffix}.backup`;
  const reportBackup = `${reportPath}${suffix}.backup`;
  let indexBackedUp = false;
  let reportBackedUp = false;
  let indexPublished = false;
  let reportPublished = false;

  try {
    await writeFile(reportTemp, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await writeFile(indexTemp, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    try {
      if ((await lstat(reportPath)).isFile()) {
        await renameFile(reportPath, reportBackup);
        reportBackedUp = true;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
      if ((await lstat(indexPath)).isFile()) {
        await renameFile(indexPath, indexBackup);
        indexBackedUp = true;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await renameFile(reportTemp, reportPath);
    reportPublished = true;
    await renameFile(indexTemp, indexPath);
    indexPublished = true;
    await Promise.all([
      reportBackedUp ? rm(reportBackup, { force: true }) : Promise.resolve(),
      indexBackedUp ? rm(indexBackup, { force: true }) : Promise.resolve(),
    ]);
  } catch (cause) {
    const rollbackFailures: string[] = [];
    const recoveryBackupPaths: string[] = [];
    for (const [published, target] of [
      [indexPublished, indexPath],
      [reportPublished, reportPath],
    ] as const) {
      if (!published) continue;
      try {
        await rm(target, { force: true });
      } catch (error) {
        rollbackFailures.push(error instanceof Error ? error.message : String(error));
      }
    }
    for (const [backedUp, backup, target] of [
      [indexBackedUp, indexBackup, indexPath],
      [reportBackedUp, reportBackup, reportPath],
    ] as const) {
      if (!backedUp) continue;
      try {
        await renameFile(backup, target);
      } catch (error) {
        rollbackFailures.push(error instanceof Error ? error.message : String(error));
        recoveryBackupPaths.push(backup);
      }
    }
    await Promise.allSettled([rm(reportTemp, { force: true }), rm(indexTemp, { force: true })]);
    throw buildError(
      'RESOURCE_INDEX_UNAVAILABLE',
      'Resource index artifacts could not be published',
      {
        indexPath,
        reportPath,
        rollbackFailures,
        recoveryBackupPaths,
      },
      cause,
    );
  }
}

export async function buildMathResourceIndex(
  input: BuildMathResourceIndexInput,
  dependencies: BuildMathResourceIndexDependencies = {},
): Promise<BuildMathResourceIndexResult> {
  const paths = resolveBuildPaths(input);
  await validateFilesystemBoundaries(paths);
  const sourceFiles = await scanMarkdownFiles(paths.sourceDir);
  if (sourceFiles.length === 0) {
    throw buildError('INVALID_SCHEMA', 'Resource source directory contains no Markdown files', {
      sourceDir: paths.sourceDir,
    });
  }

  const documents: CrawledMathDocument[] = [];
  const parseFailures: GovernanceReport['parseFailures'] = [];
  for (const filePath of sourceFiles) {
    const sourcePath = workspaceRelative(paths.workspaceRoot, filePath);
    let markdown: string;
    try {
      markdown = await (dependencies.readSourceFile ?? ((target) => readFile(target, 'utf8')))(
        filePath,
      );
    } catch (cause) {
      throw buildError(
        'RESOURCE_INDEX_UNAVAILABLE',
        'Resource source file could not be read',
        {
          sourcePath,
          filePath,
        },
        cause,
      );
    }
    try {
      documents.push(parseCrawledMathDocument(sourcePath, markdown));
    } catch (cause) {
      const error = cause as Partial<AdaptiveLearningError> & Error;
      parseFailures.push({
        sourcePath,
        code: typeof error.code === 'string' ? error.code : 'RESOURCE_READ_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (parseFailures.length > 0) {
    throw buildError('INVALID_SCHEMA', 'One or more resource documents failed strict parsing', {
      scanned: sourceFiles.length,
      parseFailures,
    });
  }

  const manifest = await readManifest(paths.manifestPath);
  const pack = getCurriculumPack(input.curriculumPackId);
  const { index, report } = governMathResources({
    documents,
    manifest,
    pack,
    indexVersion: input.indexVersion,
    now: input.generatedAt,
    scanned: sourceFiles.length,
    parseFailures: [],
  });

  await writeArtifacts(
    paths.indexPath,
    paths.reportPath,
    index,
    report,
    dependencies.renameFile ?? rename,
  );
  return { index, report, indexPath: paths.indexPath, reportPath: paths.reportPath };
}
