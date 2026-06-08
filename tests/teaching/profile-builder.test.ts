/**
 * D-005 Student Profile Builder — Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildStudentProfile, invalidateProfileCache } from '@/lib/student/profile-builder';

// Mock storage
vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: vi.fn(),
}));

vi.mock('@/lib/storage/dao/mistakes', () => ({
  createMistakeBookDAO: vi.fn(),
}));

const mockMistakeDAO = {
  list: vi.fn(),
};

describe('buildStudentProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    invalidateProfileCache('test-user');

    const { getServerStorage } = await import('@/lib/server/server-storage');
    const { createMistakeBookDAO } = await import('@/lib/storage/dao/mistakes');
    vi.mocked(getServerStorage).mockResolvedValue({} as any);
    vi.mocked(createMistakeBookDAO).mockReturnValue(mockMistakeDAO as any);
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

    expect(p1).toBe(p2);
    expect(mockMistakeDAO.list).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache on force refresh', async () => {
    mockMistakeDAO.list.mockResolvedValue({ items: [], total: 0 });

    const p1 = await buildStudentProfile('test-user');
    invalidateProfileCache('test-user');
    const p2 = await buildStudentProfile('test-user');

    expect(p1).not.toBe(p2);
    expect(mockMistakeDAO.list).toHaveBeenCalledTimes(2);
  });
});
