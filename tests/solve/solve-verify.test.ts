import { describe, it, expect } from 'vitest';
import {
  isDeterministic,
  decideVerification,
  resolveReviewStatus,
  isVerifiedReview,
} from '@/lib/solve/solve-verify';

describe('isDeterministic', () => {
  it('treats choice/fill/judge as deterministic (定值答案)', () => {
    expect(isDeterministic('choice')).toBe(true);
    expect(isDeterministic('fill')).toBe(true);
    expect(isDeterministic('judge')).toBe(true);
  });

  it('treats solve and unknown/empty as non-deterministic', () => {
    expect(isDeterministic('solve')).toBe(false);
    expect(isDeterministic(undefined)).toBe(false);
    expect(isDeterministic(null)).toBe(false);
    expect(isDeterministic('')).toBe(false);
  });
});

describe('decideVerification', () => {
  it('skips when there is no answer', () => {
    const d = decideVerification({
      questionType: 'fill',
      hasAnswer: false,
      analysisConfidence: 0.9,
    });
    expect(d.shouldVerify).toBe(false);
  });

  it('forces verification for deterministic answers even with high confidence / pure numeric / short problem', () => {
    // 旧逻辑会因"高置信 + 纯数字答案 + 超短题"跳过；新逻辑对可判定题强制复核
    const d = decideVerification({
      questionType: 'fill',
      hasAnswer: true,
      analysisConfidence: 0.95,
    });
    expect(d.shouldVerify).toBe(true);
    expect(d.reason).toContain('强制独立复核');
  });

  it('verifies open-ended solve questions even on high confidence (conclusion-level check)', () => {
    const d = decideVerification({
      questionType: 'solve',
      hasAnswer: true,
      analysisConfidence: 0.9,
    });
    expect(d.shouldVerify).toBe(true);
  });

  it('verifies open-ended solve questions regardless of confidence', () => {
    const d = decideVerification({
      questionType: 'solve',
      hasAnswer: true,
      analysisConfidence: 0.5,
    });
    expect(d.shouldVerify).toBe(true);
    expect(d.reason).toContain('结论级独立复核');
  });

  it('verifies unknown question type (defaults to open-ended) when it has an answer', () => {
    const d = decideVerification({
      questionType: null,
      hasAnswer: true,
      analysisConfidence: 0.5,
    });
    expect(d.shouldVerify).toBe(true);
  });
});

describe('resolveReviewStatus', () => {
  it('returns skipped when intentionally skipped', () => {
    expect(resolveReviewStatus({ skipped: true, verifyPassed: true, corrected: false })).toBe(
      'skipped',
    );
  });

  it('returns verified when independent check passed', () => {
    expect(resolveReviewStatus({ skipped: false, verifyPassed: true, corrected: false })).toBe(
      'verified',
    );
  });

  it('returns corrected when independent check disagreed and correction succeeded', () => {
    expect(resolveReviewStatus({ skipped: false, verifyPassed: false, corrected: true })).toBe(
      'corrected',
    );
  });

  it('returns pending-confirmation when check failed and nothing corrected it', () => {
    expect(resolveReviewStatus({ skipped: false, verifyPassed: false, corrected: false })).toBe(
      'pending-confirmation',
    );
  });
});

describe('isVerifiedReview', () => {
  it('only trusts verified/corrected answers', () => {
    expect(isVerifiedReview('verified')).toBe(true);
    expect(isVerifiedReview('corrected')).toBe(true);
    expect(isVerifiedReview('pending-confirmation')).toBe(false);
    expect(isVerifiedReview('skipped')).toBe(false);
    expect(isVerifiedReview(undefined)).toBe(false);
    expect(isVerifiedReview(null)).toBe(false);
  });
});
