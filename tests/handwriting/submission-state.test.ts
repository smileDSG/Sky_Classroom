import { describe, expect, it } from 'vitest';
import { canTransitionSubmission, transitionSubmission } from '@/lib/handwriting';

describe('handwriting submission state', () => {
  it('requires student confirmation before grading', () => {
    expect(canTransitionSubmission('awaiting_student_confirmation', 'grading')).toBe(false);
    expect(canTransitionSubmission('awaiting_student_confirmation', 'ready_to_grade')).toBe(true);
  });

  it('allows a failed grading attempt to return to the ready state', () => {
    expect(canTransitionSubmission('grading', 'ready_to_grade')).toBe(true);
  });

  it('rejects illegal transitions with a useful error', () => {
    expect(() => transitionSubmission('uploaded', 'graded')).toThrow(
      'Illegal handwriting submission transition: uploaded -> graded',
    );
  });

  it('keeps closed submissions terminal', () => {
    expect(canTransitionSubmission('closed', 'uploaded')).toBe(false);
  });
});
