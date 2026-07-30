import { curriculumPackSchema } from '@/lib/adaptive-learning/contracts/curriculum';
import type { CurriculumPack } from '@/lib/adaptive-learning/contracts/curriculum';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

const EXAM_WEIGHT_TOLERANCE = 1e-9;

function throwValidationError(message: string, details: Record<string, unknown>): never {
  throw new AdaptiveLearningError({
    code: 'INVALID_SCHEMA',
    message,
    retryable: false,
    stage: 'curriculum-validation',
    details,
  });
}

function normalizeLabel(label: string): string {
  return label.normalize('NFKC').trim().toLowerCase();
}

function validatePrerequisiteDag(pack: CurriculumPack): void {
  const prerequisitesByNodeId = new Map(pack.nodes.map((node) => [node.id, node.prerequisiteIds]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) {
      return;
    }

    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = [...path.slice(cycleStart), nodeId];
      throwValidationError(`Curriculum prerequisite cycle detected: ${cycle.join(' -> ')}`, {
        cycle,
      });
    }

    visiting.add(nodeId);
    path.push(nodeId);

    for (const prerequisiteId of prerequisitesByNodeId.get(nodeId) ?? []) {
      visit(prerequisiteId);
    }

    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of pack.nodes) {
    visit(node.id);
  }
}

export function validateCurriculumPack(input: unknown): CurriculumPack {
  const result = curriculumPackSchema.safeParse(input);

  if (!result.success) {
    throwValidationError('Invalid curriculum pack schema', {
      issues: result.error.issues,
    });
  }

  const pack = result.data;
  const nodeIds = new Set<string>();

  for (const node of pack.nodes) {
    if (nodeIds.has(node.id)) {
      throwValidationError(`Curriculum node id must be unique: ${node.id}`, {
        nodeId: node.id,
      });
    }
    nodeIds.add(node.id);
  }

  for (const node of pack.nodes) {
    const references = [
      ...(node.parentId ? [{ field: 'parentId', id: node.parentId }] : []),
      ...node.prerequisiteIds.map((id) => ({ field: 'prerequisiteIds', id })),
      ...node.relatedIds.map((id) => ({ field: 'relatedIds', id })),
    ];

    for (const reference of references) {
      if (!nodeIds.has(reference.id)) {
        throwValidationError(
          `Curriculum node "${node.id}" has a missing-node reference "${reference.id}" in ${reference.field}`,
          {
            nodeId: node.id,
            field: reference.field,
            referencedNodeId: reference.id,
          },
        );
      }
    }
  }

  const labelsByNormalizedValue = new Map<string, string>();
  for (const node of pack.nodes) {
    for (const label of [node.name, ...node.aliases]) {
      const normalizedLabel = normalizeLabel(label);
      const existingNodeId = labelsByNormalizedValue.get(normalizedLabel);

      if (existingNodeId && existingNodeId !== node.id) {
        throwValidationError(
          `Curriculum alias collision for "${normalizedLabel}" across nodes "${existingNodeId}" and "${node.id}"`,
          {
            normalizedAlias: normalizedLabel,
            nodeIds: [existingNodeId, node.id],
          },
        );
      }

      labelsByNormalizedValue.set(normalizedLabel, node.id);
    }
  }

  const totalExamWeight = pack.nodes.reduce((total, node) => total + node.examWeight, 0);
  if (Math.abs(totalExamWeight - 1) > EXAM_WEIGHT_TOLERANCE) {
    throwValidationError(`Curriculum exam weights must sum to 1; received ${totalExamWeight}`, {
      totalExamWeight,
    });
  }

  validatePrerequisiteDag(pack);

  return pack;
}
