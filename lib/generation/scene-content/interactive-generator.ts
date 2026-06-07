/**
 * Interactive widget content generation (Ultra Mode).
 *
 * Generates HTML widgets for simulation, diagram, code, game, and 3D visualization.
 * Also handles legacy interactiveConfig backward compatibility.
 */

import type {
  SceneOutline,
  GeneratedInteractiveContent,
  WidgetOutline,
} from '@/lib/types/generation';
import type { WidgetType, WidgetConfig, TeacherAction } from '@/lib/types/widgets';
import type { PromptId } from '@/lib/prompts/types';
import type { AICallFn } from '../pipeline-types';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseJsonResponse } from '../json-repair';
import { postProcessInteractiveHtml } from '../interactive-post-processor';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

export function convertInteractiveConfigToWidget(outline: SceneOutline): SceneOutline {
  const config = outline.interactiveConfig;
  if (!config) {
    log.warn(
      `Interactive outline missing both widget and interactiveConfig, falling back to simulation`,
    );
    return {
      ...outline,
      widgetType: 'simulation' as WidgetType,
      widgetOutline: { concept: outline.title },
    };
  }

  const widgetType = inferWidgetType(
    config.subject || '',
    config.conceptName,
    config.designIdea || '',
  );

  log.info(`Converting interactiveConfig to widget: ${widgetType} for "${outline.title}"`);

  return {
    ...outline,
    widgetType,
    widgetOutline: buildWidgetOutline(widgetType, config),
  };
}

// ── Widget type inference (weighted scoring) ──

interface KeywordPattern {
  regex: RegExp;
  weight: number;
}

const WIDGET_KEYWORD_MAP: Record<WidgetType, KeywordPattern[]> = {
  simulation: [
    {
      regex:
        /physics|chemistry|mechanics|electromagnetic|thermodynamic|quantum|relativity|astronomy/i,
      weight: 4,
    },
    { regex: /force|motion|equilibrium|wave|circuit|gravity|friction|momentum|energy/i, weight: 3 },
    { regex: /reaction|catalyst|molecule|atom|particle|oscillation|collision/i, weight: 3 },
    { regex: /simulate|simulation|experiment|phenomenon|lab(oratory)?|model/i, weight: 2 },
    { regex: /variable|parameter|slider|adjust|control|observe|measure/i, weight: 1 },
  ],
  diagram: [
    { regex: /flowchart|diagram|mind.?map|concept.?map|graph|visualize/i, weight: 4 },
    { regex: /process|workflow|pipeline|lifecycle|cycle|sequence|chain/i, weight: 3 },
    { regex: /step|stage|phase|hierarchy|relationship|structure|architecture/i, weight: 2 },
    { regex: /logic|system|component|module|organize|classify|taxonomy/i, weight: 1 },
  ],
  code: [
    { regex: /program(matic|ming)?|code|coding|script|debug/i, weight: 4 },
    { regex: /python|javascript|typescript|java|c\+\+|rust|golang?/i, weight: 4 },
    { regex: /algorithm|function|class|api|compiler|interpreter|runtime/i, weight: 3 },
    { regex: /variable|loop|recursion|data.?structure|complexity|optimization/i, weight: 2 },
    { regex: /syntax|compile|execute|implement|refactor|test.?case/i, weight: 1 },
  ],
  game: [
    { regex: /game|gamify|gamification|play|quiz|puzzle/i, weight: 4 },
    { regex: /match|challenge|score|leaderboard|achievement|badge/i, weight: 3 },
    { regex: /level|win|lose|reward|competition|race|quest|mission/i, weight: 2 },
    { regex: /practice|exercise|drill|repeat|memorize|flash.?card/i, weight: 1 },
  ],
  visualization3d: [
    { regex: /3[dD]|three.?d(imensional)?|model|render/i, weight: 4 },
    { regex: /anatomy|biology|cell|molecular|organism|skeleton|organ|tissue|dna/i, weight: 4 },
    { regex: /solar|planet|orbit|galaxy|universe|earth|moon|constellation/i, weight: 3 },
    { regex: /geometry|spatial|rotate|camera|viewpoint|mesh|texture/i, weight: 2 },
    { regex: /explore|inspect|navigate|zoom|pan|interact|manipulate/i, weight: 1 },
  ],
};

function inferWidgetType(subject: string, concept: string, designIdea: string): WidgetType {
  const text = (subject + ' ' + concept + ' ' + designIdea).toLowerCase();

  let bestType: WidgetType = 'simulation';
  let bestScore = 0;

  for (const [widgetType, patterns] of Object.entries(WIDGET_KEYWORD_MAP)) {
    let score = 0;
    for (const { regex, weight } of patterns) {
      if (regex.test(text)) {
        score += weight;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = widgetType as WidgetType;
    }
  }

  log.debug(`Widget inference: "${subject.substring(0, 50)}" → ${bestType} (score: ${bestScore})`);

  return bestType;
}

function buildWidgetOutline(
  widgetType: WidgetType,
  config: { conceptName: string; conceptOverview: string; designIdea: string },
): WidgetOutline {
  const base: WidgetOutline = { concept: config.conceptName };

  switch (widgetType) {
    case 'simulation':
      const varMatch = config.designIdea.match(/variables|parameter|adjust|slider/i);
      return { ...base, keyVariables: varMatch ? [] : undefined };
    case 'diagram':
      return { ...base, diagramType: 'flowchart' };
    case 'code':
      return { ...base, language: 'python' };
    case 'game':
      return { ...base, gameType: 'quiz' };
    case 'visualization3d':
      return { ...base, visualizationType: 'custom', objects: [] };
    default:
      return base;
  }
}

function extractHtml(response: string): string | null {
  const doctypeStart = response.indexOf('<!DOCTYPE html>');
  const htmlTagStart = response.indexOf('<html');
  const start = doctypeStart !== -1 ? doctypeStart : htmlTagStart;

  if (start !== -1) {
    const htmlEnd = response.lastIndexOf('</html>');
    if (htmlEnd !== -1) {
      return response.substring(start, htmlEnd + 7);
    }
  }

  const codeBlockMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.includes('<html') || content.includes('<!DOCTYPE')) {
      return content;
    }
  }

  const trimmed = response.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return trimmed;
  }

  log.error('Could not extract HTML from response');
  log.error('Response preview:', response.substring(0, 200));
  return null;
}

function extractWidgetConfig(html: string): WidgetConfig | undefined {
  const match = html.match(
    /<script type="application\/json" id="widget-config">([\s\S]*?)<\/script>/,
  );
  if (!match) return undefined;

  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

async function generateWidgetTeacherActions(
  widgetType: WidgetType,
  outline: SceneOutline,
  widgetConfig: WidgetConfig | undefined,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<TeacherAction[] | undefined> {
  const prompts = buildPrompt(PROMPT_IDS.WIDGET_TEACHER_ACTIONS_V2, {
    widgetType,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).join('\n'),
    widgetConfig: JSON.stringify(widgetConfig || {}),
    languageDirective: languageDirective || '',
  });

  if (!prompts) return undefined;

  try {
    const response = await aiCall(prompts.system, prompts.user);
    const parsed = parseJsonResponse<{ actions: TeacherAction[] }>(response);
    return parsed?.actions;
  } catch {
    return undefined;
  }
}

export async function generateWidgetContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<GeneratedInteractiveContent | null> {
  const widgetType = outline.widgetType;
  const widgetOutline = outline.widgetOutline;

  if (!widgetType || !widgetOutline) {
    log.warn(`Interactive outline missing widget config, falling back to standard interactive`);
    return null;
  }

  let promptId: PromptId;
  let variables: Record<string, unknown>;

  switch (widgetType) {
    case 'simulation':
      promptId = PROMPT_IDS.SIMULATION_CONTENT_V2;
      variables = {
        conceptName: widgetOutline.concept || outline.title,
        conceptOverview: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        variables: widgetOutline.keyVariables?.join(', ') || '',
        designIdea: '',
        languageDirective: languageDirective || '',
      };
      break;

    case 'diagram':
      promptId = PROMPT_IDS.DIAGRAM_CONTENT_V2;
      variables = {
        title: outline.title,
        diagramType: widgetOutline.diagramType || 'flowchart',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        languageDirective: languageDirective || '',
      };
      break;

    case 'code':
      promptId = PROMPT_IDS.CODE_CONTENT_V2;
      variables = {
        title: outline.title,
        programmingLanguage: widgetOutline.language || 'python',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        starterCode: '',
        testCases: '',
        hints: '',
        languageDirective: languageDirective || '',
      };
      break;

    case 'game':
      promptId = PROMPT_IDS.GAME_CONTENT_V2;
      variables = {
        title: outline.title,
        gameType: widgetOutline.gameType || 'quiz',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        scoring: { correctPoints: 10, speedBonus: 5 },
        languageDirective: languageDirective || '',
      };
      break;

    case 'visualization3d':
      promptId = PROMPT_IDS.VISUALIZATION3D_CONTENT_V2;
      variables = {
        title: outline.title,
        visualizationType: widgetOutline.visualizationType || 'custom',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        objects: widgetOutline.objects || [],
        interactions: widgetOutline.interactions || [],
        languageDirective: languageDirective || '',
      };
      break;

    default:
      log.warn(`Unknown widget type: ${widgetType}`);
      return null;
  }

  const prompts = buildPrompt(promptId, variables);
  if (!prompts) {
    log.error(`Failed to build ${widgetType} prompt for: ${outline.title}`);
    return null;
  }

  log.info(`Generating ${widgetType} widget for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user);
  const html = extractHtml(response);

  if (!html) {
    log.error(`Failed to extract HTML from ${widgetType} response for: ${outline.title}`);
    return null;
  }

  const widgetConfig = extractWidgetConfig(html);

  const teacherActions = await generateWidgetTeacherActions(
    widgetType,
    outline,
    widgetConfig,
    aiCall,
    languageDirective,
  );
  log.info(
    `[Ultra Mode] Generated ${teacherActions?.length || 0} teacher actions for "${outline.title}" (${widgetType})`,
  );
  if (teacherActions && teacherActions.length > 0) {
    log.info(
      `[Ultra Mode] Teacher actions for "${outline.title}": ${JSON.stringify(teacherActions, null, 2)}`,
    );
  }

  return {
    html: postProcessInteractiveHtml(html),
    widgetType,
    widgetConfig,
    teacherActions,
  };
}
