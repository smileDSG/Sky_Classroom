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
