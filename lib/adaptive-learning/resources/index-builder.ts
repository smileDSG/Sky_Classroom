import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  manualVerificationManifestSchema,
  type GovernanceReport,
  type ManualVerificationManifest,
  type ResourceIndex,
} from '@/lib/adaptive-learning/contracts/resource';
import { getCurriculumPack } from '@/lib/adaptive-learning/curriculum/registry';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { parseCrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';
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
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
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
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(entryPath);
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
): Promise<void> {
  await Promise.all([
    mkdir(path.dirname(indexPath), { recursive: true }),
    mkdir(path.dirname(reportPath), { recursive: true }),
  ]);
  const suffix = `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const indexTemp = `${indexPath}${suffix}`;
  const reportTemp = `${reportPath}${suffix}`;

  try {
    await writeFile(reportTemp, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await writeFile(indexTemp, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    await rename(reportTemp, reportPath);
    await rename(indexTemp, indexPath);
  } catch (cause) {
    await Promise.allSettled([rm(reportTemp, { force: true }), rm(indexTemp, { force: true })]);
    throw buildError(
      'RESOURCE_INDEX_UNAVAILABLE',
      'Resource index artifacts could not be published',
      {
        indexPath,
        reportPath,
      },
      cause,
    );
  }
}

export async function buildMathResourceIndex(
  input: BuildMathResourceIndexInput,
): Promise<BuildMathResourceIndexResult> {
  const paths = resolveBuildPaths(input);
  const sourceFiles = await scanMarkdownFiles(paths.sourceDir);
  if (sourceFiles.length === 0) {
    throw buildError('INVALID_SCHEMA', 'Resource source directory contains no Markdown files', {
      sourceDir: paths.sourceDir,
    });
  }

  const documents = [];
  const parseFailures: GovernanceReport['parseFailures'] = [];
  for (const filePath of sourceFiles) {
    const sourcePath = workspaceRelative(paths.workspaceRoot, filePath);
    try {
      const markdown = await readFile(filePath, 'utf8');
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

  await writeArtifacts(paths.indexPath, paths.reportPath, index, report);
  return { index, report, indexPath: paths.indexPath, reportPath: paths.reportPath };
}
