import {
  learnerPreferencesInputSchema,
  learnerPreferencesSchema,
  type LearnerPreferences,
  type LearnerPreferencesInput,
} from '@/lib/adaptive-learning/contracts';

const PROFILE_ENDPOINT = '/api/user/learner-profile';
const LEARNING_EVENTS_ENDPOINT = '/api/learning-events';

export class LearnerProfileClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'LearnerProfileClientError';
  }
}

export function createInitialLearnerPreferences(): LearnerPreferencesInput {
  return {
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['worked-example', 'diagram'],
    explanationDepth: 'standard',
    learningPace: 'standard',
    stepByStepMode: 'when-needed',
    interactionTone: 'encouraging',
    assistantName: '小智',
    preferenceNotes: '',
    privacy: {
      conversationMemory: 'session',
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: false,
    },
  };
}

export function toLearnerPreferencesInput(
  preferences: LearnerPreferences,
): LearnerPreferencesInput {
  return {
    preferredLanguage: preferences.preferredLanguage,
    contentFormatPreferences: [...preferences.contentFormatPreferences],
    explanationDepth: preferences.explanationDepth,
    learningPace: preferences.learningPace,
    stepByStepMode: preferences.stepByStepMode,
    interactionTone: preferences.interactionTone,
    assistantName: preferences.assistantName,
    preferenceNotes: preferences.preferenceNotes,
    privacy: { ...preferences.privacy },
  };
}

function readError(payload: unknown, status: number): LearnerProfileClientError {
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    const errorEnvelope =
      body.error && typeof body.error === 'object'
        ? (body.error as Record<string, unknown>)
        : undefined;
    const code =
      typeof errorEnvelope?.code === 'string'
        ? errorEnvelope.code
        : typeof body.errorCode === 'string'
          ? body.errorCode
          : 'INTERNAL_ERROR';
    const message =
      typeof errorEnvelope?.message === 'string'
        ? errorEnvelope.message
        : typeof body.error === 'string'
          ? body.error
          : 'Learner profile request failed';
    return new LearnerProfileClientError(code, message, status);
  }

  return new LearnerProfileClientError(
    'INVALID_PROFILE_RESPONSE',
    'Learner profile response was not valid JSON',
    status,
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new LearnerProfileClientError(
      'INVALID_PROFILE_RESPONSE',
      'Learner profile response was not valid JSON',
      response.status,
    );
  }
}

function parsePreferences(payload: unknown, status: number): LearnerPreferences {
  if (!payload || typeof payload !== 'object') {
    throw new LearnerProfileClientError(
      'INVALID_PROFILE_RESPONSE',
      'Learner profile response was incomplete',
      status,
    );
  }

  const body = payload as Record<string, unknown>;
  if (body.success !== true) {
    throw new LearnerProfileClientError(
      'INVALID_PROFILE_RESPONSE',
      'Learner profile success envelope was invalid',
      status,
    );
  }

  const parsed = learnerPreferencesSchema.safeParse(body.preferences);
  if (!parsed.success) {
    throw new LearnerProfileClientError(
      'INVALID_PROFILE_RESPONSE',
      'Learner profile response failed schema validation',
      status,
    );
  }

  return parsed.data;
}

export async function loadLearnerPreferences(): Promise<LearnerPreferences> {
  const response = await fetch(PROFILE_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  const payload = await parseJson(response);

  if (!response.ok) throw readError(payload, response.status);
  return parsePreferences(payload, response.status);
}

export async function saveLearnerPreferences(input: {
  expectedVersion: number;
  preferences: LearnerPreferencesInput;
}): Promise<LearnerPreferences> {
  const preferences = learnerPreferencesInputSchema.parse(input.preferences);
  const response = await fetch(PROFILE_ENDPOINT, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      expectedVersion: input.expectedVersion,
      preferences,
    }),
  });
  const payload = await parseJson(response);

  if (!response.ok) throw readError(payload, response.status);
  return parsePreferences(payload, response.status);
}

/** Record optional behaviour evidence without blocking the primary UI action. */
export type LearnerBehaviorEventInput = {
  source: string;
  nodeIds?: string[];
  correlationId?: string;
} & (
  | {
      type: 'segment-replayed';
      payload: { replayCount: number; knowledgePoints?: string[] };
    }
  | {
      type: 'segment-paused';
      payload: { activeDurationSeconds: number; knowledgePoints?: string[] };
    }
  | {
      type: 'dwell-recorded';
      payload: {
        activeDurationSeconds: number;
        baselineDurationSeconds: number;
        knowledgePoints?: string[];
      };
    }
  | {
      type: 'question-asked';
      payload: { intent: string; knowledgePoints?: string[] };
    }
  | {
      type: 'self-reported';
      payload: { level: 'confused' | 'understood'; knowledgePoints?: string[] };
    }
);

export interface LearnerBehaviorEventResult {
  recorded: boolean;
  reason?: string;
}

export async function recordLearnerBehaviorEvent(
  input: LearnerBehaviorEventInput,
): Promise<LearnerBehaviorEventResult> {
  try {
    const response = await fetch(LEARNING_EVENTS_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...input,
        evidenceQuality: 'inferred',
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      recorded?: boolean;
      reason?: string;
    } | null;
    return {
      recorded: response.ok && payload?.recorded === true,
      reason: payload?.reason ?? (response.ok ? undefined : 'request-failed'),
    };
  } catch {
    // Profiling is best-effort. Playback must continue when telemetry fails.
    return { recorded: false, reason: 'request-failed' };
  }
}
