export const HANDWRITING_SUBMISSION_STATUSES = [
  'draft',
  'uploaded',
  'quality_checking',
  'quality_rejected',
  'awaiting_region_confirmation',
  'recognizing',
  'awaiting_student_confirmation',
  'ready_to_grade',
  'grading',
  'reviewing_conflict',
  'needs_teacher_review',
  'graded',
  'committed_to_learning',
  'closed',
] as const;

export type HandwritingSubject = 'math' | 'physics';
export type SubmissionStatus = (typeof HANDWRITING_SUBMISSION_STATUSES)[number];

export interface HandwritingSubmission {
  id: string;
  userId: string;
  subject: HandwritingSubject;
  existingProblemId?: string;
  title?: string;
  status: SubmissionStatus;
  pageIds: string[];
  confirmedRecognitionRevisionId?: string;
  activeGradingRunId?: string;
  learningCommitId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImageQualityIssueCode =
  | 'blur'
  | 'glare'
  | 'shadow'
  | 'tilt'
  | 'crop'
  | 'low_resolution'
  | 'duplicate';

export interface ImageQualityIssue {
  code: ImageQualityIssueCode;
  severity: 'warning' | 'blocking';
  confidence: number;
  evidence?: BoundingBox;
  message: string;
}

export interface PageRegion {
  id: string;
  type: 'problem' | 'answer' | 'diagram' | 'formula' | 'unknown';
  box: BoundingBox;
  source: 'auto' | 'student';
  confidence: number;
}

export interface SubmissionPage {
  id: string;
  submissionId: string;
  order: number;
  objectKey: string;
  width: number;
  height: number;
  qualityScore: number;
  qualityIssues: ImageQualityIssue[];
  regions: PageRegion[];
  createdAt: number;
}

export interface UncertainToken {
  id: string;
  text: string;
  alternatives: string[];
  box: BoundingBox;
  confidence: number;
}

export interface RecognizedStep {
  id: string;
  questionId: string;
  order: number;
  text: string;
  latex?: string;
  pageId: string;
  regionId: string;
  confidence: number;
  uncertainTokens: UncertainToken[];
}

export interface RecognitionRevision {
  id: string;
  submissionId: string;
  version: number;
  problemText?: string;
  steps: RecognizedStep[];
  source: 'ocr' | 'student_edit';
  confirmedByStudent: boolean;
  confirmedAt?: number;
  createdAt: number;
}

export type StepJudgement =
  | 'correct'
  | 'partially_correct'
  | 'incorrect'
  | 'process_insufficient'
  | 'consequential_error'
  | 'alternative_valid_method'
  | 'undetermined';

export interface EvidenceReference {
  pageId: string;
  regionId: string;
  stepId?: string;
  quote: string;
  box?: BoundingBox;
}

export interface StepGrade {
  stepId: string;
  judgement: StepJudgement;
  maxScore: number;
  earnedScore: number;
  rubric: string;
  feedback: string;
  evidence: EvidenceReference[];
  confidence: number;
  isFirstCriticalError: boolean;
  causedByStepId?: string;
}

export interface AgentDecision {
  agent: 'grader' | 'solver' | 'validator' | 'reviewer';
  model: string;
  promptVersion: string;
  correctness: 'correct' | 'partial' | 'incorrect' | 'undetermined';
  proposedScore: number | null;
  firstCriticalErrorStepId?: string;
  reasoningSummary: string;
  confidence: number;
  createdAt: number;
}

export interface GradingRun {
  id: string;
  submissionId: string;
  recognitionRevisionId: string;
  attempt: 1 | 2;
  status: 'running' | 'conflict' | 'needs_teacher_review' | 'completed' | 'failed';
  decisions: AgentDecision[];
  stepGrades: StepGrade[];
  finalScore: number | null;
  overallConfidence: number;
  reviewReason?: string;
  eligibleForLearningCommit: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface GradingFeedbackReport {
  id: string;
  submissionId: string;
  gradingRunId?: string;
  type: 'recognition_error' | 'grading_error';
  description?: string;
  evidence?: EvidenceReference[];
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: number;
  resolvedAt?: number;
}

export interface LearningCommit {
  id: string;
  submissionId: string;
  gradingRunId: string;
  idempotencyKey: string;
  mistakeIds: string[];
  profileSignalIds: string[];
  stageEventIds: string[];
  committedAt: number;
}
