export interface LearningDecisionContext {
  decisionId: string;
  sessionId: string;
  correlationId: string;
}

export type LearningDecisionPromise = Promise<LearningDecisionContext | null>;

interface CreateDecisionInput {
  sessionId: string;
  action: 'teach' | 'review' | 'quiz' | 'diagnostic';
  topic: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  source: string;
}

export async function createLearningDecision(
  input: CreateDecisionInput,
): Promise<LearningDecisionContext | null> {
  try {
    const response = await fetch('/api/learning-decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = (await response.json()) as {
      success?: boolean;
      decision?: {
        decisionId: string;
        sessionId: string;
        correlationId: string;
      };
    };
    if (!response.ok || !json.success || !json.decision) return null;
    return json.decision;
  } catch {
    return null;
  }
}

export async function reportLearningOutcome(input: {
  decisionId: string;
  windowStart: string;
  windowEnd: string;
  correctCount: number;
  questionCount: number;
  hintsRequested?: number;
  durationSeconds: number;
  completed: boolean;
  exited: boolean;
  errorTypes: string[];
  nextDecisionId?: string | null;
}): Promise<boolean> {
  try {
    const response = await fetch('/api/learning-outcomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        correctRate: input.questionCount > 0 ? input.correctCount / input.questionCount : 0,
        nextDecisionId: input.nextDecisionId ?? null,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function reportLearningEvent(input: {
  type: 'session-exited';
  source: string;
  correlationId?: string;
  payload: {
    decisionId: string;
    durationSeconds: number;
    reason: string;
  };
}): void {
  void fetch('/api/learning-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      type: input.type,
      source: input.source,
      evidenceQuality: 'verified',
      correlationId: input.correlationId,
      payload: input.payload,
    }),
  }).catch(() => undefined);
}
