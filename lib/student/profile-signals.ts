import type {
  ConversationProfileStage,
  ConversationalProfilePatch,
} from '@/lib/student/conversation-profile';
import type { StorageEntry, StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'profile_signals';
const SHORT_TERM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ProfileSignalDimension =
  | 'majorBackground'
  | 'learningGoal'
  | 'knowledgeBase'
  | 'cognitiveStyle'
  | 'errorPatternPreference'
  | 'resourcePreference'
  | 'interactionPreference'
  | 'learningPace'
  | 'currentLearningState';

export type ProfileSignalSource =
  | 'onboarding_chat'
  | 'learning_chat'
  | 'review_chat'
  | 'diagnostic'
  | 'quiz'
  | 'mistake'
  | 'behavior'
  | 'feedback'
  | 'manual_correction';

export interface KnowledgeBaseSignalValue {
  strongPoints: string[];
  weakPoints: string[];
}

export type ProfileSignalValue = string | string[] | KnowledgeBaseSignalValue;

export interface ProfileSignal {
  id: string;
  userId: string;
  dimension: ProfileSignalDimension;
  value: ProfileSignalValue;
  source: ProfileSignalSource;
  confidence: number;
  evidence: string[];
  createdAt: number;
  expiresAt?: number;
}

export interface ProfileSignalInput {
  userId: string;
  dimension: ProfileSignalDimension;
  value: ProfileSignalValue;
  source: ProfileSignalSource;
  confidence: number;
  evidence?: string[];
  createdAt?: number;
  expiresAt?: number;
}

export interface ProfileSignalDAO {
  add(input: ProfileSignalInput): Promise<ProfileSignal>;
  addMany(signals: ProfileSignal[]): Promise<ProfileSignal[]>;
  listByUser(
    userId: string,
    options?: { includeExpired?: boolean; now?: number },
  ): Promise<ProfileSignal[]>;
}

interface ConversationProfileField<T> {
  value: T;
  confidence: number;
  evidence: string[];
  source: ProfileSignalSource;
  updatedAt: number;
}

export interface ConversationKnowledgeBaseProfile extends KnowledgeBaseSignalValue {
  confidence: number;
  evidence: string[];
  source: ProfileSignalSource;
  updatedAt: number;
}

export interface ConversationProfileSummary {
  majorBackground?: ConversationProfileField<string>;
  learningGoal?: ConversationProfileField<string>;
  knowledgeBase?: ConversationKnowledgeBaseProfile;
  cognitiveStyle?: ConversationProfileField<string>;
  errorPatternPreference?: ConversationProfileField<string[]>;
  resourcePreference?: ConversationProfileField<string[]>;
  interactionPreference?: ConversationProfileField<string>;
  learningPace?: ConversationProfileField<string>;
  currentLearningState?: ConversationProfileField<string>;
}

function genId(): string {
  return `profile_signal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sourceForStage(stage: ConversationProfileStage): ProfileSignalSource {
  if (stage === 'learning') return 'learning_chat';
  if (stage === 'review') return 'review_chat';
  return 'onboarding_chat';
}

function createSignal(input: ProfileSignalInput): ProfileSignal {
  const createdAt = input.createdAt ?? Date.now();
  return {
    id: genId(),
    userId: input.userId,
    dimension: input.dimension,
    value: input.value,
    source: input.source,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    evidence: input.evidence ?? [],
    createdAt,
    expiresAt: input.expiresAt,
  };
}

function shouldReplace(current: ProfileSignal | undefined, candidate: ProfileSignal): boolean {
  if (!current) return true;
  if (candidate.confidence !== current.confidence) {
    return candidate.confidence > current.confidence;
  }
  return candidate.createdAt > current.createdAt;
}

function isActive(signal: ProfileSignal, now: number): boolean {
  return !signal.expiresAt || signal.expiresAt > now;
}

function isStringArray(value: ProfileSignalValue): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isKnowledgeBaseValue(value: ProfileSignalValue): value is KnowledgeBaseSignalValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray(value.strongPoints) &&
    Array.isArray(value.weakPoints)
  );
}

function toStringField(signal: ProfileSignal): ConversationProfileField<string> | undefined {
  if (typeof signal.value !== 'string') return undefined;
  return {
    value: signal.value,
    confidence: signal.confidence,
    evidence: signal.evidence,
    source: signal.source,
    updatedAt: signal.createdAt,
  };
}

function toStringArrayField(signal: ProfileSignal): ConversationProfileField<string[]> | undefined {
  if (!isStringArray(signal.value)) return undefined;
  return {
    value: signal.value,
    confidence: signal.confidence,
    evidence: signal.evidence,
    source: signal.source,
    updatedAt: signal.createdAt,
  };
}

function toKnowledgeBaseField(signal: ProfileSignal): ConversationKnowledgeBaseProfile | undefined {
  if (!isKnowledgeBaseValue(signal.value)) return undefined;
  return {
    strongPoints: signal.value.strongPoints,
    weakPoints: signal.value.weakPoints,
    confidence: signal.confidence,
    evidence: signal.evidence,
    source: signal.source,
    updatedAt: signal.createdAt,
  };
}

export function conversationPatchToSignals(input: {
  userId: string;
  patch: ConversationalProfilePatch;
  stage: ConversationProfileStage;
  now?: number;
}): ProfileSignal[] {
  const now = input.now ?? Date.now();
  const source = sourceForStage(input.stage);
  const signals: ProfileSignal[] = [];

  const addStringDimension = (
    dimension: Exclude<
      ProfileSignalDimension,
      'knowledgeBase' | 'errorPatternPreference' | 'resourcePreference'
    >,
  ) => {
    const item = input.patch[dimension];
    if (!item) return;
    signals.push(
      createSignal({
        userId: input.userId,
        dimension,
        value: item.value,
        source,
        confidence: item.confidence,
        evidence: item.evidence,
        createdAt: now,
        expiresAt: dimension === 'currentLearningState' ? now + SHORT_TERM_TTL_MS : undefined,
      }),
    );
  };

  addStringDimension('majorBackground');
  addStringDimension('learningGoal');
  addStringDimension('cognitiveStyle');
  addStringDimension('interactionPreference');
  addStringDimension('learningPace');
  addStringDimension('currentLearningState');

  if (input.patch.knowledgeBase) {
    signals.push(
      createSignal({
        userId: input.userId,
        dimension: 'knowledgeBase',
        value: {
          strongPoints: input.patch.knowledgeBase.strongPoints,
          weakPoints: input.patch.knowledgeBase.weakPoints,
        },
        source,
        confidence: input.patch.knowledgeBase.confidence,
        evidence: input.patch.knowledgeBase.evidence,
        createdAt: now,
      }),
    );
  }

  if (input.patch.errorPatternPreference) {
    signals.push(
      createSignal({
        userId: input.userId,
        dimension: 'errorPatternPreference',
        value: input.patch.errorPatternPreference.value,
        source,
        confidence: input.patch.errorPatternPreference.confidence,
        evidence: input.patch.errorPatternPreference.evidence,
        createdAt: now,
      }),
    );
  }

  if (input.patch.resourcePreference) {
    signals.push(
      createSignal({
        userId: input.userId,
        dimension: 'resourcePreference',
        value: input.patch.resourcePreference.value,
        source,
        confidence: input.patch.resourcePreference.confidence,
        evidence: input.patch.resourcePreference.evidence,
        createdAt: now,
      }),
    );
  }

  return signals;
}

export function buildConversationProfileFromSignals(
  signals: ProfileSignal[],
  options?: { now?: number },
): ConversationProfileSummary {
  const now = options?.now ?? Date.now();
  const bestByDimension = new Map<ProfileSignalDimension, ProfileSignal>();

  for (const signal of signals) {
    if (!isActive(signal, now)) continue;
    const current = bestByDimension.get(signal.dimension);
    if (shouldReplace(current, signal)) {
      bestByDimension.set(signal.dimension, signal);
    }
  }

  const summary: ConversationProfileSummary = {};
  const majorBackground = bestByDimension.get('majorBackground');
  const learningGoal = bestByDimension.get('learningGoal');
  const knowledgeBase = bestByDimension.get('knowledgeBase');
  const cognitiveStyle = bestByDimension.get('cognitiveStyle');
  const errorPatternPreference = bestByDimension.get('errorPatternPreference');
  const resourcePreference = bestByDimension.get('resourcePreference');
  const interactionPreference = bestByDimension.get('interactionPreference');
  const learningPace = bestByDimension.get('learningPace');
  const currentLearningState = bestByDimension.get('currentLearningState');

  if (majorBackground) summary.majorBackground = toStringField(majorBackground);
  if (learningGoal) summary.learningGoal = toStringField(learningGoal);
  if (knowledgeBase) summary.knowledgeBase = toKnowledgeBaseField(knowledgeBase);
  if (cognitiveStyle) summary.cognitiveStyle = toStringField(cognitiveStyle);
  if (errorPatternPreference) {
    summary.errorPatternPreference = toStringArrayField(errorPatternPreference);
  }
  if (resourcePreference) summary.resourcePreference = toStringArrayField(resourcePreference);
  if (interactionPreference) summary.interactionPreference = toStringField(interactionPreference);
  if (learningPace) summary.learningPace = toStringField(learningPace);
  if (currentLearningState) summary.currentLearningState = toStringField(currentLearningState);

  return summary;
}

export function createProfileSignalDAO(storage: StorageProvider): ProfileSignalDAO {
  return {
    async add(input: ProfileSignalInput): Promise<ProfileSignal> {
      const signal = createSignal(input);
      const entry: StorageEntry<ProfileSignal> = {
        id: signal.id,
        data: signal,
        createdAt: signal.createdAt,
        updatedAt: signal.createdAt,
      };
      await storage.set(TABLE, entry);
      return signal;
    },

    async addMany(signals: ProfileSignal[]): Promise<ProfileSignal[]> {
      await Promise.all(
        signals.map((signal) =>
          storage.set(TABLE, {
            id: signal.id,
            data: signal,
            createdAt: signal.createdAt,
            updatedAt: signal.createdAt,
          }),
        ),
      );
      return signals;
    },

    async listByUser(
      userId: string,
      options?: { includeExpired?: boolean; now?: number },
    ): Promise<ProfileSignal[]> {
      const now = options?.now ?? Date.now();
      const entries = await storage.getAll<ProfileSignal>(TABLE, (entry) => {
        if (entry.data.userId !== userId) return false;
        return options?.includeExpired ? true : isActive(entry.data, now);
      });
      return entries.map((entry) => entry.data).sort((a, b) => b.createdAt - a.createdAt);
    },
  };
}
