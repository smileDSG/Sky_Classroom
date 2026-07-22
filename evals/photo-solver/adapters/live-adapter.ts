import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  adapterResultSchema,
  type AdapterResult,
  type PhotoSolverCase,
  type RecognitionResult,
} from '../types';
import type { PhotoSolverAdapter } from './types';

type UnknownRecord = Record<string, unknown>;

export interface LiveRecognitionOutput {
  recognition: RecognitionResult;
  problemText: string;
  problemImage?: string;
  provider?: string;
}

export interface LiveSolveOutput {
  answer?: string;
  evidence?: string[];
  retrievedDocuments?: Array<{ id: string; content?: string; score?: number }>;
  usage?: AdapterResult['usage'];
  provider?: string;
  [key: string]: unknown;
}

export interface LiveAdapterOptions {
  recognize?: (input: {
    imagePath: string;
    testCase: PhotoSolverCase;
  }) => Promise<LiveRecognitionOutput>;
  solve?: (input: {
    problem: string;
    problemImage?: string;
    recognition: RecognitionResult;
    testCase: PhotoSolverCase;
  }) => Promise<LiveSolveOutput>;
  fileExists?: (filePath: string) => Promise<boolean>;
  sleep?: (milliseconds: number) => Promise<void>;
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function defaultFileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRetryable(error: unknown): boolean {
  const record = error as UnknownRecord;
  const status = Number(record?.status ?? record?.statusCode);
  const code = String(record?.code ?? '').toUpperCase();
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH'].includes(code)
  );
}

async function withRetries<T>(
  operation: () => Promise<T>,
  sleep: LiveAdapterOptions['sleep'],
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error) || attempt === 3) throw error;
      await (sleep ?? defaultSleep)(100 * 2 ** (attempt - 1));
    }
  }
  throw new Error('unreachable retry state');
}

async function serverRecognize(input: {
  imagePath: string;
  testCase: PhotoSolverCase;
}): Promise<LiveRecognitionOutput> {
  if (typeof Blob === 'undefined' || typeof FormData === 'undefined') {
    throw Object.assign(new Error('server recognition requires Node Blob and FormData APIs'), {
      code: 'BROWSER_ONLY_API',
    });
  }
  const bytes = await readFile(input.imagePath);
  const extension = path.extname(input.imagePath).toLowerCase();
  const mimeType = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'image/png';
  const body = new FormData();
  body.append('image', new Blob([bytes], { type: mimeType }), path.basename(input.imagePath));
  const { POST } = await import('../../../app/api/sky/solve/recognize/route');
  const response = await POST(
    new Request('http://localhost/api/sky/solve/recognize', { method: 'POST', body }),
  );
  const payload = (await response.json()) as UnknownRecord;
  if (!response.ok) {
    throw Object.assign(
      new Error(String(payload.message ?? payload.error ?? 'recognition failed')),
      {
        status: response.status,
      },
    );
  }
  const data = (payload.data ?? {}) as UnknownRecord;
  const structured = Array.isArray(data.structuredProblems)
    ? data.structuredProblems[0]
    : undefined;
  const recognition = (
    structured && typeof structured === 'object' ? structured : { stem: String(data.text ?? '') }
  ) as RecognitionResult;
  return {
    recognition,
    problemText: String(data.text ?? recognition.stem ?? ''),
    problemImage: `data:${mimeType};base64,${bytes.toString('base64')}`,
    provider: typeof data.usedModel === 'string' ? data.usedModel : undefined,
  };
}

async function serverSolve(input: {
  problem: string;
  problemImage?: string;
  recognition: RecognitionResult;
}): Promise<LiveSolveOutput> {
  const { buildSolveInitialState, createSolveGraph } =
    await import('../../../lib/solve/solve-graph');
  const graph = createSolveGraph();
  const state = await graph.invoke(
    buildSolveInitialState(input.problem, input.problemImage, null, input.recognition as never),
  );
  if (state.error) throw new Error(state.error);
  const output = state.fourPartOutput;
  return {
    answer: output?.answer ?? state.solution ?? undefined,
    evidence: [
      ...(output?.steps ?? []).map((step) =>
        typeof step === 'string' ? step : JSON.stringify(step),
      ),
      ...(output?.knowledgePoints ?? []).map((point) => point.name),
    ],
  };
}

export class LiveAdapter implements PhotoSolverAdapter {
  private readonly recognize: NonNullable<LiveAdapterOptions['recognize']>;
  private readonly solve: NonNullable<LiveAdapterOptions['solve']>;
  private readonly fileExists: NonNullable<LiveAdapterOptions['fileExists']>;
  private readonly sleep: NonNullable<LiveAdapterOptions['sleep']>;

  constructor(options: LiveAdapterOptions = {}) {
    this.recognize = options.recognize ?? serverRecognize;
    this.solve = options.solve ?? serverSolve;
    this.fileExists = options.fileExists ?? defaultFileExists;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async run(testCase: PhotoSolverCase): Promise<AdapterResult> {
    const started = performance.now();
    let recognition = testCase.offlineRecognition;
    let problem = testCase.inputText;
    let problemImage: string | undefined;
    let recognitionMs = 0;

    if (testCase.imagePath) {
      const imagePath = path.resolve(testCase.imagePath);
      if (!(await this.fileExists(imagePath))) {
        return adapterResultSchema.parse({
          recognition,
          retrievedDocuments: [],
          evidence: [],
          timing: { totalMs: performance.now() - started },
          skipped: true,
          skipReason: `image not found: ${testCase.imagePath}`,
        });
      }
      if (typeof Blob === 'undefined' || typeof FormData === 'undefined') {
        return adapterResultSchema.parse({
          recognition,
          retrievedDocuments: [],
          evidence: [],
          timing: { totalMs: performance.now() - started },
          skipped: true,
          skipReason: 'recognition requires browser-compatible Blob and FormData APIs',
        });
      }
      const recognitionStarted = performance.now();
      const recognized = await withRetries(
        () => this.recognize({ imagePath, testCase }),
        this.sleep,
      );
      recognitionMs = performance.now() - recognitionStarted;
      recognition = recognized.recognition;
      problem = recognized.problemText;
      problemImage = recognized.problemImage;
    }

    if (!problem?.trim()) {
      return adapterResultSchema.parse({
        recognition,
        retrievedDocuments: [],
        evidence: [],
        timing: { recognitionMs, totalMs: performance.now() - started },
        skipped: true,
        skipReason: 'recognition produced no problem text',
      });
    }

    const generationStarted = performance.now();
    const solved = await withRetries(
      () => this.solve({ problem, problemImage, recognition, testCase }),
      this.sleep,
    );
    const generationMs = performance.now() - generationStarted;

    return adapterResultSchema.parse({
      recognition,
      retrievedDocuments: solved.retrievedDocuments ?? [],
      answer: solved.answer,
      evidence: solved.evidence ?? [],
      timing: {
        recognitionMs,
        retrievalMs: 0,
        generationMs,
        totalMs: performance.now() - started,
      },
      usage: solved.usage,
      skipped: false,
    });
  }
}
