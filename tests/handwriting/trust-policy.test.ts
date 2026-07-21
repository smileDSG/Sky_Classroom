import { describe, expect, it } from 'vitest';
import { computeOverallConfidence, determineResultDisposition } from '@/lib/handwriting';

describe('handwriting trust policy', () => {
  it('computes the specified weighted confidence', () => {
    expect(
      computeOverallConfidence({
        imageQuality: 0.8,
        recognitionCompleteness: 0.9,
        graderConfidence: 0.85,
        validatorConfidence: 0.8,
        agentAgreement: 1,
      }),
    ).toBeCloseTo(0.8525, 4);
  });

  it('clamps individual confidence inputs to the zero-to-one range', () => {
    expect(
      computeOverallConfidence({
        imageQuality: 2,
        recognitionCompleteness: 2,
        graderConfidence: 2,
        validatorConfidence: 2,
        agentAgreement: 2,
      }),
    ).toBe(1);
  });

  it.each([
    [0.8, 'formal'],
    [0.799, 'provisional'],
    [0.6, 'provisional'],
    [0.599, 'undetermined'],
  ] as const)('maps confidence %s to %s', (confidence, expected) => {
    expect(determineResultDisposition(confidence, false)).toBe(expected);
  });

  it('never publishes a formal result when a blocking condition exists', () => {
    expect(determineResultDisposition(0.95, true)).toBe('undetermined');
  });
});
