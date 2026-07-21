import type { SubmissionStatus } from './types';

const ALLOWED_TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  draft: ['uploaded', 'closed'],
  uploaded: ['quality_checking', 'closed'],
  quality_checking: ['quality_rejected', 'awaiting_region_confirmation', 'recognizing'],
  quality_rejected: ['uploaded', 'closed'],
  awaiting_region_confirmation: ['recognizing', 'closed'],
  recognizing: ['awaiting_student_confirmation', 'quality_rejected', 'closed'],
  awaiting_student_confirmation: ['ready_to_grade', 'recognizing', 'closed'],
  ready_to_grade: ['grading', 'closed'],
  grading: ['reviewing_conflict', 'needs_teacher_review', 'graded', 'ready_to_grade'],
  reviewing_conflict: ['needs_teacher_review', 'graded', 'ready_to_grade'],
  needs_teacher_review: ['graded', 'ready_to_grade', 'closed'],
  graded: ['committed_to_learning', 'ready_to_grade', 'closed'],
  committed_to_learning: ['ready_to_grade', 'closed'],
  closed: [],
};

export function canTransitionSubmission(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionSubmission(
  from: SubmissionStatus,
  to: SubmissionStatus,
): SubmissionStatus {
  if (!canTransitionSubmission(from, to)) {
    throw new Error(`Illegal handwriting submission transition: ${from} -> ${to}`);
  }
  return to;
}
