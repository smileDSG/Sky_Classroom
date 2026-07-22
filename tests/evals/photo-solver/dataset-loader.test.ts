import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadPhotoSolverCases } from '../../../evals/photo-solver/dataset-loader';

const validCase = {
  id: 'high-physics-001',
  mode: 'real',
  stage: '高中',
  subject: '物理',
  questionType: '选择题',
  imagePath: 'images/missing.png',
  expectedProblemSpec: { stem: '测试题' },
  offlineRecognition: { stem: '测试题' },
  standardAnswer: 'B',
  answerAliases: ['B', '选项B'],
  goldDocumentIds: ['physics-001'],
  requiredEvidence: ['机械能守恒'],
  shouldReject: false,
  tags: ['clear', 'formula'],
} as const;

async function writeJsonl(lines: string[]): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'photo-solver-dataset-'));
  const filePath = path.join(directory, 'cases.jsonl');
  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

describe('loadPhotoSolverCases', () => {
  it('loads valid JSONL records', async () => {
    const filePath = await writeJsonl([JSON.stringify(validCase)]);

    const cases = await loadPhotoSolverCases(filePath);

    expect(cases).toEqual([validCase]);
  });

  it('reports required-field validation errors with file and line', async () => {
    const { id: _id, ...withoutId } = validCase;
    const filePath = await writeJsonl([JSON.stringify(withoutId)]);

    await expect(loadPhotoSolverCases(filePath)).rejects.toThrow(
      new RegExp(`${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:1.*id`, 's'),
    );
  });

  it('reports JSON syntax errors with file and line', async () => {
    const filePath = await writeJsonl([JSON.stringify(validCase), '{not json}']);

    await expect(loadPhotoSolverCases(filePath)).rejects.toThrow(`${filePath}:2`);
  });

  it('rejects duplicate case ids', async () => {
    const filePath = await writeJsonl([JSON.stringify(validCase), JSON.stringify(validCase)]);

    await expect(loadPhotoSolverCases(filePath)).rejects.toThrow(
      new RegExp(
        `${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:2.*duplicate.*high-physics-001`,
        'i',
      ),
    );
  });

  it('allows a real case whose image path does not exist', async () => {
    const filePath = await writeJsonl([JSON.stringify(validCase)]);

    await expect(loadPhotoSolverCases(filePath)).resolves.toHaveLength(1);
  });

  it.each([
    ['empty strings', '', ''],
    ['whitespace-only strings', '  ', '\t'],
  ])('rejects %s as the only case inputs', async (_label, imagePath, inputText) => {
    const filePath = await writeJsonl([JSON.stringify({ ...validCase, imagePath, inputText })]);

    await expect(loadPhotoSolverCases(filePath)).rejects.toThrow(/imagePath|inputText/);
  });

  it('filters by mode, subject, stage, and tags', async () => {
    const matching = { ...validCase, id: 'matching' };
    const wrongMode = { ...validCase, id: 'wrong-mode', mode: 'synthetic' };
    const wrongSubject = { ...validCase, id: 'wrong-subject', subject: '数学' };
    const wrongStage = { ...validCase, id: 'wrong-stage', stage: '大学' };
    const wrongTags = { ...validCase, id: 'wrong-tags', tags: ['clear'] };
    const filePath = await writeJsonl(
      [matching, wrongMode, wrongSubject, wrongStage, wrongTags].map((item) =>
        JSON.stringify(item),
      ),
    );

    const cases = await loadPhotoSolverCases(filePath, {
      mode: 'real',
      subject: '物理',
      stage: '高中',
      tags: ['clear', 'formula'],
    });

    expect(cases.map((item) => item.id)).toEqual(['matching']);
  });
});
