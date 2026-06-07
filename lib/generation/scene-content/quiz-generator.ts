/**
 * Quiz content generation.
 *
 * Generates quiz questions from a SceneOutline.
 */

import { nanoid } from 'nanoid';
import type { SceneOutline, GeneratedQuizContent } from '@/lib/types/generation';
import type { QuizQuestion } from '@/lib/types/stage';
import type { AICallFn } from '../pipeline-types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseJsonResponse } from '../json-repair';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

function normalizeQuizOptions(
  options: unknown[] | undefined,
): { value: string; label: string }[] | undefined {
  if (!options || !Array.isArray(options)) return undefined;

  return options.map((opt, index) => {
    const letter = String.fromCharCode(65 + index);

    if (typeof opt === 'string') {
      return { value: letter, label: opt };
    }

    if (typeof opt === 'object' && opt !== null) {
      const obj = opt as Record<string, unknown>;
      return {
        value: typeof obj.value === 'string' ? obj.value : letter,
        label: typeof obj.label === 'string' ? obj.label : String(obj.value || obj.text || letter),
      };
    }

    return { value: letter, label: String(opt) };
  });
}

function normalizeQuizAnswer(question: Record<string, unknown>): string[] | undefined {
  const raw =
    question.answer ??
    question.correctAnswer ??
    (question as Record<string, unknown>).correct_answer;
  if (!raw) return undefined;

  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  return [String(raw)];
}

export async function generateQuizContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<GeneratedQuizContent | null> {
  const quizConfig = outline.quizConfig || {
    questionCount: 3,
    difficulty: 'medium',
    questionTypes: ['single'],
  };

  const prompts = buildPrompt(PROMPT_IDS.QUIZ, {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    questionCount: quizConfig.questionCount,
    difficulty: quizConfig.difficulty,
    questionTypes: quizConfig.questionTypes.join(', '),
    languageDirective: languageDirective || '',
  });

  if (!prompts) {
    return null;
  }

  log.debug(`Generating quiz content for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user);

  // Parse response — may be an array (legacy) or an object with questions + knowledgePoints
  const parsed = parseJsonResponse<QuizQuestion[] | { questions: QuizQuestion[]; knowledgePoints?: string[] }>(response);

  let generatedQuestions: QuizQuestion[];
  let knowledgePoints: string[] | undefined;

  if (Array.isArray(parsed)) {
    generatedQuestions = parsed;
  } else if (parsed && typeof parsed === 'object' && 'questions' in parsed && Array.isArray(parsed.questions)) {
    generatedQuestions = parsed.questions;
    knowledgePoints = parsed.knowledgePoints;
  } else {
    log.error(`Failed to parse AI response for: ${outline.title}`);
    return null;
  }

  if (!generatedQuestions.length) {
    log.error(`No questions in response for: ${outline.title}`);
    return null;
  }

  log.debug(`Got ${generatedQuestions.length} questions for: ${outline.title}`);

  const questions: QuizQuestion[] = generatedQuestions.map((q) => {
    const isText = q.type === 'short_answer';
    return {
      ...q,
      id: q.id || `q_${nanoid(8)}`,
      options: isText ? undefined : normalizeQuizOptions(q.options),
      answer: isText ? undefined : normalizeQuizAnswer(q as unknown as Record<string, unknown>),
      hasAnswer: isText ? false : true,
    };
  });

  return { questions, knowledgePoints };
}
