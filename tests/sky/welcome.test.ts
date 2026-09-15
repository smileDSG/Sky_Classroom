import { describe, expect, it } from 'vitest';
import {
  WELCOME_SEEN_KEY,
  isWelcomeSeen,
  markWelcomeSeen,
  welcomeEntriesFor,
} from '@/lib/sky/welcome';

describe('welcome helpers', () => {
  it('gives teacher entries for educators', () => {
    expect(welcomeEntriesFor('educator')).toEqual([
      { href: '/sky/teaching', label: '备课总览' },
      { href: '/sky/cloud-mind/slides', label: '生成课件' },
    ]);
  });

  it('gives student entries by default', () => {
    expect(welcomeEntriesFor('learner')).toEqual([
      { href: '/sky/learning/today', label: '今日计划' },
      { href: '/sky/cloud-mind/solve', label: '拍题解析' },
    ]);
    expect(welcomeEntriesFor(null)).toHaveLength(2);
  });

  it('tracks seen state in localStorage', () => {
    localStorage.removeItem(WELCOME_SEEN_KEY);
    expect(isWelcomeSeen()).toBe(false);
    markWelcomeSeen();
    expect(isWelcomeSeen()).toBe(true);
    localStorage.removeItem(WELCOME_SEEN_KEY);
  });
});
