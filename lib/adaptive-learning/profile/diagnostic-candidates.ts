/**
 * Turns ambiguous learning behaviour into ranked diagnostic candidates.
 *
 * Scores are intentionally not mastery evidence. A candidate must be checked
 * by a verified answer before KnowledgeState can change.
 */

const PREREQUISITE_DECAY = 0.4;
const MAX_PREREQUISITE_DEPTH = 2;

export interface DiagnosticSignal {
  eventId: string;
  type:
    | 'segment-replayed'
    | 'segment-paused'
    | 'dwell-recorded'
    | 'question-asked'
    | 'self-reported';
  nodeIds: string[];
  payload: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface DiagnosticCandidate {
  nodeId: string;
  suspicionScore: number;
  sourceEventIds: string[];
  reasonCodes: string[];
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function signalWeight(signal: DiagnosticSignal): number {
  switch (signal.type) {
    case 'segment-replayed':
      return 0.15 * Math.min(Number(signal.payload.replayCount) || 0, 3);
    case 'segment-paused':
      return clamp((Number(signal.payload.activeDurationSeconds) || 0) / 180, 0, 0.25);
    case 'dwell-recorded': {
      const active = Number(signal.payload.activeDurationSeconds) || 0;
      const baseline = Number(signal.payload.baselineDurationSeconds) || 0;
      return baseline > 0 ? 0.3 * clamp(active / baseline - 1) : 0;
    }
    case 'question-asked':
      return 0.25;
    case 'self-reported':
      return signal.payload.level === 'confused' ? 0.5 : 0;
  }
}

interface MutableCandidate extends DiagnosticCandidate {
  sourceEventIds: string[];
  reasonCodes: string[];
}

function addCandidate(
  candidates: Map<string, MutableCandidate>,
  nodeId: string,
  score: number,
  eventId: string,
  reasonCode: string,
): void {
  if (score <= 0) return;
  const previous = candidates.get(nodeId) ?? {
    nodeId,
    suspicionScore: 0,
    sourceEventIds: [],
    reasonCodes: [],
  };
  previous.suspicionScore = clamp(previous.suspicionScore + score);
  if (!previous.sourceEventIds.includes(eventId)) previous.sourceEventIds.push(eventId);
  if (!previous.reasonCodes.includes(reasonCode)) previous.reasonCodes.push(reasonCode);
  candidates.set(nodeId, previous);
}

function prerequisiteAncestors(nodeId: string, edges: KnowledgeGraphEdge[]): Array<{ nodeId: string; depth: number }> {
  const result: Array<{ nodeId: string; depth: number }> = [];
  const visited = new Set([nodeId]);
  let frontier = [nodeId];

  for (let depth = 1; depth <= MAX_PREREQUISITE_DEPTH; depth++) {
    const next = edges
      .filter((edge) => edge.relation === 'prerequisite' && frontier.includes(edge.to))
      .map((edge) => edge.from)
      .filter((candidate) => !visited.has(candidate));
    for (const candidate of next) {
      visited.add(candidate);
      result.push({ nodeId: candidate, depth });
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return result;
}

export function buildDiagnosticCandidates(input: {
  signals: DiagnosticSignal[];
  edges: KnowledgeGraphEdge[];
}): DiagnosticCandidate[] {
  const candidates = new Map<string, MutableCandidate>();

  for (const signal of input.signals) {
    const weight = signalWeight(signal);
    for (const nodeId of signal.nodeIds) {
      addCandidate(candidates, nodeId, weight, signal.eventId, `signal:${signal.type}`);
      for (const ancestor of prerequisiteAncestors(nodeId, input.edges)) {
        addCandidate(
          candidates,
          ancestor.nodeId,
          weight * PREREQUISITE_DECAY ** ancestor.depth,
          signal.eventId,
          `prerequisite-of:${nodeId}`,
        );
      }
    }
  }

  return [...candidates.values()].sort(
    (left, right) =>
      right.suspicionScore - left.suspicionScore || left.nodeId.localeCompare(right.nodeId),
  );
}
