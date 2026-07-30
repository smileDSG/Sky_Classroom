import { describe, expect, it } from 'vitest';

import { migrateLegacyPersonalizationToPreferences } from '@/lib/adaptive-learning/profile/migrate-legacy-personalization';
import type { UserEntry } from '@/lib/storage/dao/users';

describe('migrateLegacyPersonalizationToPreferences', () => {
  it('maps legacy personalization fields to LearnerPreferencesInput', () => {
    const legacy: Partial<UserEntry> = {
      preferredLanguage: 'zh',
      detailLevel: 'detailed',
      aiPersonality: 'friendly',
      aiName: '小智',
      customInstructions: '优先给例题',
      learningStyle: 'balanced',
      enableMemory: true,
      enableRAG: false,
      showStepByStep: true,
      autoGenerateQuiz: true,
    };

    const input = migrateLegacyPersonalizationToPreferences('user-1', legacy);

    expect(input.preferredLanguage).toBe('zh-CN');
    expect(input.explanationDepth).toBe('detailed');
    expect(input.interactionTone).toBe('friendly');
    expect(input.assistantName).toBe('小智');
    expect(input.preferenceNotes).toContain('优先给例题');
    expect(input.preferenceNotes).toContain('期望自动推荐相关测验');
    expect(input.stepByStepMode).toBe('always');
    expect(input.privacy.conversationMemory).toBe('persistent');
    expect(input.privacy.privateKnowledgeRetrieval).toBe(false);
    expect(input.contentFormatPreferences).toContain('text');
    expect(input.contentFormatPreferences).toContain('worked-example');
  });

  it('uses defaults for missing legacy fields', () => {
    const input = migrateLegacyPersonalizationToPreferences('user-1', {});

    expect(input.preferredLanguage).toBe('zh-CN');
    expect(input.explanationDepth).toBe('standard');
    expect(input.interactionTone).toBe('friendly');
    expect(input.assistantName).toBe('小云');
    expect(input.contentFormatPreferences.length).toBeGreaterThan(0);
    expect(input.privacy.conversationMemory).toBe('session');
  });

  it('maps visual learning style to diagram preference', () => {
    const input = migrateLegacyPersonalizationToPreferences('user-1', { learningStyle: 'visual' });
    expect(input.contentFormatPreferences).toEqual(['diagram']);
  });

  it('maps enableMemory false to off', () => {
    const input = migrateLegacyPersonalizationToPreferences('user-1', { enableMemory: false });
    expect(input.privacy.conversationMemory).toBe('off');
  });
});
