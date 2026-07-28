import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { buildMathResourceIndex } from '@/lib/adaptive-learning/resources/index-builder';

function markdown(title: string, originalUrl: string): string {
  return `---
title: "${title}"
source: "https://publisher.example/math"
originalUrl: "${originalUrl}"
course: "math"
tags: ["math"]
wordCount: 120
depth: 1
crawledAt: "2026-07-28T08:00:00.000Z"
---

${'Derivative and function lesson content with sufficient detail. '.repeat(3)}`;
}

async function workspace() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'math-index-builder-'));
  await mkdir(path.join(workspaceRoot, 'sources'), { recursive: true });
  await mkdir(path.join(workspaceRoot, 'config'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'config/manifest.json'),
    `${JSON.stringify({
      schemaVersion: '1.0.0',
      curriculumPackId: 'gaokao-math-2026.1',
      entries: [],
    })}\n`,
    'utf8',
  );
  return workspaceRoot;
}

function options(workspaceRoot: string) {
  return {
    workspaceRoot,
    sourceDir: 'sources',
    manifestPath: 'config/manifest.json',
    indexPath: 'output/resource-index.json',
    reportPath: 'output/governance-report.json',
    curriculumPackId: 'gaokao-math-2026.1',
    indexVersion: '2026-07-28.1',
    generatedAt: '2026-07-28T00:00:00.000Z',
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function captureBuildError(error: unknown): AdaptiveLearningError {
  expect(error).toBeInstanceOf(AdaptiveLearningError);
  const adaptiveError = error as AdaptiveLearningError;
  expect(adaptiveError.retryable).toBe(false);
  expect(adaptiveError.stage).toBe('resource-index-build');
  return adaptiveError;
}

describe('strict math resource index builder', () => {
  it('recursively builds byte-identical sorted artifacts with report before runtime index', async () => {
    const root = await workspace();
    await mkdir(path.join(root, 'sources/nested'));
    await writeFile(
      path.join(root, 'sources/z.md'),
      markdown('Derivative review', 'https://example.com/z'),
    );
    await writeFile(
      path.join(root, 'sources/nested/a.md'),
      markdown('What is a function', 'https://example.com/a'),
    );
    await writeFile(path.join(root, 'sources/ignored.txt'), 'not markdown');

    const first = await buildMathResourceIndex(options(root));
    const indexBytes = await readFile(first.indexPath, 'utf8');
    const reportBytes = await readFile(first.reportPath, 'utf8');
    const second = await buildMathResourceIndex(options(root));

    expect(await readFile(second.indexPath, 'utf8')).toBe(indexBytes);
    expect(await readFile(second.reportPath, 'utf8')).toBe(reportBytes);
    expect(indexBytes.endsWith('\n')).toBe(true);
    expect(reportBytes.endsWith('\n')).toBe(true);
    expect(first.index.resources.map((resource) => resource.sourcePath)).toEqual([
      'sources/nested/a.md',
      'sources/z.md',
    ]);
    expect(first.report).toMatchObject({ scanned: 2, parsed: 2, parseFailures: [] });
  });

  it('collects every parse failure and publishes neither artifact', async () => {
    const root = await workspace();
    await writeFile(path.join(root, 'sources/a.md'), 'invalid a');
    await writeFile(path.join(root, 'sources/b.md'), 'invalid b');
    const input = options(root);

    let error: AdaptiveLearningError | undefined;
    try {
      await buildMathResourceIndex(input);
    } catch (cause) {
      error = captureBuildError(cause);
    }

    expect(error).toMatchObject({ code: 'INVALID_SCHEMA' });
    expect(error?.details?.parseFailures).toEqual([
      expect.objectContaining({ sourcePath: 'sources/a.md', code: 'INVALID_SCHEMA' }),
      expect.objectContaining({ sourcePath: 'sources/b.md', code: 'INVALID_SCHEMA' }),
    ]);
    expect(await exists(path.join(root, input.indexPath))).toBe(false);
    expect(await exists(path.join(root, input.reportPath))).toBe(false);
  });

  it('rejects escaped and colliding paths before writing', async () => {
    const root = await workspace();
    await writeFile(
      path.join(root, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/source'),
    );

    for (const input of [
      { ...options(root), indexPath: '../escaped.json' },
      { ...options(root), reportPath: 'config/manifest.json' },
      { ...options(root), reportPath: 'output/resource-index.json' },
    ]) {
      await expect(buildMathResourceIndex(input)).rejects.toMatchObject({
        code: 'INVALID_SCHEMA',
        retryable: false,
        stage: 'resource-index-build',
      });
    }
  });

  it('rejects empty sources and distinguishes missing from malformed manifests', async () => {
    const emptyRoot = await workspace();
    await expect(buildMathResourceIndex(options(emptyRoot))).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
      stage: 'resource-index-build',
    });

    const missingRoot = await workspace();
    await writeFile(
      path.join(missingRoot, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/source'),
    );
    await expect(
      buildMathResourceIndex({ ...options(missingRoot), manifestPath: 'config/missing.json' }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_INDEX_UNAVAILABLE',
      stage: 'resource-index-build',
    });

    await writeFile(path.join(missingRoot, 'config/manifest.json'), '{bad json', 'utf8');
    await expect(buildMathResourceIndex(options(missingRoot))).rejects.toMatchObject({
      code: 'INVALID_SCHEMA',
      stage: 'resource-index-build',
    });
  });

  it('rejects source, manifest, and output parents that escape through filesystem links', async (context) => {
    const root = await workspace();
    const outside = await mkdtemp(path.join(tmpdir(), 'math-index-outside-'));
    await mkdir(path.join(outside, 'sources'));
    await mkdir(path.join(outside, 'config'));
    await mkdir(path.join(outside, 'output'));
    await writeFile(
      path.join(outside, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/outside'),
    );
    await writeFile(
      path.join(outside, 'config/manifest.json'),
      `${JSON.stringify({
        schemaVersion: '1.0.0',
        curriculumPackId: 'gaokao-math-2026.1',
        entries: [],
      })}\n`,
    );
    await writeFile(
      path.join(root, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/inside'),
    );

    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      await symlink(path.join(outside, 'sources'), path.join(root, 'linked-sources'), linkType);
      await symlink(path.join(outside, 'config'), path.join(root, 'linked-config'), linkType);
      await symlink(path.join(outside, 'output'), path.join(root, 'linked-output'), linkType);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES' || code === 'ENOTSUP') {
        context.skip(`OS denied directory link creation (${code})`);
        return;
      }
      throw error;
    }

    for (const input of [
      { ...options(root), sourceDir: 'linked-sources' },
      { ...options(root), manifestPath: 'linked-config/manifest.json' },
      {
        ...options(root),
        indexPath: 'linked-output/missing/nested/index.json',
        reportPath: 'linked-output/missing/nested/report.json',
      },
    ]) {
      await expect(buildMathResourceIndex(input)).rejects.toMatchObject({
        code: 'INVALID_SCHEMA',
        stage: 'resource-index-build',
      });
    }
    expect(await exists(path.join(outside, 'output/missing'))).toBe(false);
  });

  it('rolls back a newly published report when the runtime index rename fails', async () => {
    const root = await workspace();
    const input = options(root);
    await writeFile(
      path.join(root, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/source'),
    );
    await mkdir(path.join(root, input.indexPath), { recursive: true });

    await expect(buildMathResourceIndex(input)).rejects.toMatchObject({
      code: 'RESOURCE_INDEX_UNAVAILABLE',
      stage: 'resource-index-build',
    });
    expect(await exists(path.join(root, input.reportPath))).toBe(false);
    expect((await stat(path.join(root, input.indexPath))).isDirectory()).toBe(true);
  });

  it('reports source read I/O failures immediately instead of aggregating them as parse failures', async () => {
    const root = await workspace();
    const input = options(root);
    await writeFile(
      path.join(root, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/source'),
    );

    await expect(
      buildMathResourceIndex(input, {
        readSourceFile: async () => {
          throw Object.assign(new Error('read denied'), { code: 'EACCES' });
        },
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_INDEX_UNAVAILABLE',
      stage: 'resource-index-build',
      details: expect.objectContaining({ sourcePath: 'sources/source.md' }),
    });
    expect(await exists(path.join(root, input.indexPath))).toBe(false);
    expect(await exists(path.join(root, input.reportPath))).toBe(false);
  });

  it('preserves a recoverable backup when publication and backup restoration both fail', async () => {
    const root = await workspace();
    const input = options(root);
    await writeFile(
      path.join(root, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/source'),
    );
    await buildMathResourceIndex(input);
    const indexPath = path.join(root, input.indexPath);
    const reportPath = path.join(root, input.reportPath);
    const previousIndex = await readFile(indexPath, 'utf8');
    const previousReport = await readFile(reportPath, 'utf8');
    await writeFile(
      path.join(root, 'sources/second.md'),
      markdown('Function', 'https://example.com/second'),
    );

    let error: AdaptiveLearningError | undefined;
    try {
      await buildMathResourceIndex(input, {
        renameFile: async (source, target) => {
          if (target === indexPath && source.includes('.tmp-') && !source.endsWith('.backup')) {
            throw new Error('index publish failed');
          }
          await rename(source, target);
        },
        copyBackup: async (source, target) => {
          if (target === reportPath && source.endsWith('.backup')) {
            throw new Error('report restore failed');
          }
          await copyFile(source, target);
        },
      });
    } catch (cause) {
      error = captureBuildError(cause);
    }

    expect(error).toMatchObject({ code: 'RESOURCE_INDEX_UNAVAILABLE' });
    const recoveryBackupPaths = error?.details?.recoveryBackupPaths as string[];
    expect(recoveryBackupPaths).toHaveLength(1);
    expect(recoveryBackupPaths[0]).toContain(path.basename(reportPath));
    expect(await readFile(recoveryBackupPaths[0], 'utf8')).toBe(previousReport);
    expect(await readFile(indexPath, 'utf8')).toBe(previousIndex);
    expect(await exists(reportPath)).toBe(false);
  });

  it('keeps the prior artifact pair when the final index publish fails', async () => {
    const root = await workspace();
    const input = options(root);
    await writeFile(
      path.join(root, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/source'),
    );
    await buildMathResourceIndex(input);
    const indexPath = path.join(root, input.indexPath);
    const reportPath = path.join(root, input.reportPath);
    const previousIndex = await readFile(indexPath, 'utf8');
    const previousReport = await readFile(reportPath, 'utf8');
    await writeFile(
      path.join(root, 'sources/second.md'),
      markdown('Function', 'https://example.com/second'),
    );

    await expect(
      buildMathResourceIndex(input, {
        renameFile: async (source, target) => {
          if (target === indexPath && source.includes('.tmp-') && !source.endsWith('.backup')) {
            throw new Error('index publish failed');
          }
          await rename(source, target);
        },
        copyBackup: copyFile,
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_INDEX_UNAVAILABLE' });

    expect(await readFile(indexPath, 'utf8')).toBe(previousIndex);
    expect(await readFile(reportPath, 'utf8')).toBe(previousReport);
  });

  it('keeps committed outputs and an undeleted backup when post-commit cleanup fails', async () => {
    const root = await workspace();
    const input = options(root);
    await writeFile(
      path.join(root, 'sources/source.md'),
      markdown('Derivative', 'https://example.com/source'),
    );
    await buildMathResourceIndex(input);
    await writeFile(
      path.join(root, 'sources/second.md'),
      markdown('Function', 'https://example.com/second'),
    );
    const indexPath = path.join(root, input.indexPath);
    const reportPath = path.join(root, input.reportPath);

    let error: AdaptiveLearningError | undefined;
    try {
      await buildMathResourceIndex(input, {
        removeFile: async (target, options) => {
          if (target.includes(path.basename(reportPath)) && target.endsWith('.backup')) {
            throw new Error('report backup cleanup failed');
          }
          await rm(target, options);
        },
      });
    } catch (cause) {
      error = captureBuildError(cause);
    }

    expect(error).toMatchObject({ code: 'RESOURCE_INDEX_UNAVAILABLE' });
    const leftoverBackupPaths = error?.details?.leftoverBackupPaths as string[];
    expect(leftoverBackupPaths).toHaveLength(1);
    expect(await exists(leftoverBackupPaths[0])).toBe(true);
    expect(JSON.parse(await readFile(indexPath, 'utf8')).resources).toHaveLength(2);
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).toMatchObject({ scanned: 2, parsed: 2 });
  });
});
