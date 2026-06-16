/**
 * D-005 Student Profile Builder — Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildStudentProfile, invalidateProfileCache } from '@/lib/student/profile-builder';
import type { StorageProvider } from '@/lib/storage/storage-types';

// Mock storage
vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(),
}));

vi.mock('@/lib/storage/dao/mistakes', () => ({
  createMistakeBookDAO: vi.fn(),
}));

vi.mock('@/lib/student/quiz-attempts', () => ({
  createQuizAttemptDAO: vi.fn(),
}));

const mockMistakeDAO = {
  list: vi.fn(),
};

const mockQuizAttemptDAO = {
  list: vi.fn(),
};

const mockStorage: StorageProvider = {
  set: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  count: vi.fn(),
  isAvailable: vi.fn(),
};

describe('buildStudentProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await invalidateProfileCache('test-user');

    const { getServerStorage } = await import('@/lib/server/server-storage');
    const { createMistakeBookDAO } = await import('@/lib/storage/dao/mistakes');
    const { createQuizAttemptDAO } = await import('@/lib/student/quiz-attempts');
    vi.mocked(getServerStorage).mockResolvedValue(mockStorage);
    vi.mocked(createMistakeBookDAO).mockReturnValue(mockMistakeDAO as unknown as ReturnType<typeof createMistakeBookDAO>);
    vi.mocked(createQuizAttemptDAO).mockReturnValue(mockQuizAttemptDAO as unknown as ReturnType<typeof createQuizAttemptDAO>);
    mockQuizAttemptDAO.list.mockResolvedValue([]);
  });

  afterEach(async () => {
    await invalidateProfileCache('test-user');
  });

  it('builds profile from empty mistakes', async () => {
    mockMistakeDAO.list.mockResolvedValueOnce({ items: [], total: 0 });

    const profile = await buildStudentProfile('test-user');

    expect(profile.userId).toBe('test-user');
    expect(profile.masteryBySubject).toBeDefined();
    expect(profile.weakPoints).toEqual([]);
    expect(profile.strongPoints).toEqual([]);
    expect(profile.errorPatterns).toEqual([]);
    expect(profile.totalQuestions).toBe(0);
  });

  it('builds profile with mistakes', async () => {
    mockMistakeDAO.list.mockResolvedValueOnce({
      items: [
        {
          id: 'm1',
          problemText: '求1+1',
          userAnswer: '3',
          correctAnswer: '2',
          errorType: 'calculation' as const,
          errorExplanation: '计算错误',
          knowledgePoints: ['方程', '代数'],
          reviewCount: 0,
          masteryLevel: 0,
          reviewed: false,
          lastReview: Date.now(),
        },
      ],
      total: 1,
    });

    const profile = await buildStudentProfile('test-user');

    expect(profile.totalQuestions).toBeGreaterThan(0);
    expect(profile.masteryByKnowledge).toHaveProperty('方程');
    expect(profile.masteryBySubject.math).toBeGreaterThan(0);
  });

  it('caches profile for subsequent calls', async () => {
    mockMistakeDAO.list.mockResolvedValueOnce({ items: [], total: 0 });

    const p1 = await buildStudentProfile('test-user');
    const p2 = await buildStudentProfile('test-user');

    expect(p2).toMatchObject({
      userId: p1.userId,
      totalQuestions: p1.totalQuestions,
      totalCorrect: p1.totalCorrect,
    });
    expect(mockMistakeDAO.list).toHaveBeenCalledTimes(2);
  });

  it('invalidates cache on force refresh', async () => {
    mockMistakeDAO.list.mockResolvedValue({ items: [], total: 0 });

    const callCountBefore = mockMistakeDAO.list.mock.calls.length;
    const p1 = await buildStudentProfile('test-user');
    await invalidateProfileCache('test-user');
    const p2 = await buildStudentProfile('test-user');

    expect(p1).not.toBe(p2);
    expect(mockMistakeDAO.list.mock.calls.length - callCountBefore).toBe(4);
  });
});
