/**
 * 召回钩子 · 决策逻辑（T05 / FR-12）。
 *
 * 职责：判断「今天要不要提醒用户回来学习」，以及提醒里带什么悬念。
 *
 * 克制原则（PRD R-3 / FR-12）：
 * - 最多 **每日 1 次**，绝不做红点轰炸
 * - 连续 N 日未打开 → **自动静默**（越是不来越不打扰，而不是变本加厉）
 * - 悬念必须来自**真实未掌握点**，禁止编造
 *
 * 纯函数，无副作用，便于单测。
 */

import type { StreakState, RecallDecision, RecallReason } from './types';
import type { WeakPointSummary } from '@/lib/cloud-mind/types';

/** 用户可设置的偏好（存RetentionSlice，这里只做纯逻辑判断）。 */
export interface RecallPreferences {
  /** 总开关：用户是否接受主动提醒。 */
  enabled: boolean;
  /** 上次提醒的本地日期 YYYY-MM-DD；空=从未提醒。 */
  lastNotifiedDate: string;
}

/** 静默阈值：连续这么多天没来，就不再主动打扰。 */
export const AUTO_SILENCE_DAYS = 3;

/**
 * 决定今天是否发送召回提醒。
 *
 * @param streak     连续天数状态（判断今天是否已学、断了几天）
 * @param prefs      用户偏好
 * @param today      今天的本地日期 YYYY-MM-DD
 */
export function evaluateRecall(
  streak: StreakState,
  prefs: RecallPreferences,
  today: string,
): RecallDecision {
  // 1. 用户关了 → 不打扰
  if (!prefs.enabled) {
    return { shouldSend: false, reason: 'disabled' };
  }

  // 2. 今天已经学过 → 无需召回（这是最好的状态，不要去戳用户）
  if (isActiveToday(streak, today)) {
    return { shouldSend: false, reason: 'active-today' };
  }

  // 3. 今天已经提醒过 → 每日至多 1 次
  if (prefs.lastNotifiedDate === today) {
    return { shouldSend: false, reason: 'sent-today' };
  }

  // 4. 连续多日未打开 → 自动静默（越不来越不打扰）
  if (isAutoSilenced(streak, today)) {
    return { shouldSend: false, reason: 'auto-silenced' };
  }

  // 5. 可以提醒（reason 必须是 'due'：只有"该回来接着学了"才配得上正面文案，
  //    复用 'active-today' 会让卡片自相矛盾——见 describeRecall）
  return { shouldSend: true, reason: 'due' };
}

/** 今天是否已学（lastActiveDate === today）。 */
export function isActiveToday(streak: StreakState, today: string): boolean {
  return streak.lastActiveDate === today;
}

/**
 * 是否该自动静默。
 * 依据 lastActiveDate 距今天的天数：断得越久越不再主动打扰。
 * 注意用 lastActiveDate 而非 currentStreak —— 中断后 currentStreak 归 0，
 * 但"上次来是什么时候"才是判断打扰价值的依据。
 */
export function isAutoSilenced(streak: StreakState, today: string): boolean {
  if (!streak.lastActiveDate) return true; // 从未学习过 → 不做拉新式打扰
  const gap = daysBetween(streak.lastActiveDate, today);
  return gap >= AUTO_SILENCE_DAYS;
}

/** 本地日期差（b - a，单位天）。 */
export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00`);
  const db = Date.parse(`${b}T00:00:00`);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / 86400000);
}

// ── 悬念生成（FR-11） ──────────────────────────────────────────────

/**
 * 基于**真实未掌握点**生成一句悬念钩子。
 * 没有真实薄弱点时返回 undefined —— 宁可没有悬念，也不编造。
 */
export function buildSuspense(weakPoints: WeakPointSummary[]): string | undefined {
  const target = pickWeakest(weakPoints);
  if (!target) return undefined;
  const name = target.knowledgePoint;
  // 按掌握度选措辞：越低越强调"换个角度"，不夸大也不贬低
  if (target.mastery <= 40) {
    return `${name}这块上次卡住了，今天换个角度再试一次？`;
  }
  if (target.mastery <= 70) {
    return `${name}再练两道就能稳住了，今天补一下？`;
  }
  return `${name}快熟了，今天顺手复习一下？`;
}

/** 选最需要关注的薄弱点：掌握度最低；并列时取最近错题更多的。 */
export function pickWeakest(weakPoints: WeakPointSummary[]): WeakPointSummary | null {
  if (!Array.isArray(weakPoints) || weakPoints.length === 0) return null;
  const valid = weakPoints.filter((w) => w && typeof w.knowledgePoint === 'string' && w.knowledgePoint.trim() !== '');
  if (valid.length === 0) return null;
  return valid.reduce((worst, cur) => {
    if (cur.mastery < worst.mastery) return cur;
    if (cur.mastery === worst.mastery && cur.recentMistakeCount > worst.recentMistakeCount) return cur;
    return worst;
  });
}

/** 供UI 展示：为什么这次会/不会提醒。 */
export function describeRecall(reason: RecallReason): string {
  switch (reason) {
    case 'active-today':
      return '今天已经学过了';
    case 'disabled':
      return '你已关闭主动提醒';
    case 'sent-today':
      return '今天已经提醒过';
    case 'auto-silenced':
      return '好几天没来了，先不打扰';
    case 'due':
      // 唯一一条「会真的弹卡片」的文案：陈述"我们在这等你"，不用祈使句、不带催促，
      // 与上面几条同样保持"克制"（PRD R-3：产品目标是教育，不是施加压力）。
      return '等你回来接着学';
  }
}
