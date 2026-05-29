/**
 * Sky Classroom solve module — barrel export.
 */

export type {
  SolverAgentType,
  SolveState,
  MistakeCause,
  GradeResult,
  VotingResult,
  VotingResolution,
  FourPartOutput,
  GradedFourPartOutput,
  QuestionBankEntry,
  ImageRecognitionResult,
  RecognizedProblem,
} from './types';

export { buildSolverPrompt } from './solver-prompts';
export { solveWithAgentNode, parseSolutionResponse } from './solver-agent';
export { SolveGraphAnnotation } from './solve-graph-state';
export type { SolveGraphState } from './solve-graph-state';
export {
  createSolveGraph,
  buildSolveInitialState,
  afterCheckSolveCache,
  afterCheckBank,
  afterSolve,
} from './solve-graph';
export { gradeAnswer, gradeAnswerSync } from './grader';
export {
  findSimilarQuestions,
  saveToQuestionBank,
  deleteQuestionBankEntry,
  listQuestionBankEntries,
  questionBankCount,
  clearQuestionBank,
  isProblemInBank,
} from './question-bank';
export { hashProblemText, textSimilarity } from './question-bank-utils';
export { classifyErrorCause, getCauseLabel, isValidCause, VALID_CAUSES } from './error-classifier';
export { validateConfidence, MIN_VALIDATED_CONFIDENCE } from './confidence-validator';
export {
  findSolveCacheMatches,
  saveToSolveCache,
  solveCacheCount,
  clearSolveCache,
  type SolveCacheEntry,
} from './solve-cache';
