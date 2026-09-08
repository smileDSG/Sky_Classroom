/**
 * TeachingJob → Classroom OutlineOnlyResult Adapter
 *
 * Converts a completed AI teaching job into the Phase-1 result shape used by
 * the standard classroom generation pipeline, so we can reuse the existing
 * outline-review + scene-generation flow instead of generating a new outline.
 */

import { nanoid } from 'nanoid';
import type { TeachingJob, GeneratedSectionData } from '@/lib/server/teaching-job-store';
import type { SceneOutline } from '@/lib/types/generation';
import type { OutlineOnlyResult } from '@/lib/server/classroom-generation';
import type { AgentInfo } from '@/lib/generation/pipeline-types';
import { getDefaultAgents } from '@/lib/orchestration/registry/store';
import { buildVideoManifestFromOutlines } from '@/lib/media/video-manifest';
import {
  DEFAULT_LANGUAGE_DIRECTIVE,
  mergeSparseSlideOutlines,
} from '@/lib/generation/outline-generator';
import type { TeachingToClassroomConfig } from '@/lib/teaching/classroom-config-recommendation';

function createId(prefix: string): string {
  return `${prefix}_${nanoid(8)}`;
}

function sectionToSceneOutline(data: GeneratedSectionData, index: number): SceneOutline {
  const { section, chunks, structured } = data;

  const hasQuiz =
    section.contentType === 'quiz' ||
    section.hasQuiz ||
    chunks.some((c) => c.type === 'quiz' && !c.failed);

  const firstTextChunk = chunks.find((c) => c.type === 'text' && !c.failed);
  const description = firstTextChunk
    ? firstTextChunk.content.slice(0, 120).replace(/\s+/g, ' ').trim()
    : section.title;

  // Enrich key points with structured content hints so the classroom generation
  // pipeline can produce richer slides when this outline is reused.
  const truncate = (text: string, max = 120) =>
    text.length > max ? `${text.slice(0, max).trim()}…` : text;
  const structuredKeyPoints: string[] = [];
  if (structured) {
    if (structured.type === 'concept' && structured.cards?.length) {
      structuredKeyPoints.push(...structured.cards.map((c) => truncate(`${c.title}：${c.desc}`)));
    } else if (structured.type === 'case' && structured.scenarios?.length) {
      structuredKeyPoints.push(...structured.scenarios.map((s) => truncate(`例题：${s.problem}`)));
    } else if (structured.type === 'process' && structured.steps?.length) {
      structuredKeyPoints.push(
        ...structured.steps.map((s) => truncate(`${s.num}. ${s.title}：${s.desc}`)),
      );
    } else if (structured.type === 'formula') {
      if (structured.mainFormula)
        structuredKeyPoints.push(truncate(`公式：${structured.mainFormula}`));
      if (structured.derivation)
        structuredKeyPoints.push(truncate(`推导：${structured.derivation}`));
      if (structured.application)
        structuredKeyPoints.push(truncate(`应用：${structured.application}`));
    } else if (structured.type === 'summary' && structured.keyPoints?.length) {
      structuredKeyPoints.push(...structured.keyPoints.map((kp) => truncate(kp)));
    }
  }

  const keyPoints =
    structuredKeyPoints.length > 0
      ? structuredKeyPoints.slice(0, 5)
      : section.knowledgePoints.length
        ? section.knowledgePoints
        : [section.title];

  const base: SceneOutline = {
    id: createId('ol'),
    type: hasQuiz ? 'quiz' : 'slide',
    title: section.title,
    description,
    keyPoints,
    estimatedDuration: (section.estimatedDuration || 3) * 60,
    order: index + 1,
  };

  if (hasQuiz) {
    const quizChunks = chunks.filter((c) => c.type === 'quiz' && !c.failed);
    base.quizConfig = {
      questionCount: Math.max(1, quizChunks.length || 1),
      difficulty:
        section.depth === 'advanced' ? 'hard' : section.depth === 'basic' ? 'easy' : 'medium',
      questionTypes: ['single'],
    };
  }

  return base;
}

function buildRequirementFromJob(job: TeachingJob): string {
  const title = job.plan?.title || job.topic;
  const focus = job.plan?.focusPoints?.length ? `重点：${job.plan.focusPoints.join('、')}。` : '';
  return `基于已生成的教案创建课堂。主题：${title}。${focus}`;
}

function resolveSelectedAgents(config: TeachingToClassroomConfig): AgentInfo[] {
  const allDefaults = getDefaultAgents();
  const selectedIds = [config.selectedTeacherId, ...config.selectedStudentIds];
  const uniqueIds = Array.from(new Set(selectedIds));
  const map = new Map(allDefaults.map((a) => [a.id, a]));
  return uniqueIds.map((id) => map.get(id)).filter((a): a is AgentInfo => a !== undefined);
}

/**
 * Build a complete Phase-1 result from a finished TeachingJob so that the
 * standard classroom continue pipeline can take over.
 */
export function buildOutlineOnlyResultFromTeachingJob(
  job: TeachingJob,
  config: TeachingToClassroomConfig,
): OutlineOnlyResult {
  const now = Date.now();
  const sections = job.sections ?? [];
  const plan = job.plan;

  const rawOutlines: SceneOutline[] = sections.map((sectionData, index) =>
    sectionToSceneOutline(sectionData, index),
  );
  const outlines = mergeSparseSlideOutlines(rawOutlines);

  const agents = resolveSelectedAgents(config);
  const stageId = createId('stage');

  const stageName = plan?.title || job.topic || '教案课堂';
  const stageDescription = `由 AI 智能授课教案转换而来：${job.topic}`;

  const stage: import('@/lib/types/stage').Stage = {
    id: stageId,
    name: stageName,
    description: stageDescription,
    languageDirective: DEFAULT_LANGUAGE_DIRECTIVE,
    videoManifest: buildVideoManifestFromOutlines(outlines),
    style: 'interactive',
    createdAt: now,
    updatedAt: now,
    agentIds: agents.map((a) => a.id),
    interactiveMode: false,
  };

  return {
    outlines,
    languageDirective: DEFAULT_LANGUAGE_DIRECTIVE,
    topicSummary: stageName,
    agents,
    stage,
    requirement: buildRequirementFromJob(job),
    enableImageGeneration: config.enableImageGeneration,
    enableVideoGeneration: config.enableVideoGeneration,
    enableTTS: config.enableTTS,
    skipSlideQA: false,
  };
}
