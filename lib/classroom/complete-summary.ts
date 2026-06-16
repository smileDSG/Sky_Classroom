import type { Scene, SceneType, QuizContent } from '@/lib/types/stage';
import { gradeChoiceQuestions, toArray } from '@/lib/quiz/grading';

export interface QuizDetail {
  sceneId: string;
  questionId: string;
  question: string;
  userAnswer: string[];
  correctAnswer: string[];
  isCorrect: boolean;
  knowledgePoints?: string[];
  analysis?: string;
}

export interface QuizResultItem {
  sceneId: string;
  questionId: string;
  question: string;
  options: string[];
  userAnswer: string | string[];
  correctAnswer: string | string[];
  isCorrect: boolean;
  knowledgePoints: string[];
  explanation?: string;
}

export interface CompleteSummary {
  countsByType: Partial<Record<SceneType, number>>;
  quiz: { correct: number; total: number; pct: number } | null;
  quizDetails: QuizDetail[];
  /** All quiz results (including correct ones) for result reflow to Teaching module */
  allQuizResults: QuizResultItem[];
}

export type AnswerReader = (sceneId: string) => Record<string, string | string[]>;

export function summarizeScenes(scenes: Scene[], readAnswers: AnswerReader): CompleteSummary {
  const countsByType: Partial<Record<SceneType, number>> = {};
  for (const scene of scenes) {
    countsByType[scene.type] = (countsByType[scene.type] ?? 0) + 1;
  }

  let correct = 0;
  let total = 0;
  const quizDetails: QuizDetail[] = [];
  const allQuizResults: QuizResultItem[] = [];

  for (const scene of scenes) {
    if (scene.type !== 'quiz') continue;
    const quizContent = scene.content as QuizContent;
    const questions = quizContent.questions ?? [];
    const answers = readAnswers(scene.id);
    const results = gradeChoiceQuestions(questions, answers);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const r = results[i];
      if (!r) continue;
      total += 1;
      const isCorrect = r.correct === true;
      if (isCorrect) {
        correct += 1;
      } else {
        quizDetails.push({
          sceneId: scene.id,
          questionId: q.id,
          question: q.question,
          userAnswer: toArray(answers[q.id]),
          correctAnswer: toArray(q.answer),
          isCorrect: false,
          knowledgePoints: quizContent.knowledgePoints ?? [],
          analysis: q.analysis,
        });
      }

      allQuizResults.push({
        sceneId: scene.id,
        questionId: q.id,
        question: q.question,
        options: (q.options ?? []).map((o) => o.label || o.value),
        userAnswer: answers[q.id] ?? '',
        correctAnswer: q.answer ?? [],
        isCorrect,
        knowledgePoints: quizContent.knowledgePoints ?? [],
        explanation: q.analysis,
      });
    }
  }

  const quiz = total > 0 ? { correct, total, pct: Math.round((correct / total) * 100) } : null;

  return { countsByType, quiz, quizDetails, allQuizResults };
}
