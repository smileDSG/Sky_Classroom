import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { integrateCompletedOnboardingProfile } from '@/lib/onboarding/profile-integration';
import type { UniversalOnboardingProfile } from '@/lib/onboarding/types';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { createUserDAO, type UserEntry } from '@/lib/storage/dao/users';
import {
  buildConversationProfileFromSignals,
  createProfileSignalDAO,
} from '@/lib/student/profile-signals';

const storage = new MemoryStorageProvider();
const boundary = vi.hoisted(() => ({
  user: null as UserEntry | null,
  storage: null as MemoryStorageProvider | null,
}));

vi.mock('@/lib/server/auth/helpers', () => ({
  requireAuth: vi.fn(async () => ({ user: boundary.user })),
}));

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(async () => boundary.storage),
  getRequiredServerStorage: vi.fn(async () => boundary.storage),
}));

import { PUT } from '@/app/api/user/learning-onboarding/route';
import { GET as GET_LEARNER_PROFILE } from '@/app/api/user/learner-profile/route';

const completedProfile: Extract<UniversalOnboardingProfile, { status: 'completed' }> = {
  version: 2,
  status: 'completed',
  identities: ['learner'],
  primaryIdentity: 'learner',
  profiles: {
    learner: {
      identity: 'learner',
      context: {
        stage: 'middle',
        learningDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
        supportDomains: [{ source: 'catalog', id: 'physics', name: '物理' }],
        legacyGrade: '初二',
      },
      goals: [{ source: 'catalog', id: 'build-foundations', label: '巩固基础' }],
      roleNeeds: ['identify-gaps'],
      preferences: { explanationStyle: 'step-by-step' },
      baseline: { foundation: 'developing', weeklyTime: 'regular' },
      detail: '补齐代数基础',
      completedAt: 2_000,
    },
  },
  completedAt: 2_000,
};

const multiIdentityProfile: Extract<UniversalOnboardingProfile, { status: 'completed' }> = {
  ...completedProfile,
  identities: ['learner', 'educator'],
  primaryIdentity: 'educator',
  profiles: {
    ...completedProfile.profiles,
    educator: {
      identity: 'educator',
      contexts: [
        {
          stage: 'high',
          teachingDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
        },
      ],
      goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
      roleNeeds: ['question-design'],
      preferences: { primarySupport: 'lesson-plan-structure' },
      completedAt: 2_000,
    },
  },
};

beforeEach(async () => {
  await storage.clear('users');
  await storage.clear('learner-preference-versions');
  await storage.clear('profile_signals');

  const users = await createUserDAO(storage);
  await users.create({
    id: 'user-1',
    email: 'student@example.com',
    username: 'student',
    passwordHash: null,
    role: 'user',
    status: 'active',
    guestId: null,
    planType: 'free',
    avatar: null,
    nickname: null,
    bio: null,
    educationLevel: null,
    grade: null,
    favoriteSubjects: null,
    learningOnboarding: null,
    learningStyle: null,
    detailLevel: null,
    preferredLanguage: null,
    aiPersonality: null,
    aiName: null,
    customInstructions: null,
    autoGenerateQuiz: null,
    showStepByStep: null,
    enableMemory: null,
    enableRAG: null,
    emailVerified: true,
    emailVerifyToken: null,
    resetToken: null,
    resetTokenExpiry: null,
  });
  boundary.storage = storage;
  boundary.user = await users.getById('user-1');
});

describe('integrateCompletedOnboardingProfile', () => {
  it('writes onboarding answers into user fields, learner preferences, and profile signals', async () => {
    await integrateCompletedOnboardingProfile({
      storage,
      userId: 'user-1',
      profile: completedProfile,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    const user = await (await createUserDAO(storage)).getById('user-1');
    expect(user).toMatchObject({
      educationLevel: 'middle',
      grade: '初二',
      learningStyle: 'reading',
      showStepByStep: true,
      favoriteSubjects: [
        { id: 'math', name: '数学', enabled: true },
        { id: 'physics', name: '物理', enabled: true },
      ],
      learningOnboarding: completedProfile,
    });

    const preferences = await new LearnerProfileRepository(storage).getLatestPreferences('user-1');
    expect(preferences).toMatchObject({
      version: 1,
      updatedBy: 'system',
      stepByStepMode: 'always',
      learningPace: 'standard',
    });

    const signals = await createProfileSignalDAO(storage).listByUser('user-1');
    const profile = buildConversationProfileFromSignals(signals);
    expect(profile.learningGoal?.value).toContain('巩固基础');
    expect(profile.knowledgeBase).toMatchObject({
      strongPoints: [],
      weakPoints: ['physics'],
    });
    expect(profile.interactionPreference?.value).toBe('step-by-step');
    expect(profile.learningPace?.value).toBe('standard');
    expect(profile.currentLearningState?.value).toContain('有基础但不稳定');
  });

  it('integrates the profile when onboarding is completed through its public API', async () => {
    const response = await PUT(
      new Request('http://localhost/api/user/learning-onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 2,
          identities: completedProfile.identities,
          primaryIdentity: completedProfile.primaryIdentity,
          profiles: {
            learner: {
              ...completedProfile.profiles.learner,
              completedAt: undefined,
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.clone().json()).toMatchObject({
      initialProfile: {
        foundation: 'developing',
        weeklyTime: 'regular',
        recommendedDifficulty: 'easy',
      },
    });
    expect(
      await new LearnerProfileRepository(storage).getLatestPreferences('user-1'),
    ).toMatchObject({
      stepByStepMode: 'always',
      updatedBy: 'system',
    });
    expect(await createProfileSignalDAO(storage).listByUser('user-1')).not.toHaveLength(0);
  });

  it('backfills an existing completed onboarding when the unified profile is first read', async () => {
    const users = await createUserDAO(storage);
    await users.update('user-1', { learningOnboarding: completedProfile });
    boundary.user = await users.getById('user-1');

    const response = await GET_LEARNER_PROFILE();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      preferences: {
        userId: 'user-1',
        stepByStepMode: 'always',
        updatedBy: 'system',
      },
    });
    expect(await createProfileSignalDAO(storage).listByUser('user-1')).not.toHaveLength(0);
  });

  it('backfills missing onboarding signals even when learner preferences already exist', async () => {
    const users = await createUserDAO(storage);
    await users.update('user-1', { learningOnboarding: completedProfile });
    boundary.user = await users.getById('user-1');
    await new LearnerProfileRepository(storage).insertPreferences({
      userId: 'user-1',
      preferredLanguage: 'zh-CN',
      contentFormatPreferences: ['text', 'worked-example'],
      explanationDepth: 'standard',
      learningPace: 'standard',
      stepByStepMode: 'always',
      interactionTone: 'friendly',
      assistantName: '小云',
      preferenceNotes: '',
      privacy: {
        conversationMemory: 'session',
        optionalBehaviorSignals: false,
        privateKnowledgeRetrieval: false,
      },
      version: 1,
      schemaVersion: '1.0.0',
      updatedAt: '2026-07-30T12:00:00.000Z',
      updatedBy: 'user',
    });

    expect((await GET_LEARNER_PROFILE()).status).toBe(200);
    expect(await createProfileSignalDAO(storage).listByUser('user-1')).not.toHaveLength(0);
    expect(await storage.count('learner-preference-versions')).toBe(1);
  });

  it('integrates every selected identity while using the primary identity for preferences', async () => {
    await integrateCompletedOnboardingProfile({
      storage,
      userId: 'user-1',
      profile: multiIdentityProfile,
    });

    const signals = await createProfileSignalDAO(storage).listByUser('user-1');
    const profile = buildConversationProfileFromSignals(signals);
    expect(profile.majorBackground?.value).toContain('educator');
    expect(profile.majorBackground?.value).toContain('learner');
    expect(profile.knowledgeBase).toMatchObject({
      strongPoints: [],
      weakPoints: ['physics'],
    });
    expect(profile.interactionPreference?.value).toBe('lesson-plan-structure');
  });

  it('keeps retries idempotent and versions genuine onboarding edits', async () => {
    await integrateCompletedOnboardingProfile({
      storage,
      userId: 'user-1',
      profile: completedProfile,
    });
    await integrateCompletedOnboardingProfile({
      storage,
      userId: 'user-1',
      profile: completedProfile,
    });

    expect(await storage.count('learner-preference-versions')).toBe(1);
    const signalCount = await storage.count('profile_signals');

    const edited = structuredClone(completedProfile);
    edited.completedAt = 3_000;
    edited.profiles.learner!.completedAt = 3_000;
    edited.profiles.learner!.preferences.explanationStyle = 'visual-explanation';
    await integrateCompletedOnboardingProfile({
      storage,
      userId: 'user-1',
      profile: edited,
    });

    expect(await storage.count('learner-preference-versions')).toBe(2);
    expect(await storage.count('profile_signals')).toBe(signalCount);
    expect(
      await new LearnerProfileRepository(storage).getLatestPreferences('user-1'),
    ).toMatchObject({
      version: 2,
      contentFormatPreferences: ['diagram', 'worked-example'],
      stepByStepMode: 'when-needed',
    });
  });
});
