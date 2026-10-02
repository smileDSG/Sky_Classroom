/**
 * 成长可见 · 客户端辅助（T01 / FR-01、FR-02）。
 *
 * ⚠️ 独立成文件的原因同streak-client.ts：
 * lib/retention/growth-history.ts import 了 server-storage（→ mysql2 → 'tls'），
 * 客户端组件引用它会把服务端依赖拖进浏览器 bundle，导致页面 500。
 * **客户端代码只能从本文件导入。** 本文件只依赖 fetch。
 */

import type { GrowthSnapshot, MistakeTrendPoint } from './types';

export interface GrowthHistoryView {
  curve: GrowthSnapshot[];
  trend: MistakeTrendPoint[];
}

/** 拉取成长历史（曲线 + 趋势）。失败返回 null，由调用方回退本地缓存。 */
export async function fetchGrowthHistory(): Promise<GrowthHistoryView | null> {
  try {
    const res = await fetch('/api/sky/growth-history', { credentials: 'include' });
    const json = (await res.json()) as {
      success?: boolean;
      curve?: GrowthSnapshot[];
      trend?: MistakeTrendPoint[];
    };
    if (json?.success) {
      return { curve: json.curve ?? [], trend: json.trend ?? [] };
    }
  } catch {
    /* ignore — 回退本地缓存 */
  }
  return null;
}
