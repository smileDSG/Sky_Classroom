import { z } from 'zod';

import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import type { LessonPlan, LessonSection } from './lesson-types';

export const teachingGenerationPolicySchema = z
  .object({
    difficulty: z.enum(['easy', 'medium', 'hard']),
    explanationStyle: z.enum(['step_first', 'principle_first', 'example_first', 'practice_first']),
    resourceFormats: z.array(
      z.enum(['worked_example', 'code_case', 'diagram', 'practice', 'video', 'summary']),
    ),
    pacing: z.enum(['remedial', 'steady', 'sprint']),
    reasonCodes: z.array(z.string().min(1)).max(10).default([]),
    profileVersion: z.number().int().min(0).default(0),
  })
  .strict();

export type TeachingGenerationPolicy = z.infer<typeof teachingGenerationPolicySchema>;

/** Convert adaptive learner decision into knobs consumed by lesson planning. */
export function teachingPolicyFromLearnerDecision(
  decision: LearnerDecision,
): TeachingGenerationPolicy {
  const resourceFormats: TeachingGenerationPolicy['resourceFormats'] =
    decision.format === 'diagram'
      ? ['diagram', 'worked_example']
      : decision.format === 'interactive'
        ? ['practice']
        : ['worked_example'];

  return {
    difficulty: decision.difficulty,
    explanationStyle:
      decision.format === 'interactive'
        ? 'practice_first'
        : decision.format === 'diagram'
          ? 'example_first'
          : 'step_first',
    resourceFormats,
    pacing: decision.action === 'teach' || decision.action === 'diagnostic' ? 'remedial' : 'steady',
    reasonCodes: decision.reasonCodes,
    profileVersion: decision.profileVersion,
  };
}

function preferredContentType(policy: TeachingGenerationPolicy): LessonSection['contentType'] {
  if (policy.explanationStyle === 'practice_first') return 'quiz';
  if (policy.explanationStyle === 'example_first') return 'example';
  if (policy.resourceFormats.includes('diagram')) return 'diagram';
  return 'explanation';
}

function applyDepth(
  depth: LessonSection['depth'],
  difficulty: TeachingGenerationPolicy['difficulty'],
): LessonSection['depth'] {
  if (difficulty === 'easy') return 'basic';
  if (difficulty === 'hard') return 'advanced';
  return depth;
}

export function applyTeachingGenerationPolicy(
  plan: LessonPlan,
  policy?: TeachingGenerationPolicy | null,
): LessonPlan {
  if (!policy || plan.sections.length === 0) return plan;

  const durationMultiplier =
    policy.pacing === 'remedial' ? 1.25 : policy.pacing === 'sprint' ? 0.75 : 1;
  const preferredType = preferredContentType(policy);
  let sections = plan.sections.map((section, index) => ({
    ...section,
    contentType: index === 0 ? preferredType : section.contentType,
    depth: applyDepth(section.depth, policy.difficulty),
    estimatedDuration: Math.max(3, Math.round(section.estimatedDuration * durationMultiplier)),
    hasQuiz: index === 0 && preferredType === 'quiz' ? true : section.hasQuiz,
  }));

  if (
    policy.resourceFormats.includes('diagram') &&
    !sections.some((s) => s.contentType === 'diagram')
  ) {
    const index = Math.min(1, sections.length - 1);
    sections = sections.map((section, sectionIndex) =>
      sectionIndex === index ? { ...section, contentType: 'diagram' } : section,
    );
  }

  if (
    policy.resourceFormats.includes('practice') &&
    !sections.some((s) => s.contentType === 'quiz')
  ) {
    const lastIndex = sections.length - 1;
    sections = sections.map((section, sectionIndex) =>
      sectionIndex === lastIndex ? { ...section, contentType: 'quiz', hasQuiz: true } : section,
    );
  }

  return {
    ...plan,
    sections,
    estimatedDuration: sections.reduce((sum, section) => sum + section.estimatedDuration, 0),
  };
}
