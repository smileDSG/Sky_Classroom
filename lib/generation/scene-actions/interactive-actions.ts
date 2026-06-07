/**
 * Interactive and PBL action generation.
 *
 * Handles both Ultra Mode teacherActions conversion and normal AI-generated actions.
 */

import { nanoid } from 'nanoid';
import type {
  SceneOutline,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
} from '@/lib/types/generation';
import type {
  Action,
  SpeechAction,
  WidgetHighlightAction,
  WidgetSetStateAction,
  WidgetAnnotationAction,
  WidgetRevealAction,
} from '@/lib/types/action';
import type { TeacherAction } from '@/lib/types/widgets';
import type { AgentInfo, SceneGenerationContext, AICallFn } from '../pipeline-types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseActionsFromStructuredOutput } from '../action-parser';
import { buildCourseContext, formatAgentsForPrompt } from '../prompt-formatters';
import { processActions } from './_shared';

function convertTeacherActionsToActions(teacherActions: TeacherAction[]): Action[] {
  const actions: Action[] = [];

  for (const ta of teacherActions) {
    const actionId = `action_${nanoid(8)}`;
    const base = {
      id: actionId,
      title: ta.label || '',
    };

    switch (ta.type) {
      case 'speech':
        actions.push({
          ...base,
          type: 'speech',
          text: ta.content || '',
        } as SpeechAction);
        break;

      case 'highlight':
        actions.push({
          ...base,
          type: 'widget_highlight',
          target: ta.target || '',
          content: undefined,
        } as WidgetHighlightAction);
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      case 'setState':
        actions.push({
          ...base,
          type: 'widget_setState',
          state: ta.state || {},
          content: undefined,
        } as WidgetSetStateAction);
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      case 'annotation':
        actions.push({
          ...base,
          type: 'widget_annotation',
          target: ta.target || '',
          content: undefined,
        } as WidgetAnnotationAction);
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      case 'reveal':
        actions.push({
          ...base,
          type: 'widget_reveal',
          target: ta.target || '',
          content: undefined,
        } as WidgetRevealAction);
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      default:
        actions.push({
          ...base,
          type: 'speech',
          text: ta.content || '',
        } as SpeechAction);
    }
  }

  return actions;
}

export function generateDefaultInteractiveActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      title: 'Interactive Introduction',
      text: "Now let's explore this concept through an interactive visualization. Try interacting with the elements and observe the changes.",
    },
  ];
}

export function generateDefaultPBLActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      title: 'PBL Project Introduction',
      text: "Now let's start a project-based learning activity. Choose your role, check the task board, and start collaborating on the project.",
    },
  ];
}

export async function generateInteractiveActions(
  outline: SceneOutline,
  content: GeneratedInteractiveContent,
  aiCall: AICallFn,
  options: {
    ctx?: SceneGenerationContext;
    agents?: AgentInfo[];
    languageDirective?: string;
  } = {},
): Promise<Action[]> {
  const { ctx, agents, languageDirective } = options;

  // Ultra Mode: content already has teacherActions
  if (content.teacherActions?.length) {
    return convertTeacherActionsToActions(content.teacherActions);
  }

  // Normal interactive mode
  const config = outline.interactiveConfig;
  const agentsText = formatAgentsForPrompt(agents);
  const prompts = buildPrompt(PROMPT_IDS.INTERACTIVE_ACTIONS_V2, {
    title: outline.title,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    description: outline.description,
    conceptName: config?.conceptName || outline.title,
    designIdea: config?.designIdea || '',
    courseContext: buildCourseContext(ctx),
    agents: agentsText,
    languageDirective: languageDirective || '',
  });

  if (!prompts) {
    return generateDefaultInteractiveActions(outline);
  }

  const response = await aiCall(prompts.system, prompts.user);
  const actions = parseActionsFromStructuredOutput(response, outline.type);

  if (actions.length > 0) {
    return processActions(actions, [], agents);
  }

  return generateDefaultInteractiveActions(outline);
}

export async function generatePBLActions(
  outline: SceneOutline,
  content: GeneratedPBLContent,
  aiCall: AICallFn,
  options: {
    ctx?: SceneGenerationContext;
    agents?: AgentInfo[];
    languageDirective?: string;
  } = {},
): Promise<Action[]> {
  const { ctx, agents, languageDirective } = options;
  const pblConfig = outline.pblConfig;
  const agentsText = formatAgentsForPrompt(agents);
  const prompts = buildPrompt(PROMPT_IDS.PBL_ACTIONS_V2, {
    title: outline.title,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    description: outline.description,
    projectTopic: pblConfig?.projectTopic || outline.title,
    projectDescription: pblConfig?.projectDescription || outline.description,
    courseContext: buildCourseContext(ctx),
    agents: agentsText,
    languageDirective: languageDirective || '',
  });

  if (!prompts) {
    return generateDefaultPBLActions(outline);
  }

  const response = await aiCall(prompts.system, prompts.user);
  const actions = parseActionsFromStructuredOutput(response, outline.type);

  if (actions.length > 0) {
    return processActions(actions, [], agents);
  }

  return generateDefaultPBLActions(outline);
}
