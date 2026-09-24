import { describe, expect, it } from 'vitest';
import { TOUR_SEEN_KEY, TOUR_STEPS, isTourSeen, markTourSeen } from '@/lib/sky/tour';
import { HOME_TOUR_STEPS } from '@/lib/sky/home-tour';

describe('/sky dashboard tour steps', () => {
  it('defines operation-oriented steps anchored to real elements', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'generate-classroom',
      'today-focus',
      'mistakes',
      'learning-plan',
      'profile-link',
    ]);
    for (const step of TOUR_STEPS) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(12);
    }
  });
});

describe('home tour steps', () => {
  it('covers the create-classroom flow as concrete steps', () => {
    expect(HOME_TOUR_STEPS.map((step) => step.id)).toEqual([
      'hero-input',
      'home-pdf-upload',
      'home-websearch',
      'home-interactive',
      'home-submit',
      'workspace-portals',
    ]);
    for (const step of HOME_TOUR_STEPS) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });
});

describe('onboarding tour helpers', () => {
  it('tracks seen state in localStorage', () => {
    localStorage.removeItem(TOUR_SEEN_KEY);
    expect(isTourSeen()).toBe(false);
    markTourSeen();
    expect(isTourSeen()).toBe(true);
    localStorage.removeItem(TOUR_SEEN_KEY);
  });
});