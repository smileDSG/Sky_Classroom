import { createHash } from 'node:crypto';

import {
  governanceReportSchema,
  manualVerificationManifestSchema,
  resourceIndexSchema,
  type GovernanceReport,
  type ManualVerificationManifest,
  type MathResource,
  type MathResourceType,
  type ResourceIndex,
} from '@/lib/adaptive-learning/contracts/resource';
import {
  curriculumPackSchema,
  type CurriculumPack,
} from '@/lib/adaptive-learning/contracts/curriculum';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import type { CrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';
import { detectDuplicateDecisions } from '@/lib/adaptive-learning/resources/duplicate-detector';
import { mapDocumentToCurriculum } from '@/lib/adaptive-learning/resources/mapper';

export interface GovernMathResourcesInput {
  documents: readonly CrawledMathDocument[];
  manifest: ManualVerificationManifest;
  pack: CurriculumPack;
  indexVersion: string;
  now: string;
  scanned: number;
  parseFailures: GovernanceReport['parseFailures'];
}

export interface GovernMathResourcesResult {
  index: ResourceIndex;
  report: GovernanceReport;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function invalidGovernance(
  message: string,
  details: Record<string, unknown>,
  cause?: unknown,
): AdaptiveLearningError {
  return new AdaptiveLearningError({
    code: 'INVALID_SCHEMA',
    message,
    retryable: false,
    stage: 'resource-governance',
    details,
    cause,
  });
}

function parseManifest(input: unknown): ManualVerificationManifest {
  const result = manualVerificationManifestSchema.safeParse(input);
  if (!result.success) {
    throw invalidGovernance('Manual verification manifest failed schema validation', {
      issues: result.error.issues,
    });
  }
  return result.data;
}

function parsePack(input: unknown): CurriculumPack {
  const result = curriculumPackSchema.safeParse(input);
  if (!result.success) {
    throw invalidGovernance('Curriculum pack failed schema validation during resource governance', {
      issues: result.error.issues,
    });
  }
  return result.data;
}

function validateManifestReferences(
  manifest: ManualVerificationManifest,
  pack: CurriculumPack,
  documentsByPath: ReadonlyMap<string, CrawledMathDocument>,
  hardDuplicates: ReadonlyMap<string, { keeperSourcePath: string }>,
): void {
  if (manifest.curriculumPackId !== pack.id) {
    throw invalidGovernance('Manual verification manifest targets a different curriculum pack', {
      curriculumPackId: pack.id,
      manifestCurriculumPackId: manifest.curriculumPackId,
    });
  }

  const nodeIds = new Set(pack.nodes.map((node) => node.id));
  for (const entry of manifest.entries) {
    if (!documentsByPath.has(entry.sourcePath)) {
      throw invalidGovernance('Manual verification entry references an unknown source document', {
        sourcePath: entry.sourcePath,
      });
    }

    if (entry.status !== 'verified') continue;

    for (const nodeId of entry.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        throw invalidGovernance('Verified resource references an unknown curriculum node', {
          sourcePath: entry.sourcePath,
          nodeId,
        });
      }
    }

    const duplicate = hardDuplicates.get(entry.sourcePath);
    if (duplicate) {
      throw invalidGovernance('A hard duplicate cannot be manually verified', {
        sourcePath: entry.sourcePath,
        keeperSourcePath: duplicate.keeperSourcePath,
      });
    }
  }
}

function resourceId(document: CrawledMathDocument): string {
  const digest = createHash('sha256')
    .update(`${document.canonicalUrl}\n${document.contentHash}`)
    .digest('hex')
    .slice(0, 16);
  return `math_${digest}`;
}

function qualityScore(document: CrawledMathDocument): number {
  const url = new URL(document.canonicalUrl);
  const hostname = url.hostname.toLowerCase();
  let score = 0.2;

  if (url.protocol === 'https:') score += 0.15;
  if (document.declaredWordCount >= 300) score += 0.2;
  if (document.declaredWordCount <= 4000) score += 0.1;
  if (/(?:^|\r?\n)\s{0,3}#{1,6}\s+\S/u.test(document.body)) score += 0.15;
  if (hostname === 'mathsisfun.com' || hostname.endsWith('.mathsisfun.com')) score += 0.1;
  if (document.normalizedBody.length >= 300) score += 0.1;

  return Math.round(Math.min(1, score) * 100) / 100;
}

function inferResourceType(normalizedTitle: string): MathResourceType {
  if (normalizedTitle.includes('exercise') || normalizedTitle.includes('activity')) {
    return 'exercise';
  }
  if (normalizedTitle.includes('solution')) return 'solution';
  if (normalizedTitle.includes('example')) return 'worked-example';
  if (normalizedTitle.includes('review') || normalizedTitle.includes('index')) return 'review';
  return 'concept';
}

function excerpt(body: string): string {
  return body.replace(/\s+/gu, ' ').trim().slice(0, 4000);
}

function parseResource(resource: unknown, sourcePath: string): MathResource {
  const result = resourceIndexSchema.shape.resources.element.safeParse(resource);
  if (!result.success) {
    throw invalidGovernance('Governed resource failed schema validation', {
      sourcePath,
      issues: result.error.issues,
    });
  }
  return result.data;
}

function parseIndex(index: unknown): ResourceIndex {
  const result = resourceIndexSchema.safeParse(index);
  if (!result.success) {
    throw invalidGovernance('Resource index failed schema validation', {
      issues: result.error.issues,
    });
  }
  return result.data;
}

function parseReport(report: unknown): GovernanceReport {
  const result = governanceReportSchema.safeParse(report);
  if (!result.success) {
    throw invalidGovernance('Governance report failed schema validation', {
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function governMathResources(input: GovernMathResourcesInput): GovernMathResourcesResult {
  const manifest = parseManifest(input.manifest);
  const pack = parsePack(input.pack);
  const documents = [...input.documents].sort((left, right) =>
    compareText(left.sourcePath, right.sourcePath),
  );
  const documentsByPath = new Map(documents.map((document) => [document.sourcePath, document]));
  const duplicateDecisions = detectDuplicateDecisions(documents);

  validateManifestReferences(manifest, pack, documentsByPath, duplicateDecisions.hardDuplicates);

  const entriesByPath = new Map(manifest.entries.map((entry) => [entry.sourcePath, entry]));
  const resources = documents.map((document) => {
    const mapping = mapDocumentToCurriculum(document, pack);
    const baseNodeIds = mapping.ambiguous
      ? []
      : mapping.candidates.slice(0, 3).map((candidate) => candidate.nodeId);
    const duplicate = duplicateDecisions.hardDuplicates.get(document.sourcePath);
    const verification = entriesByPath.get(document.sourcePath);
    const base = {
      id: resourceId(document),
      sourcePath: document.sourcePath,
      canonicalUrl: document.canonicalUrl,
      title: document.title,
      language: document.language,
      subject: 'math' as const,
      stage: 'senior-high' as const,
      examSystem: 'gaokao' as const,
      nodeIds: baseNodeIds,
      resourceType: inferResourceType(document.normalizedTitle),
      difficulty: 3,
      qualityScore: qualityScore(document),
      contentHash: document.contentHash,
      excerpt: excerpt(document.body),
    };

    if (duplicate) {
      return parseResource(
        {
          ...base,
          status: 'rejected',
          rejectionReasons: [duplicate.reason, `keeper:${duplicate.keeperSourcePath}`],
        },
        document.sourcePath,
      );
    }

    if (verification?.status === 'verified') {
      return parseResource(
        {
          ...base,
          nodeIds: verification.nodeIds,
          resourceType: verification.resourceType,
          difficulty: verification.difficulty,
          status: 'verified',
          verifiedBy: verification.reviewer,
          verifiedAt: verification.reviewedAt,
          rejectionReasons: [],
        },
        document.sourcePath,
      );
    }

    if (verification?.status === 'rejected') {
      return parseResource(
        {
          ...base,
          status: 'rejected',
          rejectionReasons: verification.reasons,
        },
        document.sourcePath,
      );
    }

    const reviewReasons = ['manual_verification_required'];
    if (mapping.ambiguous) reviewReasons.push('ambiguous_curriculum_mapping');
    if (duplicateDecisions.titleCollisions.has(document.sourcePath)) {
      reviewReasons.push('title_collision');
    }

    return parseResource(
      {
        ...base,
        status: 'needs-review',
        rejectionReasons: reviewReasons,
      },
      document.sourcePath,
    );
  });

  const index = parseIndex({
    schemaVersion: '1.0.0',
    indexVersion: input.indexVersion,
    curriculumPackId: pack.id,
    generatedAt: input.now,
    resources,
  });
  const statusCounts = { verified: 0, needsReview: 0, rejected: 0 };
  const reasonCounts: Record<string, number> = {};
  const coveredNodeIds = new Set<string>();

  for (const resource of index.resources) {
    if (resource.status === 'verified') {
      statusCounts.verified += 1;
      resource.nodeIds.forEach((nodeId) => coveredNodeIds.add(nodeId));
    } else if (resource.status === 'needs-review') {
      statusCounts.needsReview += 1;
    } else {
      statusCounts.rejected += 1;
    }

    for (const reason of resource.rejectionReasons) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }
  }

  const report = parseReport({
    schemaVersion: '1.0.0',
    indexVersion: input.indexVersion,
    scanned: input.scanned,
    parsed: documents.length,
    statusCounts,
    reasonCounts,
    parseFailures: [...input.parseFailures].sort(
      (left, right) =>
        compareText(left.sourcePath, right.sourcePath) ||
        compareText(left.code, right.code) ||
        compareText(left.message, right.message),
    ),
    resourceGapNodeIds: pack.nodes
      .map((node) => node.id)
      .filter((nodeId) => !coveredNodeIds.has(nodeId))
      .sort(compareText),
  });

  return { index, report };
}
