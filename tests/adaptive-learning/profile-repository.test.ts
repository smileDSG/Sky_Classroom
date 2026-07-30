import { describe, expect, it } from 'vitest';

import {
  type DomainLearnerProfile,
  type LearnerPreferences,
  type LearningEvent,
} from '@/lib/adaptive-learning/contracts';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

const preferences: LearnerPreferences = {
  userId: 'user-1',
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
  version: 1,
  schemaVersion: '1.0.0',
  updatedAt: '2026-07-28T00:00:00.000Z',
  updatedBy: 'user',
};

const domainProfile: DomainLearnerProfile = {
  id: 'domain-math-1',
  userId: 'user-1',
  subjectId: 'math',
  educationStage: 'senior-high',
  gradeLevel: 'grade-12',
  curriculumPackId: 'cn-gaokao-math',
  curriculumPackVersion: '2026.1',
  examSystem: 'gaokao',
  examDate: '2027-06-07',
  targetScore: 130,
  scoreScaleMax: 150,
  weeklyAvailableMinutes: 420,
  dailyAvailability: { monday: 60, saturday: 120 },
  preferredSessionMinutes: 45,
  constraints: {
    restDays: ['sunday'],
    maxDailyMinutes: 120,
    teacherLockedNodeIds: [],
  },
  status: 'active',
  version: 1,
  schemaVersion: '1.0.0',
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
};

const learningEvent: LearningEvent = {
  eventId: 'event-1',
  userId: 'user-1',
  type: 'answer-submitted',
  occurredAt: '2026-07-28T02:00:00.000Z',
  source: 'solve-grade',
  nodeIds: ['quadratic-function'],
  evidenceQuality: 'verified',
  payload: { correct: false },
  schemaVersion: '1.0.0',
};

describe('LearnerProfileRepository', () => {
  it('stores and retrieves immutable learner preference versions', async () => {
    const repository = new LearnerProfileRepository(new MemoryStorageProvider());

    await repository.insertPreferences(preferences);

    await expect(repository.getLatestPreferences('user-1')).resolves.toEqual(preferences);
    await expect(repository.getLatestPreferences('user-2')).resolves.toBeNull();
  });

  it('stores and retrieves the latest isolated domain profile version', async () => {
    const repository = new LearnerProfileRepository(new MemoryStorageProvider());
    const version2 = {
      ...domainProfile,
      version: 2 as const,
      targetScore: 135,
      updatedAt: '2026-07-28T01:00:00.000Z',
    };

    await repository.insertDomainProfile(domainProfile);
    await repository.insertDomainProfile(version2);
    await repository.insertDomainProfile({ ...domainProfile, userId: 'user-2' });

    await expect(repository.getLatestDomainProfile('user-1', domainProfile.id)).resolves.toEqual(
      version2,
    );
    await expect(repository.getLatestDomainProfile('user-3', domainProfile.id)).resolves.toBeNull();
  });

  it('appends and lists learning events for one learner only', async () => {
    const repository = new LearnerProfileRepository(new MemoryStorageProvider());
    const earlier = {
      ...learningEvent,
      eventId: 'event-0',
      occurredAt: '2026-07-28T01:00:00.000Z',
    };

    await repository.appendLearningEvent(learningEvent);
    await repository.appendLearningEvent(earlier);
    await repository.appendLearningEvent({
      ...learningEvent,
      eventId: 'event-other',
      userId: 'user-2',
    });

    await expect(repository.listLearningEvents('user-1')).resolves.toEqual([
      earlier,
      learningEvent,
    ]);
    await expect(repository.listLearningEvents('user-3')).resolves.toEqual([]);
  });
});
