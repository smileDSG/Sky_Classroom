import { nanoid } from 'nanoid';
import { callLLM } from '@/lib/ai/llm';
import { keyRotator } from '@/lib/ai/key-rotator';
import { createStageAPI } from '@/lib/api/stage-api';
import type { StageStore } from '@/lib/api/stage-api-types';
import {
  applyOutlineFallbacks,
  generateSceneOutlinesFromRequirements,
} from '@/lib/generation/outline-generator';
import pMap from 'p-map';
import { resolveConcurrency } from '@/lib/constants/generation';
import {
  createSceneWithActions,
  generateSceneActions,
  generateSceneContent,
} from '@/lib/generation/scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { AgentInfo } from '@/lib/generation/pipeline-types';
import { getDefaultAgents } from '@/lib/orchestration/registry/store';
import { createLogger } from '@/lib/logger';
import { isProviderKeyRequired } from '@/lib/ai/providers';
import { resolveClassroomWebSearchConfig } from '@/lib/server/web-search-config';
import { resolveModel } from '@/lib/server/resolve-model';
import { buildSearchQuery } from '@/lib/server/search-query-builder';
import { formatSearchResultsAsContext, searchWeb } from '@/lib/web-search';
import type { BaiduSubSources, WebSearchProviderId } from '@/lib/web-search/types';
import { persistClassroom } from '@/lib/server/classroom-storage';
import {
  generateMediaForClassroom,
  replaceMediaPlaceholders,
  generateTTSForClassroom,
} from '@/lib/server/classroom-media-generation';
import { buildVideoManifestFromOutlines } from '@/lib/media/video-manifest';
import type { UserRequirements } from '@/lib/types/generation';
import type { Scene, Stage } from '@/lib/types/stage';
import { AGENT_COLOR_PALETTE, AGENT_DEFAULT_AVATARS } from '@/lib/constants/agent-defaults';

const log = createLogger('Classroom');

export interface GenerateClassroomInput {
  requirement: string;
  pdfContent?: { text: string; images: string[] };
  enableWebSearch?: boolean;
  webSearchProviderId?: WebSearchProviderId;
  webSearchApiKey?: string;
  baiduSubSources?: BaiduSubSources;
  enableImageGeneration?: boolean;
  enableVideoGeneration?: boolean;
  enableTTS?: boolean;
  agentMode?: 'default' | 'generate';
}

export type ClassroomGenerationStep =
  | 'initializing'
  | 'researching'
  | 'generating_outlines'
  | 'generating_scenes'
  | 'generating_media'
  | 'generating_tts'
  | 'persisting'
  | 'completed'
  | 'awaiting_review';

export interface OutlineOnlyResult {
  outlines: import('@/lib/types/generation').SceneOutline[];
  languageDirective: string;
  topicSummary?: string;
  agents: AgentInfo[];
  stage: Stage;
  requirement: string;
  pdfText?: string;
  researchContext?: string;
  enableImageGeneration: boolean;
  enableVideoGeneration: boolean;
  enableTTS: boolean;
}

export interface ClassroomGenerationProgress {
  step: ClassroomGenerationStep;
  progress: number;
  message: string;
  scenesGenerated: number;
  totalScenes?: number;
}

export interface GenerateClassroomResult {
  id: string;
  url: string;
  stage: Stage;
  scenes: Scene[];
  scenesCount: number;
  createdAt: string;
}

function createInMemoryStore(stage: Stage): StageStore {
  let state = {
    stage: stage as Stage | null,
    scenes: [] as Scene[],
    currentSceneId: null as string | null,
    mode: 'playback' as const,
  };

  const listeners: Array<(s: typeof state, prev: typeof state) => void> = [];

  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      const prev = state;
      state = { ...state, ...partial };
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe: (listener: (s: typeof state, prev: typeof state) => void) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
  };
}

async function generateTopicSummary(
  requirement: string,
  outlines: import('@/lib/types/generation').SceneOutline[],
  aiCall: AICallFn,
): Promise<string> {
  const systemPrompt =
    'You are a course topic summarizer. Output a concise topic title that captures the essence of the course.';

  const outlineTitles = outlines
    .slice(0, 5)
    .map((o) => `- ${o.title}`)
    .join('\n');

  const userPrompt = `Summarize the following course into a short topic title (no more than 25 characters):

User's requirement:
${requirement.slice(0, 300)}

Scene outline titles:
${outlineTitles}

Rules:
- Output in the same language as the requirement.
- Be concise and descriptive.
- Return ONLY the topic title, no quotes, no prefixes, no extra text.`;

  try {
    const response = await aiCall(systemPrompt, userPrompt);
    const cleaned = response.trim().replace(/^["']|["']$/g, '');
    return cleaned.slice(0, 40);
  } catch {
    return outlines[0]?.title?.slice(0, 40) || requirement.slice(0, 40);
  }
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

async function generateAgentProfiles(
  requirement: string,
  languageDirective: string,
  aiCall: AICallFn,
): Promise<AgentInfo[]> {
  const systemPrompt =
    'You are an expert instructional designer. Generate agent profiles for a multi-agent classroom simulation. Return ONLY valid JSON, no markdown or explanation.';

  const userPrompt = `Generate agent profiles for a course with this requirement:
${requirement}

Requirements:
- Decide the appropriate number of agents based on the course content (typically 3-5)
- Exactly 1 agent must have role "teacher", the rest can be "assistant" or "student"
- Each agent needs: name, role, persona (2-3 sentences describing personality and teaching/learning style)
- Language directive for this course: ${languageDirective}
  Agent names and personas must follow this language directive.

Return a JSON object with this exact structure:
{
  "agents": [
    {
      "name": "string",
      "role": "teacher" | "assistant" | "student",
      "persona": "string (2-3 sentences)"
    }
  ]
}`;

  const response = await aiCall(systemPrompt, userPrompt);
  const rawText = stripCodeFences(response);
  const parsed = JSON.parse(rawText) as {
    agents: Array<{ name: string; role: string; persona: string }>;
  };

  if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length < 2) {
    throw new Error(`Expected at least 2 agents, got ${parsed.agents?.length ?? 0}`);
  }

  const teacherCount = parsed.agents.filter((a) => a.role === 'teacher').length;
  if (teacherCount !== 1) {
    throw new Error(`Expected exactly 1 teacher, got ${teacherCount}`);
  }

  return parsed.agents.map((a, i) => ({
    id: `gen-server-${i}`,
    name: a.name,
    role: a.role,
    persona: a.persona,
  }));
}

export async function generateClassroom(
  input: GenerateClassroomInput,
  options: {
    baseUrl: string;
    phase?: 'full' | 'outline_only';
    modelConfig?: {
      modelString?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    onProgress?: (progress: ClassroomGenerationProgress) => Promise<void> | void;
  },
): Promise<GenerateClassroomResult | OutlineOnlyResult> {
  const phase = options.phase ?? 'full';
  const { requirement, pdfContent } = input;

  await options.onProgress?.({
    step: 'initializing',
    progress: 5,
    message: 'Initializing classroom generation',
    scenesGenerated: 0,
  });

  const {
    model: languageModel,
    modelInfo,
    modelString,
    providerId,
    apiKey,
    keyPool,
  } = await resolveModel(options.modelConfig ?? {});
  log.info(`Using server-configured model: ${modelString}`);

  // Register key pool for rotation (if multiple keys available)
  if (keyPool.length > 1) {
    keyRotator.register(providerId, keyPool);
    log.info(`Key rotation enabled for "${providerId}": ${keyPool.length} keys`);
  }

  const concurrency = resolveConcurrency(keyPool.length);
  log.info(`Generation concurrency: ${concurrency} (keys: ${keyPool.length})`);

  // Fail fast if the resolved provider has no API key configured
  if (isProviderKeyRequired(providerId) && !apiKey) {
    throw new Error(
      `No API key configured for provider "${providerId}". ` +
        `Set the appropriate key in .env.local or server-providers.yml (e.g. ${providerId.toUpperCase()}_API_KEY).`,
    );
  }

  const aiCall: AICallFn = async (systemPrompt, userPrompt, _images) => {
    const result = await callLLM(
      {
        model: languageModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxOutputTokens: modelInfo?.outputWindow,
      },
      'generate-classroom',
    );
    return result.text;
  };

  const searchQueryAiCall: AICallFn = async (systemPrompt, userPrompt, _images) => {
    const result = await callLLM(
      {
        model: languageModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxOutputTokens: 256,
      },
      'web-search-query-rewrite',
    );
    return result.text;
  };

  const requirements: UserRequirements = {
    requirement,
  };
  const pdfText = pdfContent?.text || undefined;

  await options.onProgress?.({
    step: 'researching',
    progress: 10,
    message: 'Researching topic',
    scenesGenerated: 0,
  });

  // Web search (optional, graceful degradation)
  let researchContext: string | undefined;
  if (input.enableWebSearch) {
    const webSearchConfig = resolveClassroomWebSearchConfig(input);
    if (webSearchConfig) {
      try {
        const searchQuery = await buildSearchQuery(requirement, pdfText, searchQueryAiCall);

        log.info('Running web search for classroom generation', {
          hasPdfContext: searchQuery.hasPdfContext,
          rawRequirementLength: searchQuery.rawRequirementLength,
          rewriteAttempted: searchQuery.rewriteAttempted,
          finalQueryLength: searchQuery.finalQueryLength,
        });

        const searchResult = await searchWeb({
          providerId: webSearchConfig.providerId,
          query: searchQuery.query,
          apiKey: webSearchConfig.apiKey,
          baseUrl: webSearchConfig.baseUrl,
          baiduSubSources: webSearchConfig.baiduSubSources,
        });
        researchContext = formatSearchResultsAsContext(searchResult);
        if (researchContext) {
          log.info(`Web search returned ${searchResult.sources.length} sources`);
        }
      } catch (e) {
        log.warn('Web search failed, continuing without search context:', e);
      }
    } else {
      log.warn('enableWebSearch is true but no web search API key configured, skipping web search');
    }
  }

  await options.onProgress?.({
    step: 'generating_outlines',
    progress: 15,
    message: 'Generating scene outlines',
    scenesGenerated: 0,
  });

  // Heartbeat: increment progress while LLM runs (can take 30-60s with no updates)
  let outlineProgress = 15;
  const heartbeat = options.onProgress
    ? setInterval(() => {
        outlineProgress = Math.min(outlineProgress + 2, 28);
        Promise.resolve(
          options.onProgress!({
            step: 'generating_outlines',
            progress: outlineProgress,
            message: 'AI is thinking...',
            scenesGenerated: 0,
          }),
        ).catch(() => {});
      }, 2000)
    : null;

  let outlinesResult;
  try {
    outlinesResult = await generateSceneOutlinesFromRequirements(
      requirements,
      pdfText,
      undefined,
      aiCall,
      undefined,
      {
        imageGenerationEnabled: input.enableImageGeneration,
        videoGenerationEnabled: input.enableVideoGeneration,
        researchContext,
        // NO teacherContext — agents haven't been generated yet
      },
    );
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }

  if (!outlinesResult.success || !outlinesResult.data) {
    log.error('Failed to generate outlines:', outlinesResult.error);
    throw new Error(outlinesResult.error || 'Failed to generate scene outlines');
  }

  const { languageDirective, outlines } = outlinesResult.data;
  log.info(`Generated ${outlines.length} scene outlines (languageDirective: ${languageDirective})`);

  // Generate a short AI topic summary for display on progress cards
  const topicSummary = await generateTopicSummary(requirement, outlines, aiCall);
  log.info(`Topic summary: "${topicSummary}"`);

  await options.onProgress?.({
    step: 'generating_outlines',
    progress: 30,
    message: `Generated ${outlines.length} scene outlines`,
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });

  // Resolve agents based on agentMode — now AFTER outlines so we can use languageDirective
  let agents: AgentInfo[];
  const agentMode = input.agentMode || 'default';
  if (agentMode === 'generate') {
    log.info('Generating custom agent profiles via LLM...');
    try {
      agents = await generateAgentProfiles(requirement, languageDirective, aiCall);
      log.info(`Generated ${agents.length} agent profiles`);
    } catch (e) {
      log.warn('Agent profile generation failed, falling back to defaults:', e);
      agents = getDefaultAgents();
    }
  } else {
    agents = getDefaultAgents();
  }

  const stageId = nanoid(10);
  const stage: Stage = {
    id: stageId,
    name: outlines[0]?.title || requirement.slice(0, 50),
    description: undefined,
    languageDirective,
    videoManifest: buildVideoManifestFromOutlines(outlines),
    style: 'interactive',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // For LLM-generated agents, embed full configs so the client can
    // hydrate the agent registry without prior IndexedDB data.
    // For default agents, just record IDs — the client already has them.
    ...(agentMode === 'generate'
      ? {
          generatedAgentConfigs: agents.map((a, i) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            persona: a.persona || '',
            avatar: AGENT_DEFAULT_AVATARS[i % AGENT_DEFAULT_AVATARS.length],
            color: AGENT_COLOR_PALETTE[i % AGENT_COLOR_PALETTE.length],
            priority: a.role === 'teacher' ? 10 : a.role === 'assistant' ? 7 : 5,
          })),
        }
      : {
          agentIds: agents.map((a) => a.id),
        }),
  };

  const store = createInMemoryStore(stage);
  const api = createStageAPI(store);

  // Phase 1 only: return outlines for review
  if (phase === 'outline_only') {
    log.info('Outline phase complete, returning outlines for review');
    return {
      outlines,
      languageDirective,
      topicSummary,
      agents,
      stage,
      requirement,
      pdfText,
      researchContext,
      enableImageGeneration: input.enableImageGeneration ?? false,
      enableVideoGeneration: input.enableVideoGeneration ?? false,
      enableTTS: input.enableTTS ?? false,
    };
  }

  log.info(
    `Stage 2: Generating ${outlines.length} scene(s) in parallel (concurrency=${concurrency})...`,
  );

  await options.onProgress?.({
    step: 'generating_scenes',
    progress: 31,
    message: `Generating ${outlines.length} scenes in parallel...`,
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });

  // Phase A: Generate all scene content in parallel
  const contentResults = await pMap(
    outlines,
    async (outline, index) => {
      const safeOutline = applyOutlineFallbacks(outline, true);
      try {
        const content = await generateSceneContent(safeOutline, aiCall, {
          agents,
          languageDirective,
        });
        if (!content) {
          log.warn(`Skipping scene "${safeOutline.title}" — content generation failed`);
          return null;
        }
        return { outline: safeOutline, content, index };
      } catch (err) {
        log.error(`Scene "${safeOutline.title}" content generation error:`, err);
        return null;
      }
    },
    { concurrency },
  );

  // Phase B: Generate all scene actions in parallel (content already available)
  const sceneResults = await pMap(
    contentResults,
    async (result) => {
      if (!result) return null;
      try {
        const actions = await generateSceneActions(result.outline, result.content, aiCall, {
          agents,
          languageDirective,
        });
        log.info(`Scene "${result.outline.title}": ${actions.length} actions`);
        return { outline: result.outline, content: result.content, actions, index: result.index };
      } catch (err) {
        log.error(`Scene "${result.outline.title}" action generation error:`, err);
        return null;
      }
    },
    { concurrency },
  );

  // Phase B: Write to store sequentially (fast, avoids race conditions)
  let generatedScenes = 0;
  for (const result of sceneResults) {
    if (!result) continue;
    const sceneId = createSceneWithActions(result.outline, result.content, result.actions, api);
    if (!sceneId) {
      log.warn(`Skipping scene "${result.outline.title}" — scene creation failed`);
      continue;
    }
    generatedScenes += 1;
    const progressEnd = 30 + Math.floor((generatedScenes / Math.max(outlines.length, 1)) * 60);
    await options.onProgress?.({
      step: 'generating_scenes',
      progress: Math.min(progressEnd, 90),
      message: `Generated ${generatedScenes}/${outlines.length} scenes`,
      scenesGenerated: generatedScenes,
      totalScenes: outlines.length,
    });
  }

  const scenes = store.getState().scenes;
  log.info(`Pipeline complete: ${scenes.length} scenes generated`);

  if (scenes.length === 0) {
    throw new Error('No scenes were generated');
  }

  // Persist immediately so the classroom is usable
  await options.onProgress?.({
    step: 'persisting',
    progress: 90,
    message: 'Persisting classroom data',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  const persisted = await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);

  log.info(`Classroom persisted: ${persisted.id}, URL: ${persisted.url}`);

  // Fire-and-forget: media + TTS generation in background
  const needsMedia = input.enableImageGeneration || input.enableVideoGeneration;
  const needsTTS = input.enableTTS;

  if (needsMedia || needsTTS) {
    // Don't await — let it run in background after response is sent
    (async () => {
      let updated = false;

      if (needsMedia) {
        try {
          const mediaMap = await generateMediaForClassroom(outlines, stageId, options.baseUrl);
          replaceMediaPlaceholders(scenes, mediaMap);
          log.info(`Background media complete: ${Object.keys(mediaMap).length} files`);
          updated = true;
        } catch (err) {
          log.warn('Background media generation failed:', err);
        }
      }

      if (needsTTS) {
        try {
          await generateTTSForClassroom(scenes, stageId, options.baseUrl);
          log.info('Background TTS complete');
          updated = true;
        } catch (err) {
          log.warn('Background TTS generation failed:', err);
        }
      }

      // Re-persist with media/TTS URLs
      if (updated) {
        try {
          await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);
          log.info('Classroom re-persisted with media/TTS');
        } catch (err) {
          log.warn('Failed to re-persist after media/TTS:', err);
        }
      }
    })();
  }

  await options.onProgress?.({
    step: 'completed',
    progress: 100,
    message: 'Classroom generation completed',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  return {
    id: persisted.id,
    url: persisted.url,
    stage,
    scenes,
    scenesCount: scenes.length,
    createdAt: persisted.createdAt,
  };
}

export async function generateClassroomContinue(
  saved: OutlineOnlyResult,
  options: {
    baseUrl: string;
    modelConfig?: {
      modelString?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    onProgress?: (progress: ClassroomGenerationProgress) => Promise<void> | void;
  },
): Promise<GenerateClassroomResult> {
  const { outlines, languageDirective, agents, stage, requirement, pdfText, researchContext } =
    saved;

  const {
    model: languageModel,
    modelInfo,
    modelString,
    providerId,
    apiKey,
    keyPool,
  } = await resolveModel(options.modelConfig ?? {});
  log.info(`Phase 2 using model: ${modelString}`);

  // Register key pool for rotation (if multiple keys available)
  if (keyPool.length > 1) {
    keyRotator.register(providerId, keyPool);
    log.info(`Key rotation enabled for "${providerId}": ${keyPool.length} keys`);
  }

  const concurrency = resolveConcurrency(keyPool.length);
  log.info(`Generation concurrency: ${concurrency} (keys: ${keyPool.length})`);

  if (isProviderKeyRequired(providerId) && !apiKey) {
    throw new Error(
      `No API key configured for provider "${providerId}". ` +
        `Set the appropriate key in .env.local or server-providers.yml.`,
    );
  }

  const aiCall: AICallFn = async (systemPrompt, userPrompt, _images) => {
    const result = await callLLM(
      {
        model: languageModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxOutputTokens: modelInfo?.outputWindow,
      },
      'generate-classroom-continue',
    );
    return result.text;
  };

  const store = createInMemoryStore(stage);
  const api = createStageAPI(store);

  log.info(
    `Phase 2: Generating ${outlines.length} scene(s) in parallel (concurrency=${concurrency})...`,
  );

  await options.onProgress?.({
    step: 'generating_scenes',
    progress: 31,
    message: `Generating ${outlines.length} scenes in parallel...`,
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });

  // Phase A: Generate all scene content in parallel
  const contentResults = await pMap(
    outlines,
    async (outline, index) => {
      const safeOutline = applyOutlineFallbacks(outline, true);
      try {
        const content = await generateSceneContent(safeOutline, aiCall, {
          agents,
          languageDirective,
        });
        if (!content) {
          log.warn(`Skipping scene "${safeOutline.title}" — content generation failed`);
          return null;
        }
        return { outline: safeOutline, content, index };
      } catch (err) {
        log.error(`Scene "${safeOutline.title}" content generation error:`, err);
        return null;
      }
    },
    { concurrency },
  );

  // Phase B: Generate all scene actions in parallel (content already available)
  const sceneResults = await pMap(
    contentResults,
    async (result) => {
      if (!result) return null;
      try {
        const actions = await generateSceneActions(result.outline, result.content, aiCall, {
          agents,
          languageDirective,
        });
        return { outline: result.outline, content: result.content, actions, index: result.index };
      } catch (err) {
        log.error(`Scene "${result.outline.title}" action generation error:`, err);
        return null;
      }
    },
    { concurrency },
  );

  // Phase B: Write to store sequentially (fast, avoids race conditions)
  let generatedScenes = 0;
  for (const result of sceneResults) {
    if (!result) continue;
    const sceneId = createSceneWithActions(result.outline, result.content, result.actions, api);
    if (!sceneId) {
      log.warn(`Skipping scene "${result.outline.title}" — scene creation failed`);
      continue;
    }
    generatedScenes += 1;
    const progressEnd = 30 + Math.floor((generatedScenes / Math.max(outlines.length, 1)) * 60);
    await options.onProgress?.({
      step: 'generating_scenes',
      progress: Math.min(progressEnd, 90),
      message: `Generated ${generatedScenes}/${outlines.length} scenes`,
      scenesGenerated: generatedScenes,
      totalScenes: outlines.length,
    });
  }

  const scenes = store.getState().scenes;
  log.info(`Phase 2 pipeline: ${scenes.length} scenes generated`);

  if (scenes.length === 0) {
    throw new Error('No scenes were generated');
  }

  const stageId = stage.id;

  // Persist immediately so the classroom is usable
  await options.onProgress?.({
    step: 'persisting',
    progress: 90,
    message: 'Persisting classroom data',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  const persisted = await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);

  log.info(`Phase 2 classroom persisted: ${persisted.id}`);

  // Fire-and-forget: media + TTS generation in background
  const needsMedia = saved.enableImageGeneration || saved.enableVideoGeneration;
  const needsTTS = saved.enableTTS;

  if (needsMedia || needsTTS) {
    (async () => {
      let updated = false;

      if (needsMedia) {
        try {
          const mediaMap = await generateMediaForClassroom(outlines, stageId, options.baseUrl);
          replaceMediaPlaceholders(scenes, mediaMap);
          log.info(`Background media complete: ${Object.keys(mediaMap).length} files`);
          updated = true;
        } catch (err) {
          log.warn('Background media generation failed:', err);
        }
      }

      if (needsTTS) {
        try {
          await generateTTSForClassroom(scenes, stageId, options.baseUrl);
          log.info('Background TTS complete');
          updated = true;
        } catch (err) {
          log.warn('Background TTS generation failed:', err);
        }
      }

      if (updated) {
        try {
          await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);
          log.info('Classroom re-persisted with media/TTS');
        } catch (err) {
          log.warn('Failed to re-persist after media/TTS:', err);
        }
      }
    })();
  }

  await options.onProgress?.({
    step: 'completed',
    progress: 100,
    message: 'Classroom generation completed',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  return {
    id: persisted.id,
    url: persisted.url,
    stage,
    scenes,
    scenesCount: scenes.length,
    createdAt: persisted.createdAt,
  };
}
