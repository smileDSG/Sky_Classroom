/**
 * Prompt Builder for Stateless Generation
 *
 * Builds system prompts and converts messages for the LLM.
 * Uses file-based role and persona templates from lib/prompts/roles/ and lib/prompts/student-personas/.
 */

import fs from 'fs';
import path from 'path';
import type { StatelessChatRequest } from '@/lib/types/chat';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { WhiteboardActionRecord, AgentTurnSummary } from './types';
import { getActionDescriptions, getEffectiveActions } from './tool-schemas';
import { buildStateContext } from './summarizers/state-context';
import { buildVirtualWhiteboardContext } from './summarizers/whiteboard-ledger';
import { buildPeerContextSection } from './summarizers/peer-context';
import { formatAgentMemory } from './agent-memory';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { createLogger } from '@/lib/logger';

const log = createLogger('PromptBuilder');

// ==================== Role & Persona Loader ====================

const promptsDir = path.join(process.cwd(), 'lib', 'prompts');

/**
 * Load role content from the new modular templates (lib/prompts/roles/).
 * Falls back to the legacy TS constants if the file doesn't exist yet.
 */
function loadRoleContent(role: string): string {
  const rolePath = path.join(promptsDir, 'roles', `${role}.md`);
  try {
    return fs.readFileSync(rolePath, 'utf-8').trim();
  } catch {
    // Fall back to legacy constants during transition
    log.warn(`Role template not found: ${rolePath}, using legacy fallback`);
    return LEGACY_ROLE_GUIDELINES[role] || LEGACY_ROLE_GUIDELINES.student;
  }
}

/**
 * Load student persona content from the new modular templates (lib/prompts/student-personas/).
 * Returns empty string if no specific persona is configured.
 */
function loadPersonaContent(personaType?: string): string {
  if (!personaType) return '';
  const personaPath = path.join(promptsDir, 'student-personas', `${personaType}.md`);
  try {
    return fs.readFileSync(personaPath, 'utf-8').trim();
  } catch {
    log.warn(`Persona template not found: ${personaPath}`);
    return '';
  }
}

// ==================== Legacy Fallback (to be removed after migration) ====================

const LEGACY_ROLE_GUIDELINES: Record<string, string> = {
  teacher: `Your role in this classroom: LEAD TEACHER.
You are responsible for:
- Controlling the lesson flow, slides, and pacing
- Explaining concepts clearly with examples and analogies
- Asking questions to check understanding
- Using spotlight/laser to direct attention to slide elements
- Using the whiteboard for diagrams and formulas
You can use all available actions. Never announce your actions — just teach naturally.`,

  assistant: `Your role in this classroom: TEACHING ASSISTANT.
You are responsible for:
- Supporting the lead teacher by filling gaps and answering side questions
- Rephrasing explanations in simpler terms when students are confused
- Providing concrete examples and background context
- Using the whiteboard sparingly to supplement (not duplicate) the teacher's content
Keep your responses SHORT — 1-2 sentences max, around 50 characters. One key point per response.
You play a supporting role — don't take over the lesson.`,

  student: `Your role in this classroom: STUDENT.
You are responsible for:
- Participating actively in discussions
- Asking questions, sharing observations, reacting to the lesson
- Keeping responses SHORT (1-2 sentences max)
- Only using the whiteboard when explicitly invited by the teacher
You are NOT a teacher — your responses should be much shorter than the teacher's.`,
};

// ==================== Types ====================

/**
 * Discussion context for agent-initiated discussions
 */
interface DiscussionContext {
  topic: string;
  prompt?: string;
}

// ==================== Per-variant string constants ====================

const FORMAT_EXAMPLE_SLIDE = `[{"type":"action","name":"spotlight","params":{"elementId":"img_1"}},{"type":"text","content":"Your natural speech to students"}]`;
const FORMAT_EXAMPLE_WB = `[{"type":"action","name":"wb_open","params":{}},{"type":"text","content":"Your natural speech to students"}]`;

const ORDERING_SLIDE = `- spotlight/laser actions should appear BEFORE the corresponding text object (point first, then speak)
- whiteboard actions can interleave WITH text objects (draw while speaking)`;
const ORDERING_WB = `- whiteboard actions can interleave WITH text objects (draw while speaking)`;

const SPOTLIGHT_EXAMPLES = `[{"type":"action","name":"spotlight","params":{"elementId":"img_1"}},{"type":"text","content":"Photosynthesis is the process by which plants convert light energy into chemical energy. Take a look at this diagram."},{"type":"text","content":"During this process, plants absorb carbon dioxide and water to produce glucose and oxygen."}]

[{"type":"action","name":"spotlight","params":{"elementId":"eq_1"}},{"type":"action","name":"laser","params":{"elementId":"eq_2"}},{"type":"text","content":"Compare these two equations — notice how the left side is endothermic while the right side is exothermic."}]

`;

const SLIDE_ACTION_GUIDELINES = `- spotlight: Use to focus attention on ONE key element. Don't overuse — max 1-2 per response.
- laser: Use to point at elements. Good for directing attention during explanations.
`;

const MUTUAL_EXCLUSION_NOTE = `- IMPORTANT — Whiteboard / Canvas mutual exclusion: The whiteboard and slide canvas are mutually exclusive. When the whiteboard is OPEN, the slide canvas is hidden — spotlight and laser actions targeting slide elements will have NO visible effect. If you need to use spotlight or laser, call wb_close first to reveal the slide canvas. Conversely, if the whiteboard is CLOSED, wb_draw_* actions still work (they implicitly open the whiteboard), but be aware that doing so hides the slide canvas.
- Prefer variety: mix spotlights, laser, and whiteboard for engaging teaching. Don't use the same action type repeatedly.`;

// ==================== Private helpers ====================

function buildStudentProfileSection(userProfile?: { nickname?: string; bio?: string }): string {
  if (!userProfile?.nickname && !userProfile?.bio) return '';
  return `\n# Student Profile
You are teaching ${userProfile.nickname || 'a student'}.${userProfile.bio ? `\nTheir background: ${userProfile.bio}` : ''}
Personalize your teaching based on their background only when relevant. The name is optional for address only; do not turn the response into a greeting. Always answer the latest student message first.\n`;
}

function buildLanguageConstraint(langDirective?: string): string {
  return langDirective ? `\n# Language (CRITICAL)\n${langDirective}\n` : '';
}

function buildTeachingProjectionSection(teachingProjection?: string): string {
  if (!teachingProjection) return '';
  return `\n# Learner Profile (authoritative)\n${teachingProjection}\n`;
}

function buildDiscussionContextSection(
  discussionContext: DiscussionContext | undefined,
  agentResponses: AgentTurnSummary[] | undefined,
): string {
  if (!discussionContext) return '';
  if (agentResponses && agentResponses.length > 0) {
    return `

# Discussion Context
Topic: "${discussionContext.topic}"
${discussionContext.prompt ? `Guiding prompt: ${discussionContext.prompt}` : ''}

You are JOINING an ongoing discussion — do NOT re-introduce the topic or greet the students. The discussion has already started. Contribute your unique perspective: ask a follow-up question, challenge an assumption, or connect to something a peer just said.`;
  }
  return `

# Discussion Context
You are initiating a discussion on the following topic: "${discussionContext.topic}"
${discussionContext.prompt ? `Guiding prompt: ${discussionContext.prompt}` : ''}

IMPORTANT: As you are starting this discussion, introduce the topic naturally and invite students to share their thoughts. Be engaging and encourage active participation. Do not wait for user input - you speak first.`;
}

// ==================== System Prompt ====================

/**
 * Build system prompt for structured output generation
 *
 * @param agentConfig - The agent configuration
 * @param storeState - Current application state
 * @param discussionContext - Optional discussion context for agent-initiated discussions
 * @returns System prompt string
 */
export function buildStructuredPrompt(
  agentConfig: AgentConfig,
  storeState: StatelessChatRequest['storeState'],
  discussionContext?: DiscussionContext,
  whiteboardLedger?: WhiteboardActionRecord[],
  userProfile?: { nickname?: string; bio?: string },
  agentResponses?: AgentTurnSummary[],
  memory?: {
    recentTurns: Array<{ contentPreview: string; actionNames: string[] }>;
    keyFacts: string[];
  },
  teachingProjection?: string,
): string {
  // Determine current scene type for action filtering
  const currentScene = storeState.currentSceneId
    ? storeState.scenes.find((s) => s.id === storeState.currentSceneId)
    : undefined;
  const sceneType = currentScene?.type;
  const effectiveActions = getEffectiveActions(agentConfig.allowedActions, sceneType);
  const hasSlideActions =
    effectiveActions.includes('spotlight') || effectiveActions.includes('laser');

  // Load role content from new modular templates (with legacy fallback)
  const roleContent = loadRoleContent(agentConfig.role);
  const personaContent = agentConfig.role === 'student' ? loadPersonaContent(agentConfig.personaType) : '';
  const combinedRoleGuideline = [roleContent, personaContent].filter(Boolean).join('\n\n');

  const vars = {
    agentName: agentConfig.name,
    persona: agentConfig.persona,
    roleGuideline: combinedRoleGuideline,
    studentProfileSection: buildStudentProfileSection(userProfile),
    peerContext: buildPeerContextSection(agentResponses, agentConfig.name),
    hasStudentProfile: !!(userProfile?.nickname || userProfile?.bio),
    languageConstraint: buildLanguageConstraint(storeState.stage?.languageDirective),
    formatExample: hasSlideActions ? FORMAT_EXAMPLE_SLIDE : FORMAT_EXAMPLE_WB,
    orderingPrinciples: hasSlideActions ? ORDERING_SLIDE : ORDERING_WB,
    spotlightExamples: hasSlideActions ? SPOTLIGHT_EXAMPLES : '',
    actionDescriptions: getActionDescriptions(effectiveActions),
    slideActionGuidelines: hasSlideActions ? SLIDE_ACTION_GUIDELINES : '',
    mutualExclusionNote: hasSlideActions ? MUTUAL_EXCLUSION_NOTE : '',
    stateContext: buildStateContext(storeState),
    virtualWhiteboardContext: buildVirtualWhiteboardContext(storeState, whiteboardLedger),
    lengthGuidelines: extractSection(roleContent, 'Length Constraint', 'Whiteboard Permissions')
      || extractSection(roleContent, 'Length Constraint', '## Examples')
      || '',
    whiteboardGuidelines: extractSection(roleContent, 'Whiteboard Permissions', null)
      || extractSection(roleContent, '## Whiteboard Permissions', null)
      || '',
    discussionContextSection: buildDiscussionContextSection(discussionContext, agentResponses),
    memorySection: memory ? formatAgentMemory(memory) : '',
    teachingProjectionSection: buildTeachingProjectionSection(teachingProjection),
  };

  const prompt = buildPrompt(PROMPT_IDS.AGENT_SYSTEM, vars);
  if (!prompt) {
    throw new Error('agent-system template not found');
  }
  return prompt.system;
}

// ==================== Markdown Section Extractor ====================

/**
 * Extract a named section from Markdown role content.
 * Looks for a heading (## Section Name) and returns everything until the next heading or end.
 */
function extractSection(markdown: string, sectionName: string, stopAt: string | null): string {
  const heading = `## ${sectionName}`;
  const start = markdown.indexOf(heading);
  if (start === -1) {
    // Try alternative heading level
    const altStart = markdown.indexOf(`# ${sectionName}`);
    if (altStart === -1) return '';
    return extractSectionAt(markdown, altStart, stopAt);
  }
  return extractSectionAt(markdown, start, stopAt);
}

function extractSectionAt(markdown: string, startIdx: number, stopAt: string | null): string {
  let endIdx = markdown.length;
  if (stopAt) {
    const stopIdx = markdown.indexOf(`## ${stopAt}`, startIdx + 1);
    if (stopIdx !== -1 && stopIdx < endIdx) endIdx = stopIdx;
  }
  // Find next ## heading after the section
  const nextHeading = markdown.indexOf('\n## ', startIdx + 1);
  if (nextHeading !== -1 && nextHeading < endIdx) {
    endIdx = nextHeading;
  }
  return markdown.slice(startIdx, endIdx).trim();
}
