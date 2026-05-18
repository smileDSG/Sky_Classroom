/**
 * LangGraph State Annotation for the Solve Graph.
 *
 * Defines the state shape for the solve pipeline:
 *   checkQuestionBank -> routeToAgent -> solveWithAgent -> gradeAnswer -> generateOutput
 */

import { Annotation } from '@langchain/langgraph';
import type {
  GradeResult,
  VotingResult,
  FourPartOutput,
  SolverAgentType,
} from './types';

/**
 * LangGraph state annotation for the solve graph.
 *
 * Uses Annotation.Root() following the pattern in
 * lib/orchestration/state-manager.ts.
 */
export const SolveGraphAnnotation = Annotation.Root({
  // Input fields
  problemText: Annotation<string>({
    default: () => '',
  }),
  problemImage: Annotation<string | null>({
    default: () => null,
  }),
  userAnswer: Annotation<string | null>({
    default: () => null,
  }),

  // Routing
  agentId: Annotation<string>({
    default: () => 'universal',
  }),
  selectedAgentId: Annotation<string | null>({
    default: () => null,
  }),
  agentRoute: Annotation<SolverAgentType | null>({
    default: () => null,
  }),

  // Output fields
  solution: Annotation<string | null>({
    default: () => null,
  }),
  gradeResult: Annotation<GradeResult | null>({
    default: () => null,
  }),
  votingResults: Annotation<VotingResult[]>({
    reducer: (prev, update) => [...prev, ...update],
    default: () => [],
  }),
  fourPartOutput: Annotation<FourPartOutput | null>({
    default: () => null,
  }),
  fromQuestionBank: Annotation<boolean>({
    default: () => false,
  }),

  // Error handling
  error: Annotation<string | null>({
    default: () => null,
  }),
});

export type SolveGraphState = typeof SolveGraphAnnotation.State;
