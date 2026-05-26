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
  hashProblemText,
  textSimilarity,
} from './question-bank';
export { classifyErrorCause, getCauseLabel, isValidCause, VALID_CAUSES, CAUSE_LABELS } from './error-classifier';
export {
  AGENT_MODEL_MAP,
  ENV_KEY_MAP,
  ENV_URL_MAP,
  resolveSolverModel,
  classifyProblem,
} from './solver-constants';
