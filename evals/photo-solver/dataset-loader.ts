import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { type PhotoSolverCase, type PhotoSolverCaseFilters, photoSolverCaseSchema } from './types';

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
    .join('; ');
}

function matchesFilters(testCase: PhotoSolverCase, filters: PhotoSolverCaseFilters): boolean {
  return (
    (filters.mode === undefined || testCase.mode === filters.mode) &&
    (filters.stage === undefined || testCase.stage === filters.stage) &&
    (filters.subject === undefined || testCase.subject === filters.subject) &&
    (filters.tags === undefined || filters.tags.every((tag) => testCase.tags.includes(tag)))
  );
}

export async function loadPhotoSolverCases(
  filePath: string,
  filters: PhotoSolverCaseFilters = {},
): Promise<PhotoSolverCase[]> {
  const contents = await readFile(filePath, 'utf8');
  const cases: PhotoSolverCase[] = [];
  const seenIds = new Set<string>();

  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) continue;

    let rawRecord: unknown;
    try {
      rawRecord = JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${filePath}:${lineNumber}: invalid JSON: ${message}`);
    }

    const result = photoSolverCaseSchema.safeParse(rawRecord);
    if (!result.success) {
      throw new Error(
        `${filePath}:${lineNumber}: invalid evaluation case: ${formatIssues(result.error)}`,
      );
    }

    if (seenIds.has(result.data.id)) {
      throw new Error(`${filePath}:${lineNumber}: duplicate case id "${result.data.id}"`);
    }
    seenIds.add(result.data.id);

    if (matchesFilters(result.data, filters)) cases.push(result.data);
  }

  return cases;
}
