/**
 * Shared types for the Sky Classroom solve/grading module.
 */

// ── Agent types ────────────────────────────────────────────────────

export type SolverAgentType =
  | 'universal'   // 通用解题（DeepSeek V4 Flash）
  | 'science'     // 理科专精（GLM-5.1）
  | 'humanities'  // 文科综合（Qwen3.6 Plus）
  | 'grading';    // 批改专精（高精度模型）

// ── Solve graph state ─────────────────────────────────────────────

/**
 * High-level solve state used by the UI store and API contracts.
 *
 * Mirrored by SolveGraphState (lib/solve/solve-graph-state.ts) which
 * adds LangGraph-specific fields (`selectedAgentId`, `agentRoute`, `error`)
 * for graph execution. Keep both types in sync when adding new fields.
 */
export interface SolveState {
  problemText: string;
  problemImage: string | null;
  userAnswer: string | null;
  agentId: string;
  selectedAgentId: string | null;   // agent chosen by routing (null = not yet routed)
  agentRoute: SolverAgentType | null; // routed agent type
  solution: string | null;
  gradeResult: GradeResult | null;
  votingResults: VotingResult[];
  fourPartOutput: FourPartOutput | null;
  fromQuestionBank: boolean;
  fromSolveCache: boolean;
  error: string | null;
}

// ── Grading ───────────────────────────────────────────────────────

export type MistakeCause =
  | 'concept-unclear'   // 概念不清
  | 'calculation-error' // 计算失误
  | 'misreading'        // 审题错误
  | 'method-wrong'      // 方法错误
  | 'careless'          // 粗心
  | 'format-error';     // 格式错误

export interface GradeResult {
  isCorrect: boolean;
  score: number;                    // 0-100
  correctAnswer: string;
  userAnswer: string;
  errorAnalysis: string;
  cause: MistakeCause;
  partialCredit?: {
    step: string;
    maxScore: number;
    earnedScore: number;
    comment: string;
  }[];
}

// ── Voting ────────────────────────────────────────────────────────

export interface VotingResult {
  agentId: SolverAgentType;
  answer: string;
  confidence: number;  // 0-1
}

export interface VotingResolution {
  agreed: boolean;
  finalAnswer: string;
  needsHumanReview: boolean;
}

// ── Four-part output ──────────────────────────────────────────────

export interface FourPartOutput {
  answer: string;
  steps: {
    label: string;
    content: string;
    keyPoints?: string[];
  }[];
  knowledgePoints: {
    name: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }[];
  similarQuestions: {
    problem: string;
    difficulty: number;
    knowledgePoint: string;
  }[];
}

export interface GradedFourPartOutput extends FourPartOutput {
  gradeResult: GradeResult;
  mistakeAnalysis: string;
  recommendedPractice: {
    problem: string;
    reason: string;
  }[];
}

// ── Question bank ─────────────────────────────────────────────────

export interface QuestionBankEntry {
  id: string;
  problemHash: string;
  problemText: string;
  problemImage?: string;
  answer: string;
  steps: string[];
  knowledgePoints: string[];
  agentId: SolverAgentType;
  solvedAt: number;  // Unix timestamp ms
  verified: boolean;
  /** Runtime-only similarity score (not persisted) */
  _similarity?: number;
}

// ── Recognition ───────────────────────────────────────────────────

export interface RecognizedProblem {
  image: string;    // base64 or data URL of cropped problem region
  text: string;     // extracted text
  latex: string;    // extracted LaTeX formulas
}

export interface ImageRecognitionResult {
  text: string;
  latex: string;
  problemCount: number;
  problems?: RecognizedProblem[];
}
