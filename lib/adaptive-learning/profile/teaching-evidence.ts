import type { KnowledgeState, TeachingProfileProjection } from '@/lib/adaptive-learning/contracts';

import { buildPlanningEvidence } from './planning-evidence';

const MAX_TEACHING_SIGNALS = 5;

export interface BuildTeachingEvidenceInput {
  states: KnowledgeState[];
  eventWatermark: number;
  now?: Date;
}

export interface TeachingEvidence {
  knowledgeStatus: 'ready' | 'no-evidence';
  strengths: TeachingProfileProjection['data']['strengths'];
  growthAreas: TeachingProfileProjection['data']['growthAreas'];
  eventWatermark: number;
}

export function buildTeachingEvidence(input: BuildTeachingEvidenceInput): TeachingEvidence {
  const projected = buildPlanningEvidence({
    states: input.states,
    events: [],
    now: input.now,
  }).targetKnowledge;
  const repeatedErrorsByNode = new Map(
    input.states.map((state) => [state.nodeId, state.repeatedErrorCount]),
  );
  const strengths = projected
    .filter(
      (signal) => signal.mastery >= 0.8 && signal.retention >= 0.7 && signal.confidence >= 0.4,
    )
    .sort((left, right) => right.mastery - left.mastery)
    .slice(0, MAX_TEACHING_SIGNALS)
    .map(({ nodeId, mastery, confidence, reasonCodes }) => ({
      nodeId,
      mastery,
      confidence,
      reasonCodes,
    }));
  const growthAreas = projected
    .filter(
      (signal) =>
        signal.mastery < 0.6 ||
        signal.retention < 0.7 ||
        signal.confidence < 0.4 ||
        (repeatedErrorsByNode.get(signal.nodeId) ?? 0) >= 2,
    )
    .slice(0, MAX_TEACHING_SIGNALS)
    .map(({ nodeId, mastery, confidence, reasonCodes }) => ({
      nodeId,
      mastery,
      confidence,
      reasonCodes,
    }));

  return {
    knowledgeStatus: input.states.length > 0 ? 'ready' : 'no-evidence',
    strengths,
    growthAreas,
    eventWatermark: input.eventWatermark,
  };
}
