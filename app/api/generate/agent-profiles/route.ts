/**
 * Agent Profiles Generation API
 *
 * Generates agent profiles (teacher, assistant, student) for a course stage
 * based on stage info and scene outlines. Uses the B-001 prompt template system
 * and B-002 AgentFactory for creation.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { AGENT_COLOR_PALETTE } from '@/lib/constants/agent-defaults';
import { getAgentFactory } from '@/lib/orchestration/registry/factory';
import { getRuleEngine } from '@/lib/orchestration/registry/combination-rules';
import type { CourseInfo } from '@/lib/orchestration/registry/combination-rules';

const log = createLogger('Agent Profiles API');

export const maxDuration = 120;

interface RequestBody {
  stageInfo: { name: string; description?: string };
  sceneOutlines?: { title: string; description?: string; type?: string }[];
  languageDirective: string;
  availableAvatars: string[];
  avatarDescriptions?: Array<{ path: string; desc: string }>;
  availableVoices?: Array<{
    providerId: string;
    voiceId: string;
    voiceName: string;
    voiceLanguage?: string;
  }>;
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export async function POST(req: NextRequest) {
  let stageName: string | undefined;
  let modelString: string | undefined;
  try {
    const body = (await req.json()) as RequestBody;
    const {
      stageInfo,
      sceneOutlines,
      languageDirective,
      availableAvatars,
      avatarDescriptions,
      availableVoices,
    } = body;
    stageName = stageInfo?.name;

    if (!stageInfo?.name) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'stageInfo.name is required');
    }
    if (!languageDirective) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'languageDirective is required');
    }
    if (!availableAvatars || availableAvatars.length === 0) {
      return apiError(
        'MISSING_REQUIRED_FIELD', 400, 'availableAvatars is required and must not be empty',
      );
    }

    const { model: languageModel, modelString: _modelString, thinkingConfig } =
      await resolveModelFromRequest(req, body);
    modelString = _modelString;

    // ── Build course info for combination rules ──
    const sceneTypes = sceneOutlines?.map((s) => s.type).filter((t): t is string => !!t) ?? [];
    const courseInfo: CourseInfo = {
      name: stageInfo.name,
      description: stageInfo.description,
      sceneTypes,
      sceneCount: sceneOutlines?.length ?? 0,
      hasQuiz: sceneTypes.includes('quiz'),
      hasPBL: sceneTypes.includes('pbl'),
    };

    // ── Recommendation for hinting ──
    const engine = getRuleEngine();
    const combo = engine.recommend(courseInfo);

    // ── Build voice/avatar strings ──
    const avatarEntries =
      avatarDescriptions && avatarDescriptions.length > 0
        ? avatarDescriptions.map((a) => ({ path: a.path, description: a.desc }))
        : availableAvatars;
    const voiceList = availableVoices?.length
      ? availableVoices.map((v) => ({ id: `${v.providerId}::${v.voiceId}`, name: v.voiceName, language: v.voiceLanguage || 'unknown' }))
      : [];

    const sceneSummary = sceneOutlines?.length
      ? sceneOutlines.map((s, i) => `${i + 1}. ${s.title}${s.description ? ` — ${s.description}` : ''}`).join('\n')
      : '';

    // ── Build prompt from template ──
    const prompts = buildPrompt(PROMPT_IDS.AGENT_PROFILES, {
      languageDirective,
      courseName: stageInfo.name,
      courseDescription: stageInfo.description || '',
      sceneOutlines: sceneSummary,
      availableAvatars: JSON.stringify(avatarEntries),
      availableColors: JSON.stringify(AGENT_COLOR_PALETTE),
      availableVoices: JSON.stringify(voiceList),
      hasVoices: voiceList.length > 0,
      recommendedCombo: JSON.stringify({
        teacher: combo.teacher,
        assistant: combo.assistant,
        studentCount: combo.students.count,
        preferredTypes: combo.students.preferredTypes.join(', '),
      }),
    });

    if (!prompts) {
      return apiError('INTERNAL_ERROR', 500, 'agent-profiles prompt template not found');
    }

    log.info(`Generating agent profiles for "${stageInfo.name}" [model=${modelString}]`);

    // ── Call LLM with retries ──
    const rawResult = (
      await callLLM(
        { model: languageModel, system: prompts.system, prompt: prompts.user || prompts.system },
        'agent-profiles',
        { retries: 2 },
        thinkingConfig,
      )
    ).text;

    // ── Parse LLM response ──
    const rawText = stripCodeFences(rawResult);
    let parsed: {
      agents: Array<{
        name: string; role: string; persona: string;
        avatar: string; color: string; priority: number; voice?: string;
      }>;
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      log.error('Failed to parse LLM response:', rawText.substring(0, 500));
      return apiError('PARSE_FAILED', 500, 'Failed to parse agent profiles from LLM response');
    }

    if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length < 2) {
      return apiError('GENERATION_FAILED', 500, `Expected at least 2 agents but got ${parsed.agents?.length ?? 0}`);
    }

    const teacherCount = parsed.agents.filter((a) => a.role === 'teacher').length;
    if (teacherCount !== 1) {
      return apiError('GENERATION_FAILED', 500, `Expected exactly 1 teacher but got ${teacherCount}`);
    }

    // ── Create agents via factory ──
    const factory = getAgentFactory();
    const agents = parsed.agents.map((agent, index) => {
      let voiceConfig: { providerId: string; voiceId: string } | undefined;
      if (agent.voice && agent.voice.includes('::')) {
        const [providerId, voiceId] = agent.voice.split('::');
        if (providerId && voiceId) voiceConfig = { providerId, voiceId };
      }

      return factory.createFromLLM(
        {
          name: agent.name,
          role: agent.role,
          persona: agent.persona,
          avatar: agent.avatar || availableAvatars[index % availableAvatars.length],
          color: agent.color || AGENT_COLOR_PALETTE[index % AGENT_COLOR_PALETTE.length],
          priority: agent.priority ?? (agent.role === 'teacher' ? 10 : agent.role === 'assistant' ? 7 : 5),
          voiceConfig,
        },
        availableAvatars[index % availableAvatars.length],
        AGENT_COLOR_PALETTE[index % AGENT_COLOR_PALETTE.length],
      );
    });

    log.info(`Successfully generated ${agents.length} agent profiles for "${stageInfo.name}"`);
    return apiSuccess({ agents });
  } catch (error) {
    log.error(
      `Agent profiles generation failed [stage="${stageName ?? 'unknown'}", model=${modelString ?? 'unknown'}]:`, error,
    );
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
