/**
 * Homework Generator — Personalized post-lesson assignment engine.
 *
 * Analyzes teaching job data (feedback, quiz results) to identify weak knowledge
 * points, then searches the question bank or generates AI questions to build
 * a tailored homework assignment.
 */

import { search } from '@/lib/question-bank/dao';
import { generateQuiz } from '@/lib/agents/cloud-mind/quiz-agent';
import { createLogger } from '@/lib/logger';
import { resolveSubject } from '@/lib/student/profile-config';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { SectionFeedback, QuizResult } from './adaptive-engine';

const log = createLogger('HomeworkGenerator');

export interface HomeworkQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  knowledgePoint: string;
  source: 'question-bank' | 'ai-generated';
}

export interface HomeworkAssignment {
  title: string;
  description: string;
  questions: HomeworkQuestion[];
  weakKnowledgePoints: string[];
  estimatedDuration: number; // minutes
}

/** Extract weak knowledge points from job feedback and quiz results. */
function extractWeakPoints(
  feedbacks: SectionFeedback[],
  quizResults: QuizResult[],
): string[] {
  const weakSet = new Set<string>();

  for (const fb of feedbacks) {
    if (fb.feedbackType === 'needs_review') {
      for (const kp of fb.knowledgePoints) {
        weakSet.add(kp);
      }
    }
  }

  for (const qr of quizResults) {
    if (!qr.isCorrect && qr.knowledgePoints) {
      for (const kp of qr.knowledgePoints) {
        weakSet.add(kp);
      }
    }
  }

  return Array.from(weakSet);
}

/** Search question bank for questions targeting given knowledge points. */
async function searchBankQuestions(
  knowledgePoints: string[],
  subject: string = 'math',
  limitPerPoint: number = 2,
): Promise<HomeworkQuestion[]> {
  const questions: HomeworkQuestion[] = [];
  let id = 1;

  for (const kp of knowledgePoints) {
    if (questions.length >= 10) break;
    try {
      const rows = await search({
        subject,
        knowledgePoint: kp,
        questionType: 'choice',
        limit: limitPerPoint,
      });

      for (const row of rows) {
        if (!row.options || row.options.length < 2) continue;

        // Normalize answer to 0-based index
        let answerIndex = 0;
        const ans = String(row.answer).trim().toUpperCase();
        if (/^[A-D]$/.test(ans)) {
          answerIndex = ans.charCodeAt(0) - 65;
        } else {
          const num = Number(ans);
          if (!Number.isNaN(num) && num >= 0 && num < row.options.length) {
            answerIndex = num;
          }
        }

        questions.push({
          id: id++,
          question: row.content,
          options: row.options.slice(0, 4),
          answer: answerIndex,
          explanation: row.explanation || '暂无解析',
          knowledgePoint: kp,
          source: 'question-bank',
        });
      }
    } catch (err) {
      log.warn(`Failed to search question bank for "${kp}":`, err);
    }
  }

  return questions;
}

/** Generate AI questions for remaining weak points. */
async function generateAIQuestions(
  knowledgePoints: string[],
  subject: string = 'math',
  count: number = 3,
): Promise<HomeworkQuestion[]> {
  const questions: HomeworkQuestion[] = [];

  try {
    const topicStr = knowledgePoints.join('、');
    const quiz = await generateQuiz(subject, 'medium', topicStr, count);

    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      questions.push({
        id: i + 1,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        knowledgePoint: knowledgePoints[Math.min(i, knowledgePoints.length - 1)] || topicStr,
        source: 'ai-generated',
      });
    }
  } catch (err) {
    log.warn('AI homework generation failed:', err);
  }

  return questions;
}

/** Generate a personalized homework assignment for a completed teaching job. */
export async function generateHomework(
  feedbacks: SectionFeedback[],
  quizResults: QuizResult[],
  topic: string,
  subject?: string,
  profile?: StudentProfile,
): Promise<HomeworkAssignment> {
  const resolvedSubject = subject || resolveSubject(topic, profile);
  const weakPoints = extractWeakPoints(feedbacks, quizResults);

  if (weakPoints.length === 0) {
    // No weak points: generate a general reinforcement assignment on the topic
    log.info(`No weak points for "${topic}", generating general reinforcement`);
    const aiQuestions = await generateAIQuestions([topic], resolvedSubject, 3);
    return {
      title: `${topic} — 巩固练习`,
      description: '你在本节课中表现良好，这里有几道巩固练习题帮助你加深印象。',
      questions: aiQuestions,
      weakKnowledgePoints: [],
      estimatedDuration: aiQuestions.length * 3,
    };
  }

  // Strategy 1: Search question bank
  let questions = await searchBankQuestions(weakPoints, resolvedSubject, 2);
  log.info(`Found ${questions.length} questions from question bank for weak points: ${weakPoints.join('、')}`);

  // Strategy 2: If not enough, use AI generation
  const targetCount = Math.min(weakPoints.length * 2 + 1, 8);
  if (questions.length < targetCount) {
    const remaining = targetCount - questions.length;
    const aiQuestions = await generateAIQuestions(weakPoints, resolvedSubject, remaining);
    // Re-number IDs
    const maxId = questions.length > 0 ? Math.max(...questions.map((q) => q.id)) : 0;
    for (let i = 0; i < aiQuestions.length; i++) {
      aiQuestions[i].id = maxId + i + 1;
    }
    questions = [...questions, ...aiQuestions];
  }

  // Shuffle questions slightly so same weak point questions aren't clustered
  questions.sort(() => Math.random() - 0.5);
  // Re-number after shuffle
  questions.forEach((q, i) => {
    q.id = i + 1;
  });

  const description =
    weakPoints.length > 0
      ? `根据你在「${topic}」学习中的表现，以下题目针对你的薄弱知识点：${weakPoints.join('、')}。`
      : `「${topic}」课后巩固练习。`;

  return {
    title: `${topic} — 个性化作业`,
    description,
    questions,
    weakKnowledgePoints: weakPoints,
    estimatedDuration: questions.length * 3,
  };
}
