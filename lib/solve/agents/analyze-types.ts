// lib/solve/agents/analyze-types.ts

export interface AnalysisResult {
  subject: string;
  knowledgePoints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  confidence: number;
}

export const DEFAULT_ANALYSIS: AnalysisResult = {
  subject: 'unknown',
  knowledgePoints: [],
  difficulty: 'medium',
  questionType: 'solve',
  confidence: 0,
};
