import { describe, expect, it, vi } from 'vitest';

import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

vi.mock('@/lib/adaptive-learning/resources/index-builder', () => ({
  buildMathResourceIndex: vi.fn(),
}));

import {
  parseResourceIndexCliArgs,
  runResourceIndexCli,
} from '@/scripts/build-gaokao-math-resource-index';

const argv = [
  '--workspace-root',
  '.',
  '--source-dir',
  'data/crawled/math',
  '--manifest',
  'data/adaptive-learning/gaokao-math/manual-verification.v1.json',
  '--index',
  'data/adaptive-learning/gaokao-math/resource-index.v1.json',
  '--report',
  'data/adaptive-learning/gaokao-math/governance-report.v1.json',
  '--pack',
  'gaokao-math-2026.1',
  '--index-version',
  '2026-07-28.1',
  '--generated-at',
  '2026-07-28T00:00:00.000Z',
];

describe('math resource index CLI', () => {
  it('strictly maps every required option to the builder contract', () => {
    expect(parseResourceIndexCliArgs(argv)).toEqual({
      workspaceRoot: '.',
      sourceDir: 'data/crawled/math',
      manifestPath: 'data/adaptive-learning/gaokao-math/manual-verification.v1.json',
      indexPath: 'data/adaptive-learning/gaokao-math/resource-index.v1.json',
      reportPath: 'data/adaptive-learning/gaokao-math/governance-report.v1.json',
      curriculumPackId: 'gaokao-math-2026.1',
      indexVersion: '2026-07-28.1',
      generatedAt: '2026-07-28T00:00:00.000Z',
    });
  });

  it.each([
    { args: [...argv, '--unknown', 'value'], message: 'unknown option: --unknown' },
    { args: argv.slice(0, -1), message: '--generated-at requires a value' },
    { args: argv.slice(2), message: 'missing required option: --workspace-root' },
    { args: [...argv, '--pack', 'duplicate'], message: 'duplicate option: --pack' },
    { args: ['unexpected', ...argv], message: 'unexpected argument: unexpected' },
    {
      args: ['--workspace-root', '--source-dir', 'data/crawled/math', ...argv.slice(4)],
      message: '--workspace-root requires a value',
    },
  ])('rejects invalid input: $message', ({ args, message }) => {
    expect(() => parseResourceIndexCliArgs(args)).toThrow(message);
  });

  it('builds once and writes a compact success payload to stdout', async () => {
    const build = vi.fn(async () => ({
      report: {
        statusCounts: { verified: 6, needsReview: 12, rejected: 1 },
        resourceGapNodeIds: ['solid-geometry'],
      },
    }));
    const stdout = vi.fn();
    const stderr = vi.fn();

    await expect(runResourceIndexCli(argv, { build, stdout, stderr })).resolves.toBe(0);

    expect(build).toHaveBeenCalledOnce();
    expect(build).toHaveBeenCalledWith(parseResourceIndexCliArgs(argv));
    expect(stdout).toHaveBeenCalledExactlyOnceWith(
      '{"success":true,"statusCounts":{"verified":6,"needsReview":12,"rejected":1},"resourceGapNodeIds":["solid-geometry"]}\n',
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it('preserves AdaptiveLearningError fields in compact stderr JSON', async () => {
    const buildError = new AdaptiveLearningError({
      code: 'INVALID_SCHEMA',
      message: 'manifest is invalid',
      retryable: false,
      stage: 'resource-index-build',
      details: { sourcePath: 'config/manifest.json' },
    });
    const stdout = vi.fn();
    const stderr = vi.fn();

    await expect(
      runResourceIndexCli(argv, {
        build: vi.fn().mockRejectedValue(buildError),
        stdout,
        stderr,
      }),
    ).resolves.toBe(1);

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      '{"success":false,"error":{"code":"INVALID_SCHEMA","message":"manifest is invalid","retryable":false,"stage":"resource-index-build","details":{"sourcePath":"config/manifest.json"}}}\n',
    );
  });

  it('normalizes unknown failures without hiding the original message', async () => {
    const stderr = vi.fn();

    await expect(
      runResourceIndexCli(argv, {
        build: vi.fn().mockRejectedValue(new Error('disk unavailable')),
        stdout: vi.fn(),
        stderr,
      }),
    ).resolves.toBe(1);

    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      '{"success":false,"error":{"code":"RESOURCE_INDEX_UNAVAILABLE","message":"disk unavailable","retryable":false,"stage":"resource-index-cli","details":{}}}\n',
    );
  });
});
