// lib/solve/agents/correct-agent.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '../solver-constants';
import { buildCorrectPrompt } from './correct-prompts';
import { cleanLatexContent } from '../streaming-solver';
import { createLogger } from '@/lib/logger';

const log = createLogger('CorrectAgent');

export interface CorrectResult {
  steps: { label: string; content: string; keyPoints?: string[] }[];
  answer: string;
}

export async function correctAnswer(
  problemText: string,
  originalAnswer: string,
  suggestedAnswer: string,
  reasoning: string,
): Promise<CorrectResult | null> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const prompt = buildCorrectPrompt(problemText, originalAnswer, suggestedAnswer, reasoning);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
      'correct-agent',
      { retries: 0 },
      undefined,
      '你是解题修正专家。根据校验反馈重新解答题目。输出纯JSON。',
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed || !Array.isArray(parsed.steps) || typeof parsed.answer !== 'string') {
      log.warn('correctAnswer: invalid response');
      return null;
    }

    return {
      steps: (parsed.steps as any[]).map((s) => ({
        label: String(s.label || '修正'),
        content: cleanLatexContent(String(s.content || '')),
        keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.map(String) : [],
      })),
      answer: String(parsed.answer),
    };
  } catch (err) {
    log.warn('correctAnswer failed:', err);
    return null;
  }
}
