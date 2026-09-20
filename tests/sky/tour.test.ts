import { describe, expect, it } from 'vitest';
import { TOUR_SEEN_KEY, TOUR_STEPS, isTourSeen, markTourSeen } from '@/lib/sky/tour';

describe('onboarding tour helpers', () => {
  it('defines a focused set of steps', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'today-focus',
      'learning-plan',
      'profile-link',
    ]);
    for (const step of TOUR_STEPS) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('tracks seen state in localStorage', () => {
    localStorage.removeItem(TOUR_SEEN_KEY);
    expect(isTourSeen()).toBe(false);
    markTourSeen();
    expect(isTourSeen()).toBe(true);
    localStorage.removeItem(TOUR_SEEN_KEY);
  });
});
