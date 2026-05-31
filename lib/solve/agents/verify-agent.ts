// lib/solve/agents/verify-agent.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '../solver-constants';
import { VERIFY_SYSTEM_PROMPT, buildVerifyPrompt } from './verify-prompts';
import { matchAnswers } from './answer-matcher';
import { DEFAULT_VERIFY, type VerifyResult } from './verify-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('VerifyAgent');

export async function verifyAnswer(
  problemText: string,
  originalAnswer: string,
): Promise<VerifyResult> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: buildVerifyPrompt(problemText, originalAnswer) }] as any,
        temperature: 0.2,
        maxOutputTokens: 512,
      },
      'verify-agent',
      { retries: 0 },
      undefined,
      VERIFY_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed) {
      log.warn('verifyAnswer: LLM returned invalid JSON');
      return DEFAULT_VERIFY;
    }

    // Use answer-matcher for robust comparison
    const llmAnswer = typeof parsed.yourAnswer === 'string' ? parsed.yourAnswer : '';
    const comparison = matchAnswers(llmAnswer, originalAnswer);

    if (comparison.match) {
      return {
        isCorrect: true,
        confidence: comparison.confidence,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'answers match',
      };
    }

    // Answers differ -- use LLM's suggested answer if available
    const suggested = typeof parsed.suggestedAnswer === 'string'
      ? parsed.suggestedAnswer
      : llmAnswer;

    return {
      isCorrect: false,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : comparison.confidence,
      suggestedAnswer: suggested,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'answers differ',
    };
  } catch (err) {
    log.warn('verifyAnswer failed, returning optimistic default:', err);
    return DEFAULT_VERIFY;
  }
}
