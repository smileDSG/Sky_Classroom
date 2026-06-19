/**
 * Quiz Section Fallback Generator
 *
 * When the primary chunk-based generator fails for a quiz section, this module
 * provides a robust fallback using the dedicated quiz agent, plus a deterministic
 * last-resort fallback so the UI never degrades to a plain "generation failed" text.
 */

import { generateQuiz } from '@/lib/agents/cloud-mind/quiz-agent';
import { inferSubject } from '@/lib/mistakes/subject-inference';
import { createLogger } from '@/lib/logger';
import type { LessonSection } from './lesson-types';
import type { ContentChunk } from './content-types';
import type { StudentProfile } from '@/lib/student/profile-types';

const log = createLogger('QuizSectionGenerator');

const DEPTH_TO_DIFFICULTY: Record<string, 'easy' | 'medium' | 'hard'> = {
  basic: 'easy',
  intermediate: 'medium',
  advanced: 'hard',
};

function resolveDifficulty(depth: string): 'easy' | 'medium' | 'hard' {
  return DEPTH_TO_DIFFICULTY[depth] ?? 'medium';
}

function resolveSubject(section: LessonSection, profile?: StudentProfile): string {
  // Prefer the first knowledge point for subject inference
  const firstKp = section.knowledgePoints[0];
  if (firstKp) {
    const fromKp = inferSubject(firstKp);
    if (fromKp !== 'unknown') return fromKp;
  }

  // Fall back to inferring from the section title
  const fromTitle = inferSubject(section.title);
  if (fromTitle !== 'unknown') return fromTitle;

  // If profile has a dominant subject, use it
  if (profile?.masteryByKnowledge && Object.keys(profile.masteryByKnowledge).length > 0) {
    const subjects = Object.entries(profile.masteryByKnowledge)
      .map(([kp]) => inferSubject(kp))
      .filter((s) => s !== 'unknown');
    if (subjects.length > 0) {
      const counts = new Map<string, number>();
      for (const s of subjects) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'math';
    }
  }

  return 'math';
}

function resolveQuestionCount(section: LessonSection): number {
  const base = Math.max(2, Math.min(5, Math.round((section.estimatedDuration || 5) / 3)));
  return base;
}

/**
 * Generate fallback quiz content for a quiz-type section using the dedicated quiz agent.
 */
export async function generateQuizSectionContent(
  section: LessonSection,
  profile?: StudentProfile,
): Promise<ContentChunk[]> {
  const subject = resolveSubject(section, profile);
  const difficulty = resolveDifficulty(section.depth);
  const topic = section.knowledgePoints.join('、') || section.title;
  const count = resolveQuestionCount(section);

  log.info(
    `[QuizFallback] section=${section.id}, subject=${subject}, difficulty=${difficulty}, count=${count}, topic=${topic}`,
  );

  const quiz = await generateQuiz(subject, difficulty, topic, count, profile);

  if (!quiz.questions || quiz.questions.length === 0) {
    throw new Error('Quiz agent returned empty questions');
  }

  return quiz.questions.map((q, i) => ({
    sectionId: section.id,
    type: 'quiz',
    question: q.question,
    options: q.options,
    correctAnswer: q.answer,
    content: q.explanation || '暂无解析',
    order: i + 1,
  }));
}

/**
 * Deterministic last-resort fallback: returns valid quiz chunks based on the
 * section's knowledge points. This guarantees the UI can render an interactive
 * quiz even if the quiz agent fails.
 */
export function deterministicQuizChunks(section: LessonSection): ContentChunk[] {
  const kps = section.knowledgePoints.length > 0 ? section.knowledgePoints : [section.title];
  const chunks: ContentChunk[] = [];

  for (let i = 0; i < kps.length; i++) {
    const kp = kps[i];
    chunks.push({
      sectionId: section.id,
      type: 'quiz',
      question: `关于“${kp}”，下列说法正确的是？`,
      options: [
        `${kp} 是本节需要掌握的重点内容`,
        `${kp} 与本节学习目标无关`,
        `${kp} 可以暂时跳过`,
        `${kp} 不属于本课程范围`,
      ],
      correctAnswer: 0,
      content: `正确答案是 A。${kp} 是本节重点知识点，建议结合前面的讲解进行复习巩固。`,
      order: i + 1,
    });
  }

  // Always produce at least one question
  if (chunks.length === 0) {
    chunks.push({
      sectionId: section.id,
      type: 'quiz',
      question: '本节内容的重点是什么？',
      options: [
        '掌握本节介绍的核心知识点',
        '不需要关注本节内容',
        '本节没有学习目标',
        '本节内容与课程无关',
      ],
      correctAnswer: 0,
      content: '正确答案是 A。请复习本节讲解的重点内容。',
      order: 1,
    });
  }

  return chunks;
}
