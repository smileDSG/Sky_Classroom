/**
 * Incremental generation support.
 *
 * Enables modifying and regenerating individual scenes within an existing
 * generation session without re-running the full pipeline.
 */

import type { SceneOutline, GenerationSession } from '@/lib/types/generation';
import type { StageStore } from '@/lib/api/stage-api';
import { createStageAPI } from '@/lib/api/stage-api';
import type { AICallFn } from './pipeline-types';
import { generateSingleScene } from './scene-generator';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('Generation');

export function createSceneOutline(
  title: string,
  description: string,
  type: SceneOutline['type'] = 'slide',
): SceneOutline {
  return {
    id: nanoid(),
    type,
    title,
    description,
    order: 0,
    keyPoints: [],
  };
}

export async function addSceneToSession(
  session: GenerationSession,
  outline: SceneOutline,
  store: StageStore,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<{ success: boolean; sceneId: string | null; index: number }> {
  const api = createStageAPI(store);

  const outlines = session.sceneOutlines || [];
  const newOutline = { ...outline, order: outlines.length + 1 };
  outlines.push(newOutline);
  session.sceneOutlines = outlines;

  log.info(`Incremental: generating new scene "${outline.title}"`);
  const sceneId = await generateSingleScene(newOutline, api, aiCall, languageDirective);

  session.progress.totalScenes = outlines.length;
  if (sceneId) {
    session.progress.scenesGenerated = (session.progress.scenesGenerated || 0) + 1;
    session.progress.statusMessage = `Added scene: ${outline.title}`;
  }

  return { success: sceneId !== null, sceneId, index: outlines.length - 1 };
}

export async function regenerateScene(
  session: GenerationSession,
  index: number,
  store: StageStore,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<{ success: boolean; sceneId: string | null }> {
  const outlines = session.sceneOutlines;
  if (!outlines || index < 0 || index >= outlines.length) {
    return { success: false, sceneId: null };
  }

  const api = createStageAPI(store);
  const outline = outlines[index];

  log.info(`Incremental: regenerating scene "${outline.title}" at index ${index}`);
  const sceneId = await generateSingleScene(outline, api, aiCall, languageDirective);

  session.progress.statusMessage = `Regenerated scene: ${outline.title}`;

  return { success: sceneId !== null, sceneId };
}

export function removeSceneOutline(session: GenerationSession, index: number): boolean {
  const outlines = session.sceneOutlines;
  if (!outlines || index < 0 || index >= outlines.length) {
    return false;
  }

  const removed = outlines.splice(index, 1)[0];
  outlines.forEach((o, i) => {
    o.order = i + 1;
  });
  session.progress.totalScenes = outlines.length;
  session.progress.statusMessage = `Removed scene: ${removed.title}`;

  log.info(`Incremental: removed scene "${removed.title}" at index ${index}`);

  return true;
}

export function updateSceneOutline(
  session: GenerationSession,
  index: number,
  updates: Partial<Pick<SceneOutline, 'title' | 'description' | 'keyPoints'>>,
): boolean {
  const outlines = session.sceneOutlines;
  if (!outlines || index < 0 || index >= outlines.length) {
    return false;
  }

  Object.assign(outlines[index], updates);
  log.info(`Incremental: updated outline "${outlines[index].title}" at index ${index}`);

  return true;
}

export function reorderScenes(
  session: GenerationSession,
  fromIndex: number,
  toIndex: number,
): boolean {
  const outlines = session.sceneOutlines;
  if (
    !outlines ||
    fromIndex < 0 ||
    fromIndex >= outlines.length ||
    toIndex < 0 ||
    toIndex >= outlines.length
  ) {
    return false;
  }

  const [moved] = outlines.splice(fromIndex, 1);
  outlines.splice(toIndex, 0, moved);
  outlines.forEach((o, i) => {
    o.order = i + 1;
  });

  log.info(`Incremental: moved scene from ${fromIndex} to ${toIndex}`);

  return true;
}
