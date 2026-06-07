/**
 * Slide action generation.
 *
 * Generates teacher/agent actions for slide scenes.
 */

import { nanoid } from 'nanoid';
import type { SceneOutline, GeneratedSlideContent } from '@/lib/types/generation';
import type { PPTElement } from '@/lib/types/slides';
import type { Action } from '@/lib/types/action';
import type { AgentInfo, SceneGenerationContext, AICallFn } from '../pipeline-types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseActionsFromStructuredOutput } from '../action-parser';
import { buildCourseContext, formatAgentsForPrompt } from '../prompt-formatters';
import { processActions } from './_shared';

function formatElementsForPrompt(elements: PPTElement[]): string {
  return elements
    .map((el) => {
      let summary = '';
      if (el.type === 'text' && 'content' in el) {
        const textContent = ((el.content as string) || '').replace(/<[^>]*>/g, '').substring(0, 50);
        summary = `Content summary: "${textContent}${textContent.length >= 50 ? '...' : ''}"`;
      } else if (el.type === 'chart' && 'chartType' in el) {
        summary = `Chart type: ${el.chartType}`;
      } else if (el.type === 'image') {
        summary = 'Image element';
      } else if (el.type === 'shape' && 'shapeName' in el) {
        summary = `Shape: ${el.shapeName || 'unknown'}`;
      } else if (el.type === 'latex' && 'latex' in el) {
        summary = `Formula: ${((el.latex as string) || '').substring(0, 30)}`;
      } else {
        summary = `${el.type} element`;
      }
      return `- id: "${el.id}", type: "${el.type}", ${summary}`;
    })
    .join('\n');
}

export function generateDefaultSlideActions(
  outline: SceneOutline,
  elements: PPTElement[],
): Action[] {
  const actions: Action[] = [];

  const textElements = elements.filter((el) => el.type === 'text');
  if (textElements.length > 0) {
    actions.push({
      id: `action_${nanoid(8)}`,
      type: 'spotlight',
      title: 'Spotlight',
      elementId: textElements[0].id,
    });
  }

  const speechText = outline.keyPoints?.length
    ? outline.keyPoints.join('。') + '。'
    : outline.description || outline.title;
  actions.push({
    id: `action_${nanoid(8)}`,
    type: 'speech',
    title: 'Scene Introduction',
    text: speechText,
  });

  return actions;
}

export async function generateSlideActions(
  outline: SceneOutline,
  content: GeneratedSlideContent,
  aiCall: AICallFn,
  options: {
    ctx?: SceneGenerationContext;
    agents?: AgentInfo[];
    userProfile?: string;
    languageDirective?: string;
  } = {},
): Promise<Action[]> {
  const { ctx, agents, userProfile, languageDirective } = options;
  const agentsText = formatAgentsForPrompt(agents);

  const elementsText = formatElementsForPrompt(content.elements);

  const prompts = buildPrompt(PROMPT_IDS.SLIDE_ACTIONS_V2, {
    title: outline.title,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    description: outline.description,
    elements: elementsText,
    courseContext: buildCourseContext(ctx),
    agents: agentsText,
    userProfile: userProfile || '',
    languageDirective: languageDirective || '',
  });

  if (!prompts) {
    return generateDefaultSlideActions(outline, content.elements);
  }

  const response = await aiCall(prompts.system, prompts.user);
  const actions = parseActionsFromStructuredOutput(response, outline.type);

  if (actions.length > 0) {
    return processActions(actions, content.elements, agents);
  }

  return generateDefaultSlideActions(outline, content.elements);
}
