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
    value: (_prev, next) => next,
    default: () => '',
  }),
  problemImage: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  userAnswer: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),

  // Routing
  agentId: Annotation<string>({
    value: (_prev, next) => next,
    default: () => 'universal',
  }),
  selectedAgentId: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  agentRoute: Annotation<SolverAgentType | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),

  // Output fields
  solution: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  gradeResult: Annotation<GradeResult | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  votingResults: Annotation<VotingResult[]>({
    reducer: (prev, update) => [...prev, ...update],
    default: () => [],
  }),
  fourPartOutput: Annotation<FourPartOutput | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  fromQuestionBank: Annotation<boolean>({
    value: (_prev, next) => next,
    default: () => false,
  }),
  fromSolveCache: Annotation<boolean>({
    value: (_prev, next) => next,
    default: () => false,
  }),

  // Error handling
  error: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
});

export type SolveGraphState = typeof SolveGraphAnnotation.State;
