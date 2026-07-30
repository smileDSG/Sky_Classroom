import type { LearnerPreferencesInput } from '@/lib/adaptive-learning/contracts';
import type { UserEntry } from '@/lib/storage/dao/users';

export interface LegacyPersonalizationFields {
  preferredLanguage?: string | null;
  detailLevel?: string | null;
  aiPersonality?: string | null;
  aiName?: string | null;
  customInstructions?: string | null;
  learningStyle?: string | null;
  enableMemory?: boolean | null;
  enableRAG?: boolean | null;
  showStepByStep?: boolean | null;
  autoGenerateQuiz?: boolean | null;
}

function normalizeLanguage(value: string | null | undefined): string {
  if (!value) return 'zh-CN';
  if (value.toLowerCase().startsWith('zh')) return 'zh-CN';
  if (value.toLowerCase().startsWith('en')) return 'en';
  return value;
}

function normalizeExplanationDepth(value: string | null | undefined): LearnerPreferencesInput['explanationDepth'] {
  const valid: LearnerPreferencesInput['explanationDepth'][] = ['concise', 'standard', 'detailed', 'comprehensive'];
  return valid.includes(value as LearnerPreferencesInput['explanationDepth'])
    ? (value as LearnerPreferencesInput['explanationDepth'])
    : 'standard';
}

function normalizeInteractionTone(value: string | null | undefined): LearnerPreferencesInput['interactionTone'] {
  const valid: LearnerPreferencesInput['interactionTone'][] = [
    'friendly',
    'professional',
    'encouraging',
    'strict',
    'humorous',
  ];
  return valid.includes(value as LearnerPreferencesInput['interactionTone'])
    ? (value as LearnerPreferencesInput['interactionTone'])
    : 'friendly';
}

function mapLearningStyleToFormats(style: string | null | undefined): LearnerPreferencesInput['contentFormatPreferences'] {
  switch (style) {
    case 'visual':
      return ['diagram'];
    case 'auditory':
      return ['audio'];
    case 'reading':
      return ['text'];
    case 'kinesthetic':
      return ['interactive'];
    case 'balanced':
    default:
      return ['text', 'worked-example'];
  }
}

function mapStepByStepMode(showStepByStep: boolean | null | undefined): LearnerPreferencesInput['stepByStepMode'] {
  return showStepByStep === false ? 'when-needed' : 'always';
}

function mapConversationMemory(enableMemory: boolean | null | undefined): LearnerPreferencesInput['privacy']['conversationMemory'] {
  if (enableMemory === true) return 'persistent';
  if (enableMemory === false) return 'off';
  return 'session';
}

function buildPreferenceNotes(
  customInstructions: string | null | undefined,
  autoGenerateQuiz: boolean | null | undefined,
): string {
  const parts: string[] = [];
  if (customInstructions) parts.push(customInstructions);
  if (autoGenerateQuiz === true) parts.push('期望自动推荐相关测验。');
  if (autoGenerateQuiz === false) parts.push('不期望自动推荐测验。');
  return parts.join(' ');
}

export function migrateLegacyPersonalizationToPreferences(
  userId: string,
  legacy: LegacyPersonalizationFields,
): LearnerPreferencesInput {
  return {
    preferredLanguage: normalizeLanguage(legacy.preferredLanguage),
    contentFormatPreferences: mapLearningStyleToFormats(legacy.learningStyle),
    explanationDepth: normalizeExplanationDepth(legacy.detailLevel),
    learningPace: 'standard',
    stepByStepMode: mapStepByStepMode(legacy.showStepByStep),
    interactionTone: normalizeInteractionTone(legacy.aiPersonality),
    assistantName: legacy.aiName?.trim() || '小云',
    preferenceNotes: buildPreferenceNotes(legacy.customInstructions, legacy.autoGenerateQuiz),
    privacy: {
      conversationMemory: mapConversationMemory(legacy.enableMemory),
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: legacy.enableRAG === true,
    },
  };
}

export function extractLegacyPersonalizationFields(user: UserEntry): LegacyPersonalizationFields {
  return {
    preferredLanguage: user.preferredLanguage,
    detailLevel: user.detailLevel,
    aiPersonality: user.aiPersonality,
    aiName: user.aiName,
    customInstructions: user.customInstructions,
    learningStyle: user.learningStyle,
    enableMemory: user.enableMemory,
    enableRAG: user.enableRAG,
    showStepByStep: user.showStepByStep,
    autoGenerateQuiz: user.autoGenerateQuiz,
  };
}
