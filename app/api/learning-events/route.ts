import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { recordLearningEvent } from '@/lib/adaptive-learning/profile/event-recorder';
import { getCurriculumPack } from '@/lib/adaptive-learning/curriculum/registry';
import {
  learningEventTypeSchema,
  learningEvidenceQualitySchema,
  nodeIdSchema,
} from '@/lib/adaptive-learning/contracts';

const learningEventRequestSchema = z
  .object({
    type: learningEventTypeSchema,
    source: z.string().min(1),
    nodeIds: z.array(nodeIdSchema).optional(),
    evidenceQuality: learningEvidenceQualitySchema,
    payload: z.record(z.string(), z.unknown()),
    correlationId: z.string().min(1).optional(),
  })
  .strict();

function normalizeLabel(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function mapKnowledgePointsToNodeIds(labels: string[]): string[] {
  const pack = getCurriculumPack('gaokao-math-2026.1');
  const nodeByLabel = new Map(
    pack.nodes.flatMap((node) =>
      [node.id, node.name, ...node.aliases].map(
        (label) => [normalizeLabel(label), node.id] as const,
      ),
    ),
  );
  return [...new Set(labels.map((label) => nodeByLabel.get(normalizeLabel(label))))].filter(
    (nodeId): nodeId is string => Boolean(nodeId),
  );
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Request body must be valid JSON');
  }

  const parsed = learningEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'INVALID_REQUEST',
      400,
      'Invalid learning event',
      parsed.error.issues[0]?.message,
    );
  }

  try {
    const storage = await getRequiredServerStorage();
    const preferences = await new LearnerProfileRepository(storage).getLatestPreferences(
      auth.user.id,
    );
    if (!preferences?.privacy.optionalBehaviorSignals) {
      return apiSuccess({ recorded: false, reason: 'behavior-signals-disabled' });
    }

    const knowledgePoints = z
      .array(z.string().min(1))
      .safeParse(parsed.data.payload.knowledgePoints);
    const mappedNodeIds = knowledgePoints.success
      ? mapKnowledgePointsToNodeIds(knowledgePoints.data)
      : [];

    const event = await recordLearningEvent(
      {
        ...parsed.data,
        userId: auth.user.id,
        nodeIds: [...new Set([...(parsed.data.nodeIds ?? []), ...mappedNodeIds])],
      },
      { storage },
    );

    return apiSuccess({ recorded: Boolean(event) });
  } catch {
    // Event collection must never block playback or other learning actions.
    return apiSuccess({ recorded: false });
  }
}
