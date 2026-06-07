/**
 * Quiz action generation.
 *
 * Generates teacher/agent actions for quiz scenes.
 */

import { nanoid } from 'nanoid';
import type { SceneOutline, GeneratedQuizContent } from '@/lib/types/generation';
import type { QuizQuestion } from '@/lib/types/stage';
import type { Action } from '@/lib/types/action';
import type { AgentInfo, SceneGenerationContext, AICallFn } from '../pipeline-types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseActionsFromStructuredOutput } from '../action-parser';
import { buildCourseContext, formatAgentsForPrompt } from '../prompt-formatters';
import { processActions } from './_shared';

function formatQuestionsForPrompt(questions: QuizQuestion[]): string {
  return questions
    .map((q, i) => {
      const optionsText = q.options
        ? `Options: ${q.options.map((o) => `${o.value}. ${o.label}`).join(', ')}`
        : '';
      return `Q${i + 1} (${q.type}): ${q.question}\n${optionsText}`;
    })
    .join('\n\n');
}

export function generateDefaultQuizActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      title: 'Quiz Introduction',
      text: "Now let's take a quiz to test what you've learned.",
    },
  ];
}

export async function generateQuizActions(
  outline: SceneOutline,
  content: GeneratedQuizContent,
  aiCall: AICallFn,
  options: {
    ctx?: SceneGenerationContext;
    agents?: AgentInfo[];
    languageDirective?: string;
  } = {},
): Promise<Action[]> {
  const { ctx, agents, languageDirective } = options;
  const agentsText = formatAgentsForPrompt(agents);

  const questionsText = formatQuestionsForPrompt(content.questions);

  const prompts = buildPrompt(PROMPT_IDS.QUIZ_ACTIONS_V2, {
    title: outline.title,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    description: outline.description,
    questions: questionsText,
    courseContext: buildCourseContext(ctx),
    agents: agentsText,
    languageDirective: languageDirective || '',
  });

  if (!prompts) {
    return generateDefaultQuizActions(outline);
  }

  const response = await aiCall(prompts.system, prompts.user);
  const actions = parseActionsFromStructuredOutput(response, outline.type);

  if (actions.length > 0) {
    return processActions(actions, [], agents);
  }

  return generateDefaultQuizActions(outline);
}
