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
  ProblemSpec,
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
  problemSpec: Annotation<ProblemSpec | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  userAnswer: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  adaptiveGuidance: Annotation<string | null>({
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
  parsedAnswer: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  parsedSteps: Annotation<{ label: string; content: string; keyPoints?: string[] }[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  parsedKnowledgePoints: Annotation<{ name: string; description: string; difficulty: string }[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  parsedSimilarQuestions: Annotation<
    { problem: string; difficulty: number; knowledgePoint: string }[]
  >({
    value: (_prev, next) => next,
    default: () => [],
  }),
  questionType: Annotation<'choice' | 'fill' | 'solve' | 'judge' | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  options: Annotation<string[] | null>({
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
  /** 答案自校验结论（verified/corrected/pending-confirmation/skipped）。 */
  answerReview: Annotation<'verified' | 'corrected' | 'pending-confirmation' | 'skipped' | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  /** 最终答案是否经独立复核（answerReview ∈ verified/corrected）。 */
  verified: Annotation<boolean>({
    value: (_prev, next) => next,
    default: () => false,
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
