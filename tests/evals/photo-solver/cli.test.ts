import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { LiveAdapter } from '../../../evals/photo-solver/adapters/live-adapter';
import { parseCliArgs, runPhotoSolverCli } from '../../../evals/photo-solver/cli';
import { loadPhotoSolverCases } from '../../../evals/photo-solver/dataset-loader';

const casesPath = path.resolve('evals/photo-solver/dataset/cases.jsonl');

describe('photo solver evaluation CLI', () => {
  it('defaults to offline mode and writes stable report paths', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'photo-cli-'));
    const summary = await runPhotoSolverCli(['--output-dir', outputDir]);

    expect(summary.mode).toBe('offline');
    expect(summary.totalCases).toBe(20);
    expect(summary.jsonPath).toBe(path.join(outputDir, 'latest.json'));
    expect(summary.markdownPath).toBe(path.join(outputDir, 'latest.md'));
    expect(JSON.parse(await readFile(summary.jsonPath, 'utf8')).runMode).toBe('offline');
  });

  it('uses an injected live adapter without calling a real API', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'photo-cli-live-'));
    const cases = await loadPhotoSolverCases(casesPath);
    const run = vi.fn(async () => ({
      recognition: cases[0].offlineRecognition,
      retrievedDocuments: [],
      answer: cases[0].standardAnswer,
      evidence: [],
      timing: { totalMs: 1 },
    }));

    const summary = await runPhotoSolverCli(
      ['--mode', 'live', '--tag', cases[0].tags[0], '--output-dir', outputDir],
      { createLiveAdapter: () => ({ run }) },
    );

    expect(summary.mode).toBe('live');
    expect(run).toHaveBeenCalled();
  });

  it('resolves manifest image paths from the dataset directory, not the process cwd', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'photo-cli-images-'));
    const imageDir = path.join(dir, 'images');
    const dataset = path.join(dir, 'cases.jsonl');
    const sourceCase = (await loadPhotoSolverCases(casesPath))[0];
    await mkdir(imageDir);
    await writeFile(path.join(imageDir, 'question.png'), 'image');
    await writeFile(
      dataset,
      `${JSON.stringify({ ...sourceCase, imagePath: 'images/question.png', inputText: undefined })}\n`,
    );
    const recognize = vi.fn(async ({ imagePath }: { imagePath: string }) => ({
      recognition: sourceCase.offlineRecognition,
      problemText: '2+2',
      provider: imagePath,
    }));
    const createLiveAdapter = vi.fn(
      (imageBaseDir: string) =>
        new LiveAdapter({
          imageBaseDir,
          recognize,
          solve: async () => ({ answer: sourceCase.standardAnswer }),
        }),
    );

    const summary = await runPhotoSolverCli(
      ['--mode', 'live', '--dataset', dataset, '--output-dir', dir],
      { createLiveAdapter },
    );

    expect(createLiveAdapter).toHaveBeenCalledWith(dir);
    expect(recognize).toHaveBeenCalledWith(
      expect.objectContaining({ imagePath: path.join(dir, 'images/question.png') }),
    );
    expect(summary.skippedCases).toBe(0);
  });

  it('records a live provider failure after three attempts and still writes both reports', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'photo-cli-error-'));
    const dataset = path.join(dir, 'cases.jsonl');
    const sourceCase = { ...(await loadPhotoSolverCases(casesPath))[0], imagePath: undefined };
    await writeFile(dataset, `${JSON.stringify(sourceCase)}\n`);
    const solve = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('provider unavailable'), { status: 503 }));

    const summary = await runPhotoSolverCli(
      ['--mode', 'live', '--dataset', dataset, '--output-dir', dir],
      {
        createLiveAdapter: (imageBaseDir) =>
          new LiveAdapter({ imageBaseDir, solve, sleep: async () => undefined }),
      },
    );
    const report = JSON.parse(await readFile(summary.jsonPath, 'utf8'));
    const markdown = await readFile(summary.markdownPath, 'utf8');

    expect(solve).toHaveBeenCalledTimes(3);
    expect(report.runMode).toBe('live');
    expect(report.aggregate.errorCases).toBe(1);
    expect(report.cases).toEqual([
      expect.objectContaining({
        caseId: sourceCase.id,
        status: 'error',
        failure: 'provider unavailable',
      }),
    ]);
    expect(markdown).toContain('# Photo Solver Evaluation');
    expect(markdown).toContain(`- ${sourceCase.id}: provider unavailable`);
  });

  it('redacts provider secrets from reportable live errors', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'photo-cli-secret-'));
    const dataset = path.join(dir, 'cases.jsonl');
    const sourceCase = { ...(await loadPhotoSolverCases(casesPath))[0], imagePath: undefined };
    await writeFile(dataset, `${JSON.stringify(sourceCase)}\n`);

    const summary = await runPhotoSolverCli(
      ['--mode', 'live', '--dataset', dataset, '--output-dir', dir],
      {
        createLiveAdapter: () =>
          new LiveAdapter({
            solve: async () => {
              throw Object.assign(
                new Error('Authorization: Bearer sk-super-secret-token provider failed'),
                { status: 400 },
              );
            },
          }),
      },
    );
    const serializedReports = `${await readFile(summary.jsonPath, 'utf8')}\n${await readFile(
      summary.markdownPath,
      'utf8',
    )}`;

    expect(serializedReports).toContain('[REDACTED]');
    expect(serializedReports).not.toContain('sk-super-secret-token');
    expect(serializedReports).not.toMatch(/Bearer\s+sk-/i);
  });

  it('passes subject, stage, tag, dataset, and documents options to the pipeline', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'photo-cli-filter-'));
    const sourceCases = await loadPhotoSolverCases(casesPath);
    const selected = sourceCases[0];
    const dataset = path.join(dir, 'cases.jsonl');
    const documents = path.join(dir, 'documents.jsonl');
    await writeFile(dataset, `${JSON.stringify(selected)}\n`, 'utf8');
    await writeFile(documents, '{"id":"unused","content":"unused"}\n', 'utf8');
    const loadCases = vi.fn(loadPhotoSolverCases);
    const createOfflineAdapter = vi.fn(() => ({
      run: async () => ({
        recognition: selected.offlineRecognition,
        retrievedDocuments: [],
        answer: selected.standardAnswer,
        evidence: [],
        timing: { totalMs: 0 },
      }),
    }));

    await runPhotoSolverCli(
      [
        '--subject',
        selected.subject,
        '--stage',
        selected.stage,
        '--tag',
        selected.tags[0],
        '--dataset',
        dataset,
        '--documents',
        documents,
        '--output-dir',
        dir,
      ],
      { loadCases, createOfflineAdapter },
    );

    expect(loadCases).toHaveBeenCalledWith(dataset, {
      subject: selected.subject,
      stage: selected.stage,
      tags: [selected.tags[0]],
    });
    expect(createOfflineAdapter).toHaveBeenCalledWith(documents);
  });

  it.each([
    [['--unknown'], /unknown option/i],
    [['--mode'], /requires a value/i],
    [['--mode', 'other'], /offline.*live/i],
    [['--subject', '--stage', 'x'], /requires a value/i],
  ])('rejects invalid arguments: %j', (args, message) => {
    expect(() => parseCliArgs(args)).toThrow(message);
  });
});

describe('LiveAdapter', () => {
  it('skips a missing image with an explicit reason', async () => {
    const testCase = (await loadPhotoSolverCases(casesPath)).find((item) => item.imagePath)!;
    const adapter = new LiveAdapter({
      recognize: vi.fn(),
      solve: vi.fn(),
      fileExists: async () => false,
    });

    const result = await adapter.run(testCase);

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toMatch(/image.*not found/i);
  });

  it('skips image recognition when the runtime only supports browser execution', async () => {
    const testCase = (await loadPhotoSolverCases(casesPath)).find((item) => item.imagePath)!;
    const recognize = vi.fn();
    const adapter = new LiveAdapter({
      recognize,
      solve: vi.fn(),
      fileExists: async () => true,
      supportsRecognitionApis: () => false,
    });

    const result = await adapter.run(testCase);

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toMatch(/browser-compatible/i);
    expect(recognize).not.toHaveBeenCalled();
  });

  it('retries retryable provider failures up to three attempts then throws', async () => {
    const testCase = {
      ...(await loadPhotoSolverCases(casesPath))[0],
      imagePath: undefined,
      inputText: '2+2',
    };
    const solve = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('rate limit'), { status: 429 }));
    const sleep = vi.fn(async () => undefined);
    const adapter = new LiveAdapter({ solve, sleep });

    await expect(adapter.run(testCase)).rejects.toThrow('rate limit');
    expect(solve).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('times out each provider attempt and retries without waiting for a hanging promise', async () => {
    const testCase = {
      ...(await loadPhotoSolverCases(casesPath))[0],
      imagePath: undefined,
      inputText: '2+2',
    };
    const solve = vi.fn(() => new Promise<never>(() => undefined));
    const adapter = new LiveAdapter({
      solve,
      attemptTimeoutMs: 5,
      sleep: async () => undefined,
    });

    await expect(adapter.run(testCase)).rejects.toThrow(/timed out/i);
    expect(solve).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed recognition output before solve and does not retry contract errors', async () => {
    const testCase = (await loadPhotoSolverCases(casesPath)).find((item) => item.imagePath)!;
    const recognize = vi.fn(async () => ({
      recognition: null,
      problemText: '2+2',
    }));
    const solve = vi.fn();
    const adapter = new LiveAdapter({
      recognize: recognize as never,
      solve,
      fileExists: async () => true,
      supportsRecognitionApis: () => true,
      sleep: async () => undefined,
    });

    await expect(adapter.run(testCase)).rejects.toThrow(/recognition.*contract/i);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(solve).not.toHaveBeenCalled();
  });

  it('does not retry non-retryable failures', async () => {
    const testCase = {
      ...(await loadPhotoSolverCases(casesPath))[0],
      imagePath: undefined,
      inputText: '2+2',
    };
    const solve = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('invalid request'), { status: 400 }));
    const adapter = new LiveAdapter({ solve, sleep: async () => undefined });

    await expect(adapter.run(testCase)).rejects.toThrow('invalid request');
    expect(solve).toHaveBeenCalledTimes(1);
  });

  it('returns schema-valid output without serializing secrets or authorization', async () => {
    const testCase = {
      ...(await loadPhotoSolverCases(casesPath))[0],
      imagePath: undefined,
      inputText: '2+2',
    };
    const adapter = new LiveAdapter({
      solve: async () => ({
        answer: '4',
        evidence: ['addition'],
        usage: { inputTokens: 1, totalTokens: 2 },
        apiKey: 'sk-secret',
        authorization: 'Bearer secret',
      }),
    });

    const result = await adapter.run(testCase);
    const serialized = JSON.stringify(result);

    expect(result.answer).toBe('4');
    expect(serialized).not.toContain('sk-secret');
    expect(serialized.toLowerCase()).not.toContain('authorization');
  });
});
