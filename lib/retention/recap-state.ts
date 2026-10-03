/**
 * 回访态判定层（T06 / PRD §4.1 + §7.3）。
 *
 * 唯一入口 `resolveRecapState(ctx)`：输入真实数据，输出 T07 可直接渲染的 `RecapView`。
 *
 * 硬约束：
 * - **纯函数、零 IO**：不 fetch、不读 localStorage、**不碰 `new Date()`**。
 *   也因此 `ctx.today` 缺省时**视为数据缺失**（降级 S-3）而不是"偷偷读系统时钟"；
 *   今天由调用方（T07 / 服务端组件）用 `toLocalDateStr()` 注入，SSR 与客户端才不会错配。
 * - **不抛错**：任何字段缺失/读取失败/时区错配 → 一律降级 S-3 并打 `degraded:true`（PRD §4.1 统一降级规则）。
 * - **不编造**：宁可少一句话、少一个数字，也不插值、不写死。
 *
 * 判定顺序本身是规格（PRD §4.1），不可调换。
 */

import type {
  RecapContext,
  RecapMemoryCard,
  RecapState,
  RecapView,
  StreakState,
} from './types';
import type { WeakPointSummary } from '@/lib/cloud-mind/types';
import { isAutoSilenced, pickWeakest } from './recall-hook';
import { diffLocalDays } from './date';
import { buildAction, buildRecapLine, buildStreakLine } from './recap-line';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 本地时区 `YYYY-MM-DD` 校验：正则 + 真实日历天数，不依赖任何系统时钟。
 * 注意 `''` 不在这里判合法 —— 它由调用方按"从未活跃"单独处理（见 resolveRecapState）。
 */
export function isLocalDateStr(value: string): boolean {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // 排除 2025-02-30 这种
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= (month === 2 && isLeapYear(year) ? 29 : dim);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 有可渲染的薄弱点（pickWeakest 会过滤空名条目，比 length > 0 更严）。 */
function hasRenderableWeakPoint(weakPoints: WeakPointSummary[] | null | undefined): boolean {
  return pickWeakest(weakPoints ?? []) !== null;
}

function buildMemoryCard(weakest: WeakPointSummary): RecapMemoryCard {
  const mastery =
    typeof weakest.mastery === 'number' && Number.isFinite(weakest.mastery)
      ? weakest.mastery
      : null;
  const recentMistakeCount =
    typeof weakest.recentMistakeCount === 'number' &&
    Number.isFinite(weakest.recentMistakeCount) &&
    weakest.recentMistakeCount > 0
      ? weakest.recentMistakeCount
      : null; // null 与 0 同义：UI 不输出「连错 0 次」这种废话（PRD §5）
  return {
    knowledgePoint: weakest.knowledgePoint,
    mastery,
    recentMistakeCount,
    actionHref: weakest.actionHref,
  };
}

function isValidStreak(streak: StreakState | null | undefined): boolean {
  if (!streak || typeof streak !== 'object') return false;
  const ok =
    typeof streak.currentStreak === 'number' &&
    Number.isFinite(streak.currentStreak) &&
    typeof streak.peakStreak === 'number' &&
    Number.isFinite(streak.peakStreak) &&
    typeof streak.lastActiveDate === 'string';
  if (!ok) return false;
  // '' 是"从未活跃"的合法哨兵值，不是读取失败，不算 degraded
  return streak.lastActiveDate === '' || isLocalDateStr(streak.lastActiveDate);
}

/**
 * 判定首屏回访态并拼出完整视图（PRD §4.1 判定表，顺序不可调换）。
 *
 * 1. `streak` 为 null / `lastActiveDate` 非法 / `today` 非法 → degraded + 兜底 S-3
 * 2. `lastActiveDate === today`（今天已学）→ `'none'`，**非回访态**，line 恒为 null
 * 3. `lastActiveDate === ''`（从未活跃）→ S-3
 * 4. `gap < 0`（未来日期 / 时区错配）→ degraded + 兜底 S-3
 * 5. `gap === 1` 且有薄弱点 → S-1 昨日接续
 * 6. `gap >= 3` 且被自动静默 → S-4 静默回流（不进记忆块）
 * 7. `gap === 1 | 2` 且未被自动静默 → S-2 短期回落
 * 8. `weakPoints.length === 0` → S-3（有历史但无薄弱点，如只听课没做题）
 * 9. 兜底 → S-3（degraded 按第 1/4 步累积的原样带出）
 *
 * @param ctx 真实数据（today 必填；缺省按数据缺失降级）
 */
export function resolveRecapState(ctx: RecapContext): RecapView {
  const today = typeof ctx.today === 'string' ? ctx.today : '';
  let degraded = false;

  const streakOk = isValidStreak(ctx.streak);
  const todayOk = isLocalDateStr(today);
  if (!streakOk || !todayOk) {
    degraded = true;
  }
  const streak: StreakState | null = streakOk ? (ctx.streak as StreakState) : null;
  const lastActiveDate = streak ? streak.lastActiveDate : '';

  let state: RecapState = 'S-3';
  if (!streakOk || !todayOk) {
    state = 'S-3'; // 第 1 步
  } else if (lastActiveDate === today) {
    state = 'none'; // 第 2 步：今天已学，不是回访态
  } else if (lastActiveDate === '') {
    state = 'S-3'; // 第 3 步：从未活跃
  } else {
    const gap = diffLocalDays(lastActiveDate, today);
    if (!Number.isFinite(gap) || gap < 0) {
      // 第 4 步：未来日期 / 时区错配
      degraded = true;
      state = 'S-3';
    } else if (gap === 1 && hasRenderableWeakPoint(ctx.weakPoints)) {
      state = 'S-1'; // 第 5 步
    } else if (gap >= 3 && isAutoSilenced(streak as StreakState, today)) {
      state = 'S-4'; // 第 6 步：静默回流，不进记忆块
    } else if ((gap === 1 || gap === 2) && !isAutoSilenced(streak as StreakState, today)) {
      state = 'S-2'; // 第 7 步
    } else if (!hasRenderableWeakPoint(ctx.weakPoints)) {
      state = 'S-3'; // 第 8 步
    } else {
      state = 'S-3'; // 第 9 步：兜底
    }
  }

  const weakest = pickWeakest(ctx.weakPoints ?? []);
  const recapEnabled = ctx.recapEnabled !== false; // 记忆开关缺省视为开启

  // 口径 a（非回访态口径）：state === 'none' 时 line 恒为 null —— 不能谎称"昨天你补上了"。
  // 但记忆卡、连续天数、按钮照常给（今天学完了，还能回看卡在哪）。
  const line = buildRecapLine(ctx, state);

  // 口径 b（PRD R-5 反模式保险）：记忆开关关掉 → 记忆块不渲染、A 退成通用句，
  // 但**按钮 D 必须照常返回**。口径 c：degraded 时不编文案，如实落到 S-3 并带出标记。
  const memoryCard =
    state !== 'S-4' && state !== 'S-3' && recapEnabled && weakest !== null
      ? buildMemoryCard(weakest)
      : null;

  const streakLine = buildStreakLine(ctx, state);
  const { action, actionHint } = buildAction(ctx, state);

  const view: RecapView = {
    state,
    degraded,
    line,
    memoryCard,
    streakLine,
    action,
  };
  // 只在真有补充小字时挂这个字段，避免"有容器没内容"（PRD §5.1 零占位）
  if (actionHint !== undefined) view.actionHint = actionHint;
  return view;
}
