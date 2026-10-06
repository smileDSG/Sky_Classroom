/** 生成完成的分镜脚本持久化：data/animation-scripts/{scriptId}.json（spec §7） */
import fsp from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';
import type { AnimationScript, ScriptMeta } from './types';

const log = createLogger('AnimationScriptStore');

function scriptsDir(): string {
  return process.env.ANIMATION_SCRIPTS_DIR ?? path.join(process.cwd(), 'data', 'animation-scripts');
}

function scriptFilePath(scriptId: string): string {
  return path.join(scriptsDir(), `${scriptId}.json`);
}

export function isValidScriptId(scriptId: string): boolean {
  return /^[A-Za-z0-9_-]{4,64}$/.test(scriptId);
}

export async function saveAnimationScript(script: AnimationScript): Promise<string> {
  // id 非法时重新生成，避免 succeeded job 指向无法读取的脚本文件
  const id = isValidScriptId(script.id) ? script.id : `anim-${nanoid(8)}`;
  const payload = { ...script, id, savedAt: new Date().toISOString() };
  await writeJsonFileAtomic(scriptFilePath(id), payload);
  return id;
}

export async function readAnimationScript(scriptId: string): Promise<AnimationScript | null> {
  if (!isValidScriptId(scriptId)) return null;
  try {
    const raw = await fsp.readFile(scriptFilePath(scriptId), 'utf-8');
    const parsed = JSON.parse(raw) as AnimationScript & { savedAt?: string };
    const { savedAt: _savedAt, ...script } = parsed;
    return script;
  } catch (error) {
    // ENOENT 是正常的不存在；其他错误（权限/损坏）记录日志以便排查
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn(`读取脚本失败（文件可能损坏）: ${scriptFilePath(scriptId)}`, error);
    }
    return null;
  }
}

export async function listAnimationScripts(): Promise<ScriptMeta[]> {
  try {
    const names = await fsp.readdir(scriptsDir());
    const metas: ScriptMeta[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await fsp.readFile(path.join(scriptsDir(), name), 'utf-8');
        const s = JSON.parse(raw) as AnimationScript & { savedAt?: string };
        metas.push({
          scriptId: s.id,
          title: s.title,
          topic: s.topic,
          subjectArea: s.subjectArea,
          stepCount: s.steps.length,
          // plan 勘误：AnimationScript 本身无 createdAt，用保存时写入的 savedAt 兜底
          createdAt: s.savedAt ?? new Date().toISOString(),
        });
      } catch {
        // 跳过损坏文件
      }
    }
    return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
