// lib/solve/agents/analyze-types.ts

export type Subject =
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'chinese'
  | 'english'
  | 'history'
  | 'geography'
  | 'politics'
  | 'unknown';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type QuestionType = 'choice' | 'fill' | 'solve' | 'judge';

export interface AnalysisResult {
  subject: Subject;
  knowledgePoints: string[];
  difficulty: Difficulty;
  questionType: QuestionType;
  confidence: number;
}

export const DEFAULT_ANALYSIS: AnalysisResult = {
  subject: 'unknown',
  knowledgePoints: [],
  difficulty: 'medium',
  questionType: 'solve',
  confidence: 0,
};
