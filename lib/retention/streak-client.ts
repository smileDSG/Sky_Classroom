/**
 * 连续学习天数 · 客户端辅助（T01 / FR-03）。
 *
 * ⚠️ 独立成文件的原因：lib/retention/streak.ts 顶部import 了 `getServerStorage`
 * → server-storage → mysql2 → Node 内置 `tls`。若客户端组件经由 store 引用该文件，
 * 会把 MySQL 驱动拖进浏览器 bundle，直接导致首页 500（Module not found: 'tls'）。
 *
 * 因此：**任何客户端代码只能从本文件导入**，绝不要从 streak.ts 导入。
 * 本文件只依赖 fetch，不含任何服务端依赖。
 */

import type { StreakState } from './types';

/** 在"学习证据写入"点调用：记录当日活跃（幂等）。失败静默，不影响学习流程。 */
export async function recordLearningStreakClient(): Promise<void> {
  try {
    await fetch('/api/sky/learning-streak', { method: 'POST', credentials: 'include' });
  } catch {
    /* 本地优先，服务端失败不影响 UI */
  }
}

/** 读取连续天数状态（用于首屏展示）。失败返回 null，由调用方回退本地缓存。 */
export async function fetchStreakStateClient(): Promise<StreakState | null> {
  try {
    const res = await fetch('/api/sky/learning-streak', { credentials: 'include' });
    const json = (await res.json()) as { success?: boolean; streak?: StreakState };
    if (json?.success && json.streak) return json.streak;
  } catch {
    /* ignore */
  }
  return null;
}
