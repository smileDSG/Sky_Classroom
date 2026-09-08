/**
 * Lightweight route context helpers for mobile pages.
 *
 * Member B pages can use these constants instead of hard-coding
 * mobile-specific route decisions.
 */

export const MOBILE_SKY_ROUTES = {
  home: '/sky',
  cloudMind: '/sky/cloud-mind',
  learning: '/sky/learning',
  assistant: '/sky/assistant',
  account: '/account',
  studyLab: '/sky/study-lab',
  settings: '/settings',
} as const;

export type MobileSkyRoute = (typeof MOBILE_SKY_ROUTES)[keyof typeof MOBILE_SKY_ROUTES];
