import { describe, expect, it } from 'vitest';
import {
  curriculumNodeSchema,
  curriculumPackSchema,
  mathResourceSchema,
  manualVerificationManifestSchema,
  mathResourceQuerySchema,
} from '@/lib/adaptive-learning/contracts';

const node = {
  id: 'derivative-concept',
  version: '2026.1',
  subject: 'math',
  stage: 'senior-high',
  name: '导数概念',
  aliases: ['导数', 'derivative'],
  description: '理解导数作为瞬时变化率和切线斜率。',
  prerequisiteIds: ['functions-properties'],
  relatedIds: ['derivative-applications'],
  examWeight: 0.1,
  defaultStabilityDays: 7,
  commonErrorCodes: ['derivative_definition_confusion'],
  activityTypes: ['learn', 'worked-example', 'practice', 'review', 'diagnostic'],
};

describe('adaptive learning curriculum and resource contracts', () => {
  it('accepts a strict curriculum node and pack', () => {
    expect(curriculumNodeSchema.parse(node).id).toBe('derivative-concept');
    expect(
      curriculumPackSchema.parse({
        id: 'gaokao-math-2026.1',
        version: '2026.1',
        title: '2026 高考数学最小课程包',
        subject: 'math',
        stage: 'senior-high',
        examSystem: 'gaokao',
        examYear: 2026,
        nodes: [node],
      }).nodes,
    ).toHaveLength(1);
  });

  it('rejects unknown fields and cross-subject resources', () => {
    expect(() => curriculumNodeSchema.parse({ ...node, unknown: true })).toThrow();
    expect(() =>
      mathResourceSchema.parse({
        id: 'math_1234567890abcdef',
        sourcePath: 'data/crawled/math/example.md',
        canonicalUrl: 'https://example.com/math',
        title: 'Example',
        language: 'en',
        subject: 'biology',
        stage: 'senior-high',
        examSystem: 'gaokao',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        qualityScore: 0.9,
        contentHash: 'a'.repeat(64),
        excerpt: 'A valid mathematical explanation.',
        status: 'verified',
        verifiedBy: 'reviewer-1',
        verifiedAt: '2026-07-28T00:00:00.000Z',
        rejectionReasons: [],
      }),
    ).toThrow();
  });

  it('requires verification metadata for verified resources', () => {
    expect(() =>
      mathResourceSchema.parse({
        id: 'math_1234567890abcdef',
        sourcePath: 'data/crawled/math/example.md',
        canonicalUrl: 'https://example.com/math',
        title: 'Example',
        language: 'en',
        subject: 'math',
        stage: 'senior-high',
        examSystem: 'gaokao',
        nodeIds: ['derivative-concept'],
        resourceType: 'concept',
        difficulty: 3,
        qualityScore: 0.9,
        contentHash: 'a'.repeat(64),
        excerpt: 'A valid mathematical explanation.',
        status: 'verified',
        rejectionReasons: [],
      }),
    ).toThrow();
  });

  it('validates manual verification and query coercion', () => {
    const manifest = manualVerificationManifestSchema.parse({
      schemaVersion: '1.0.0',
      curriculumPackId: 'gaokao-math-2026.1',
      entries: [
        {
          sourcePath: 'data/crawled/math/example.md',
          status: 'verified',
          nodeIds: ['derivative-concept'],
          resourceType: 'concept',
          difficulty: 3,
          reviewer: 'reviewer-1',
          reviewedAt: '2026-07-28T00:00:00.000Z',
          notes: 'Checked against the source.',
        },
      ],
    });
    expect(manifest.entries).toHaveLength(1);
    expect(mathResourceQuerySchema.parse({ maxDifficulty: '4', limit: '20' })).toEqual({
      maxDifficulty: 4,
      limit: 20,
    });
  });
});
