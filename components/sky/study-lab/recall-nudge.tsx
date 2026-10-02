/**
 * 召回提示 · 客户端（T05 / FR-12）。
 *
 * 职责：进站时问一次服务端"今天该不该提醒"，若该提醒则展示一条轻提示。
 * 刻意做得轻：一条细条 + 一个按钮，不做弹窗、不做红点、不做全屏。
 *
 * 「今天是否已提醒过」记在 localStorage（服务端保持无状态）。
 * ⚠️ 只依赖 fetch，不含服务端依赖（见 streak-client.ts 的同类说明）。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { buildSuspense } from '@/lib/retention/recall-hook';
import type { StreakState, RecallDecision } from '@/lib/retention/types';
import type { WeakPointSummary } from '@/lib/cloud-mind/types';

const LAST_NOTIFIED_KEY = 'sky-recall-last-notified';
/** 提示自动消失时间：足够读完，不至于变成干扰。 */
const AUTO_HIDE_MS = 12000;

export interface RecallState {
  decision: RecallDecision;
  reasonText: string;
  streak: StreakState;
  today: string;
}

function readLastNotified(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(LAST_NOTIFIED_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLastNotified(date: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_NOTIFIED_KEY, date);
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
}

/** 组件卸载时主动关闭（用户点关闭按钮）。 */
export function RecallNudge({
  weakPoints = [],
  enabled = true,
}: {
  /** 真实薄弱点，用于生成悬念；没有就不显示悬念部分 */
  weakPoints?: WeakPointSummary[];
  /** 用户是否开启主动提醒 */
  enabled?: boolean;
}) {
  const [state, setState] = useState<RecallState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);
  // StrictMode 下 effect 会双跑：第一次跑完就把「今天已提醒」写进了 localStorage，
  // 第二次跑读到今天 → 判sent-today → 什么都不显示。
  // 用 ref 记住「本次挂载已消费过」，保证无论跑几次都只消费一次、且沿用同一次的结果。
  const consumedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (consumedRef.current) return;
    consumedRef.current = true;

    (async () => {
      try {
        const params = new URLSearchParams({
          enabled: String(enabled),
          lastNotifiedDate: readLastNotified(),
        });
        const res = await fetch(`/api/sky/recall?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const json = (await res.json()) as RecallState & { success?: boolean };
        if (cancelled || !json?.success || !json.decision) return;
        if (!json.decision.shouldSend) return;

        setState(json);
        setShow(true);
        // 记为"今天已提醒"，保证每日至多 1 次
        writeLastNotified(json.today);
      } catch {
        /* 网络失败就不打扰用户 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // 自动消失（独立 effect，卸载时能正确清理）
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [show]);

  if (!state || !show || dismissed) return null;

  const suspense = buildSuspense(weakPoints);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm dark:border-sky-200/20 dark:bg-sky-300/10"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
      <div className="min-w-0 flex-1">
        <p className="leading-6 text-slate-700 dark:text-slate-100">
          {suspense ?? '今天还没开始学习，从一道错题或一节新课开始就挺好。'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {state.reasonText}
        </p>
      </div>
      <button
        type="button"
        aria-label="关闭提醒"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
