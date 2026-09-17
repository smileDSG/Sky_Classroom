/**
 * Cloud Mind Quiz — auto-backfill AI-generated questions into the question bank.
 *
 * Runs after a successful quiz generation job. Deduplicates by problem hash
 * (same as solve's saveToQuestionBank) and tags entries as AI-generated so
 * "生成题" can be distinguished from curated/standard questions.
 */

import { createLogger } from '@/lib/logger';
import { getSubjectLabelOrSelf } from '@/lib/mistakes/subject-inference';
import { hashProblemText } from '@/lib/solve/question-bank-utils';
import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { QuizOutput, QuizQuestion } from './quiz-agent';

const log = createLogger('QuizBackfill');

export interface QuizBackfillStats {
  backfilled: number;
  duplicates: number;
  errors: number;
}

export function buildBankAnswer(question: QuizQuestion): string {
  if (question.questionType === 'choice') {
    return String.fromCharCode(65 + Math.min(Math.max(question.answer, 0), 3));
  }
  return question.answerText;
}

export function buildBankQuestion(
  question: QuizQuestion,
  input: { subject: string; difficulty: string; topic: string },
): QuestionBankInsert {
  return {
    subject: getSubjectLabelOrSelf(input.subject),
    grade: '',
    difficulty: input.difficulty as QuestionBankInsert['difficulty'],
    questionType: question.questionType,
    content: question.question,
    answer: buildBankAnswer(question),
    explanation: question.explanation,
    knowledgePoints: input.topic.trim() ? [input.topic.trim()] : [],
    options: question.options.length > 0 ? question.options : undefined,
    source: 'AI智能出题',
    tags: ['AI生成', '智能出题', '生成题'],
    verified: true,
  };
}

/**
 * Persist generated questions into the dedicated question_bank table.
 * Deduplicates by problem_hash; a failed save never throws (counted as error).
 */
export async function backfillQuizToQuestionBank(
  quiz: QuizOutput,
  input: { subject: string; difficulty: string; topic: string },
): Promise<QuizBackfillStats> {
  const { findByHash, insertOne } = await import('@/lib/question-bank/dao');

  const stats: QuizBackfillStats = { backfilled: 0, duplicates: 0, errors: 0 };

  for (const question of quiz.questions) {
    const content = question.question.trim();
    if (!content) {
      stats.errors += 1;
      continue;
    }
    try {
      const problemHash = hashProblemText(content);
      const existing = await findByHash(problemHash);
      if (existing) {
        stats.duplicates += 1;
        continue;
      }
      await insertOne(buildBankQuestion(question, input));
      stats.backfilled += 1;
    } catch (error) {
      stats.errors += 1;
      log.error(`[QuizBackfill] save question #${question.id} failed:`, error);
    }
  }

  log.info(
    `[QuizBackfill] ${stats.backfilled} saved, ${stats.duplicates} duplicates, ${stats.errors} errors`,
  );
  return stats;
}
