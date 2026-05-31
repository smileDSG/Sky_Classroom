import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '../solver-constants';
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzePrompt } from './analyze-prompts';
import { DEFAULT_ANALYSIS, type AnalysisResult } from './analyze-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnalyzeAgent');

export async function analyzeProblem(problemText: string): Promise<AnalysisResult> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: buildAnalyzePrompt(problemText) }] as any,
        temperature: 0.2,
        maxOutputTokens: 512,
      },
      'analyze-agent',
      { retries: 1 },
      undefined,
      ANALYZE_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed) {
      log.warn('analyzeProblem: LLM returned invalid JSON');
      return DEFAULT_ANALYSIS;
    }

    const analysis: AnalysisResult = {
      subject: typeof parsed.subject === 'string' ? parsed.subject : DEFAULT_ANALYSIS.subject,
      knowledgePoints: Array.isArray(parsed.knowledgePoints)
        ? (parsed.knowledgePoints as string[]).slice(0, 4)
        : DEFAULT_ANALYSIS.knowledgePoints,
      difficulty: ['easy', 'medium', 'hard'].includes(parsed.difficulty as string)
        ? (parsed.difficulty as AnalysisResult['difficulty'])
        : DEFAULT_ANALYSIS.difficulty,
      questionType: ['choice', 'fill', 'solve', 'judge'].includes(parsed.questionType as string)
        ? (parsed.questionType as AnalysisResult['questionType'])
        : DEFAULT_ANALYSIS.questionType,
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : DEFAULT_ANALYSIS.confidence,
    };

    log.info(`analyzeProblem: subject=${analysis.subject}, type=${analysis.questionType}, difficulty=${analysis.difficulty}`);
    return analysis;
  } catch (err) {
    log.warn('analyzeProblem failed, returning default:', err);
    return DEFAULT_ANALYSIS;
  }
}
