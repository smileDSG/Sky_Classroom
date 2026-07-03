import { describe, expect, it } from 'vitest';

import {
  buildConversationProfileFromSignals,
  conversationPatchToSignals,
} from '@/lib/student/profile-signals';

describe('profile signals', () => {
  it('converts a conversation profile patch into persistable profile signals', () => {
    const signals = conversationPatchToSignals({
      userId: 'student-1',
      stage: 'onboarding',
      now: 1000,
      patch: {
        learningGoal: {
          value: 'finish a RAG project',
          confidence: 0.9,
          evidence: ['I need a RAG project'],
        },
        knowledgeBase: {
          strongPoints: ['Python'],
          weakPoints: ['vector retrieval'],
          confidence: 0.82,
          evidence: ['I get stuck on vector retrieval'],
        },
        resourcePreference: {
          value: ['code cases', 'diagrams'],
          confidence: 0.8,
          evidence: ['I prefer code cases and diagrams'],
        },
      },
    });

    expect(signals).toHaveLength(3);
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'student-1',
          dimension: 'learningGoal',
          source: 'onboarding_chat',
          value: 'finish a RAG project',
          confidence: 0.9,
        }),
        expect.objectContaining({
          dimension: 'knowledgeBase',
          value: {
            strongPoints: ['Python'],
            weakPoints: ['vector retrieval'],
          },
        }),
        expect.objectContaining({
          dimension: 'resourcePreference',
          value: ['code cases', 'diagrams'],
        }),
      ]),
    );
  });

  it('summarizes the latest high-confidence signals into a conversation profile', () => {
    const profile = buildConversationProfileFromSignals([
      {
        id: 'old-goal',
        userId: 'student-1',
        dimension: 'learningGoal',
        value: 'learn basics',
        source: 'onboarding_chat',
        confidence: 0.6,
        evidence: ['old message'],
        createdAt: 1000,
      },
      {
        id: 'new-goal',
        userId: 'student-1',
        dimension: 'learningGoal',
        value: 'finish a RAG project',
        source: 'learning_chat',
        confidence: 0.88,
        evidence: ['new message'],
        createdAt: 2000,
      },
      {
        id: 'preference',
        userId: 'student-1',
        dimension: 'resourcePreference',
        value: ['code cases'],
        source: 'onboarding_chat',
        confidence: 0.8,
        evidence: ['prefers code'],
        createdAt: 1500,
      },
    ]);

    expect(profile.learningGoal).toMatchObject({
      value: 'finish a RAG project',
      confidence: 0.88,
      evidence: ['new message'],
    });
    expect(profile.resourcePreference?.value).toEqual(['code cases']);
  });
});
