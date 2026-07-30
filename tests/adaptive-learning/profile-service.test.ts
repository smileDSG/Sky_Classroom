import { describe, expect, it } from 'vitest';

import { type LearnerPreferencesInput } from '@/lib/adaptive-learning/contracts';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { LearnerProfileService } from '@/lib/adaptive-learning/profile/service';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const preferenceInput: LearnerPreferencesInput = {
  preferredLanguage: 'zh-CN',
  contentFormatPreferences: ['worked-example', 'diagram'],
  explanationDepth: 'detailed',
  learningPace: 'standard',
  stepByStepMode: 'always',
  interactionTone: 'encouraging',
  assistantName: '小智',
  preferenceNotes: '讲解时优先给出例题。',
  privacy: {
    conversationMemory: 'persistent',
    optionalBehaviorSignals: true,
    privateKnowledgeRetrieval: false,
  },
};

describe('LearnerProfileService', () => {
  it('assigns profile ownership and the first version on the server', async () => {
    const repository = new LearnerProfileRepository(new MemoryStorageProvider());
    const service = new LearnerProfileService(repository, {
      now: () => new Date('2026-07-28T00:00:00.000Z'),
    });

    const saved = await service.savePreferences({
      userId: 'user-1',
      expectedVersion: 0,
      updatedBy: 'user',
      preferences: preferenceInput,
    });

    expect(saved).toMatchObject({
      userId: 'user-1',
      version: 1,
      schemaVersion: '1.0.0',
      updatedAt: '2026-07-28T00:00:00.000Z',
    });
    await expect(repository.getLatestPreferences('user-1')).resolves.toEqual(saved);
  });
});
