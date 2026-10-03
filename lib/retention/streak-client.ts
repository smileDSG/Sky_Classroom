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

/**
 * 在"学习证据写入"点调用：记录当日活跃（幂等），并把**服务端最新 streak**回传调用方。
 *
 * 必须回传：调用方要据此刷新 `streakCache`。写入点通常发生在别的页面
 * （如 /sky/learning/stats），跳槽回首页时卡片不会重新挂载 → 不回传就会出现
 * 「服务端已经是 2、首屏还显示 1」。失败静默、返回 null，学习流程绝不能被打断。
 */
export async function recordLearningStreakClient(): Promise<StreakState | null> {
  try {
    const res = await fetch('/api/sky/learning-streak', {
      method: 'POST',
      credentials: 'include',
    });
    const json = (await res.json()) as { success?: boolean; streak?: StreakState };
    if (json?.success && json.streak) return json.streak;
  } catch {
    /* 本地优先，服务端失败不影响 UI */
  }
  return null;
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
