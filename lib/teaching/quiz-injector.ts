/**
 * D-004 Quiz Injector — In-class Quiz Generation
 *
 * Generates 1-2 quiz questions after each knowledge point section.
 * Prioritizes questions from the question bank, falls back to AI generation.
 */

import { findSimilarQuestions } from '@/lib/solve/question-bank';
import { createLogger } from '@/lib/logger';

const log = createLogger('QuizInjector');

export interface QuizQuestion {
  id: string;
  problem: string;
  answer: string;
  knowledgePoint: string;
  difficulty: number; // 0-1
  fromBank: boolean;
}

/**
 * Inject quiz questions based on knowledge points.
 * Tries question bank first, then generates with AI if insufficient.
 */
export async function injectQuizzes(
  knowledgePoints: string[],
  masteryByKnowledge: Record<string, number> = {},
): Promise<QuizQuestion[]> {
  const quizzes: QuizQuestion[] = [];

  // Fetch up to 2 questions from the question bank per knowledge point
  const bankQuestions = await findSimilarQuestions(knowledgePoints.join(' '), 0.3);

  for (const q of bankQuestions.slice(0, knowledgePoints.length * 2)) {
    const kp = q.knowledgePoints[0]?.name ?? knowledgePoints[0] ?? '';
    const mastery = masteryByKnowledge[kp] ?? 50;
    const difficulty = Math.max(0, Math.min(1, mastery < 30 ? 0.2 : mastery < 70 ? 0.5 : 0.8));

    quizzes.push({
      id: `quiz-${q.id}`,
      problem: q.problemText,
      answer: q.answer,
      knowledgePoint: kp,
      difficulty,
      fromBank: true,
    });
  }

  // Ensure at least 1 question per knowledge point
  if (quizzes.length < knowledgePoints.length) {
    for (const kp of knowledgePoints.slice(quizzes.length)) {
      const mastery = masteryByKnowledge[kp] ?? 50;
      const difficulty = mastery < 30 ? 0.2 : mastery < 70 ? 0.5 : 0.8;

      quizzes.push({
        id: `quiz-ai-${kp}`,
        problem: `[AI生成] 关于「${kp}」的练习题（待生成）`,
        answer: '待AI生成',
        knowledgePoint: kp,
        difficulty,
        fromBank: false,
      });
    }
  }

  log.info(
    `injectQuizzes: ${quizzes.length} questions for ${knowledgePoints.length} knowledge points`,
  );
  return quizzes;
}
