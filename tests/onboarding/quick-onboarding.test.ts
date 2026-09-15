import { describe, expect, it } from 'vitest';
import {
  QUICK_IDENTITY_KEY,
  isQuickIdentity,
  persistQuickIdentity,
} from '@/lib/onboarding/quick-onboarding';

describe('quick onboarding helpers', () => {
  it('recognizes only learner/educator as quick identities', () => {
    expect(isQuickIdentity('learner')).toBe(true);
    expect(isQuickIdentity('educator')).toBe(true);
    expect(isQuickIdentity('guardian')).toBe(false);
    expect(isQuickIdentity(null)).toBe(false);
  });

  it('persists the identity to localStorage', () => {
    persistQuickIdentity('learner');
    expect(localStorage.getItem(QUICK_IDENTITY_KEY)).toBe('learner');
    localStorage.removeItem(QUICK_IDENTITY_KEY);
  });
});
