/**
 * Cloud Mind Quiz — Zod schemas for validating raw LLM output.
 *
 * The LLM is instructed to emit a `type` per question. These schemas reject
 * truncated/mis-typed JSON so the agent can retry instead of producing
 * structurally broken questions.
 */

import { z } from 'zod';

export const QUIZ_QUESTION_TYPES = ['choice', 'fill', 'judge'] as const;
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export const quizQuestionSchema = z.object({
  id: z.number().int().positive().optional(),
  type: z.enum(QUIZ_QUESTION_TYPES),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  answer: z.union([z.number(), z.string()]),
  explanation: z.string().optional().default('暂无解析'),
});

export const quizOutputSchema = z.object({
  subject: z.string(),
  topic: z.string(),
  difficulty: z.string(),
  questions: z.array(quizQuestionSchema).min(1),
});

export type RawQuizQuestion = z.infer<typeof quizQuestionSchema>;
export type RawQuizOutput = z.infer<typeof quizOutputSchema>;
