/**
 * D-002 Lesson Planner Agent
 *
 * Generates a personalized lesson plan based on student profile and teaching topic.
 * Uses LLM to structure sections with appropriate depth based on mastery levels.
 */

import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '@/lib/solve/solver-constants';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { LessonPlan, LessonSection } from './lesson-types';
import { LESSON_SYSTEM_PROMPT, buildLessonPlannerPrompt } from './lesson-prompts';
import { createLogger } from '@/lib/logger';

const log = createLogger('LessonPlanner');

/** Fallback plan generated without LLM */
function fallbackPlan(topic: string, profile: StudentProfile): LessonPlan {
  const weakKps = profile.weakPoints.slice(0, 3);
  const sections: LessonSection[] = [
    {
      id: 'section-1',
      title: `${topic} 基础讲解`,
      contentType: 'explanation',
      depth: weakKps.length > 0 ? 'basic' : 'intermediate',
      knowledgePoints: weakKps.length > 0 ? weakKps : [topic],
      estimatedDuration: 10,
      hasQuiz: true,
    },
    {
      id: 'section-2',
      title: `${topic} 例题讲解`,
      contentType: 'example',
      depth: 'intermediate',
      knowledgePoints: [topic],
      estimatedDuration: 10,
      hasQuiz: false,
    },
    {
      id: 'section-3',
      title: `${topic} 随堂检测`,
      contentType: 'quiz',
      depth: 'intermediate',
      knowledgePoints: [topic],
      estimatedDuration: 5,
      hasQuiz: true,
    },
  ];

  return {
    title: `${topic} 授课计划`,
    sections,
    estimatedDuration: sections.reduce((s, sec) => s + sec.estimatedDuration, 0),
    focusPoints: weakKps,
  };
}

export async function planLesson(profile: StudentProfile, topic: string): Promise<LessonPlan> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const prompt = buildLessonPlannerPrompt(profile, topic);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      'lesson-planner',
      { retries: 1 },
      undefined,
      LESSON_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed) {
      log.warn('planLesson: LLM returned invalid JSON, using fallback');
      return fallbackPlan(topic, profile);
    }

    // Validate and build LessonPlan
    const title = typeof parsed.title === 'string' ? parsed.title : `${topic} 授课计划`;
    const rawSections = Array.isArray(parsed.sections)
      ? (parsed.sections as Record<string, unknown>[])
      : [];
    if (rawSections.length === 0) {
      log.warn('planLesson: LLM returned empty sections, using fallback');
      return fallbackPlan(topic, profile);
    }

    const sections: LessonSection[] = rawSections.map((s, i) => ({
      id: s.id && typeof s.id === 'string' ? (s.id as string) : `section-${i + 1}`,
      title: typeof s.title === 'string' ? s.title : `${topic} 第${i + 1}节`,
      contentType: ['explanation', 'example', 'diagram', 'quiz'].includes(s.contentType as string)
        ? (s.contentType as LessonSection['contentType'])
        : 'explanation',
      depth: ['basic', 'intermediate', 'advanced'].includes(s.depth as string)
        ? (s.depth as LessonSection['depth'])
        : 'intermediate',
      knowledgePoints: Array.isArray(s.knowledgePoints)
        ? (s.knowledgePoints as string[]).filter((x) => typeof x === 'string')
        : [topic],
      estimatedDuration:
        typeof s.estimatedDuration === 'number' && s.estimatedDuration > 0
          ? (s.estimatedDuration as number)
          : 10,
      hasQuiz: s.hasQuiz === true,
    }));

    const focusPoints = Array.isArray(parsed.focusPoints)
      ? (parsed.focusPoints as string[]).filter((x) => typeof x === 'string')
      : profile.weakPoints.slice(0, 3);

    const plan: LessonPlan = {
      title,
      sections,
      estimatedDuration: sections.reduce((s, sec) => s + sec.estimatedDuration, 0),
      focusPoints,
    };

    log.info(
      `planLesson: "${plan.title}" with ${sections.length} sections, ${plan.estimatedDuration}min`,
    );
    return plan;
  } catch (err) {
    log.warn('planLesson failed, using fallback:', err);
    return fallbackPlan(topic, profile);
  }
}
