// lib/solve/agents/verify-agent.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel, SOLVE_THINKING_CONFIG } from '../solver-constants';
import { VERIFY_SYSTEM_PROMPT, buildVerifyPrompt } from './verify-prompts';
import { matchAnswers } from './answer-matcher';
import { DEFAULT_VERIFY, type VerifyResult } from './verify-types';
import { createLogger } from '@/lib/logger';
import type { ProblemSpec } from '../types';

const log = createLogger('VerifyAgent');

/**
 * Use the 'science' model (GLM-5.1) for verification — different from
 * the solve agent's default ('universal' / DeepSeek Flash) to ensure
 * truly independent validation. 'grading' maps to the same model as
 * 'universal', so we use 'science' instead.
 */
const VERIFY_MODEL_KEY = 'science';

export async function verifyAnswer(
  problemText: string,
  originalAnswer: string,
  problemSpec?: ProblemSpec | null,
): Promise<VerifyResult> {
  try {
    const modelConfig = resolveSolverModel(VERIFY_MODEL_KEY);
    const { model } = getModel(modelConfig);

    const result = await callLLM(
      {
        model,
        messages: [
          { role: 'user', content: buildVerifyPrompt(problemText, originalAnswer, problemSpec) },
        ] as any,
        temperature: 0.2,
        maxOutputTokens: 512,
      },
      'verify-agent',
      { retries: 0 },
      SOLVE_THINKING_CONFIG,
      VERIFY_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed) {
      log.warn('verifyAnswer: LLM returned invalid JSON');
      return DEFAULT_VERIFY;
    }

    // The LLM provides its own independently-derived answer.
    // We use answer-matcher to robustly compare it against the original.
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
    const suggested =
      typeof parsed.suggestedAnswer === 'string' ? parsed.suggestedAnswer : llmAnswer;

    return {
      isCorrect: false,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : comparison.confidence,
      suggestedAnswer: suggested,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'answers differ',
    };
  } catch (err) {
    log.warn('verifyAnswer caught error, returning fail-safe default:', err);
    // Return isCorrect=false so the pipeline doesn't silently accept a bad answer.
    return DEFAULT_VERIFY;
  }
}
