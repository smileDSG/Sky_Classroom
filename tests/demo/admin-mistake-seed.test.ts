import { describe, expect, test } from 'vitest';
import {
  ensureAdminKnowledgeMistakes,
  ensureDemoLearningData,
} from '@/lib/demo/admin-mistake-seed';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';

describe('admin knowledge mistake seed', () => {
  test('replaces admin placeholders with varied high-school and university records', async () => {
    const dao = createMistakeBookDAO(new MemoryStorageProvider());
    await dao.add('admin-default', {
      id: 'placeholder',
      problemText: '1+1=?',
      userAnswer: '3',
      correctAnswer: '2',
      errorType: 'calculation',
      knowledgePoints: ['测试加法'],
    });

    await ensureAdminKnowledgeMistakes('admin-default', dao);
    const first = await dao.list('admin-default', { pageSize: 99 });
    await ensureAdminKnowledgeMistakes('admin-default', dao);
    const second = await dao.list('admin-default', { pageSize: 99 });

    expect(first.items).toHaveLength(12);
    expect(second.items).toHaveLength(12);
    expect(first.items.some((item) => item.problemText === '1+1=?')).toBe(false);
    expect(first.items.filter((item) => item.reviewed)).toHaveLength(5);
    expect(
      first.items.some((item) => item.knowledgePoints.some((point) => point.includes('高中'))),
    ).toBe(true);
    expect(
      first.items.some((item) => item.knowledgePoints.some((point) => point.includes('大学'))),
    ).toBe(true);
    expect(new Set(first.items.map((item) => item.lastReview)).size).toBe(12);
  });

  test('does not change other users', async () => {
    const dao = createMistakeBookDAO(new MemoryStorageProvider());
    await dao.add('student-1', {
      id: 'student-record',
      problemText: '保留原题',
      userAnswer: 'A',
      correctAnswer: 'B',
      errorType: 'concept',
      knowledgePoints: ['函数'],
    });

    await ensureAdminKnowledgeMistakes('student-1', dao);
    const result = await dao.list('student-1', { pageSize: 99 });

    expect(result.items.map((item) => item.id)).toEqual(['student-record']);
  });

  test('creates an idempotent cross-stage planning profile for demo users', async () => {
    const storage = new MemoryStorageProvider();

    await ensureDemoLearningData('demo-default', storage);
    await ensureDemoLearningData('demo-default', storage);

    const repository = new LearnerProfileRepository(storage);
    const preferences = await repository.getLatestPreferences('demo-default');
    const domainProfile = await repository.getLatestDomainProfile('demo-default', 'default');
    const states = await createKnowledgeStateDAO(storage).list('demo-default');

    expect(preferences).toMatchObject({
      learningPace: 'standard',
      explanationDepth: 'detailed',
    });
    expect(domainProfile).toMatchObject({
      educationStage: 'undergraduate',
      horizonDays: 28,
      curriculumPackId: 'gaokao-math-2026.1',
    });
    expect(states.some((state) => state.displayName?.includes('高中'))).toBe(true);
    expect(states.some((state) => state.displayName?.includes('大学'))).toBe(true);
    expect(await storage.count('learner-preference-versions')).toBe(1);
    expect(await storage.count('domain-learner-profile-versions')).toBe(1);
  });
});
