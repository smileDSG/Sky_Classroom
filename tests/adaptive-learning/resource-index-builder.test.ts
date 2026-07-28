import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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
});
