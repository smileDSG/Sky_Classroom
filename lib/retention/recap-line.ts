/**
 * 回访态话术拼装（T06 / PRD §6.1 + §6.2）。
 *
 * 职责：把 `RecapContext` 里的**真实数据**填进 `RECAP_COPY_TABLE` 的模板。
 *
 * 硬约束（与 recap-copy/recap-state 一致）：
 * - **纯函数、零 IO**：不 fetch、不读 localStorage、**不碰 `new Date()`**
 *   —— 日期一律取调用方传入的 `ctx.today` / `streak.lastActiveDate`，
 *   SSR 与客户端跑同一份逻辑，避免水合错配（PRD §5.1）。
 * - 取数失败就**降级**，绝不编造知识点、不写死数字（如把 76% 写进模板）。
 */

import type { RecapAction, RecapContext, RecapState } from './types';
import { pickWeakest } from './recall-hook';
import { diffLocalDays } from './date';
import {
  RECAP_GENERIC_LINE,
  RECAP_POINT_MAX_HAN,
  RECAP_S4_DATE_LINE,
  RECONSOLIDATE_THRESHOLD,
  clampToHan,
  getCopyEntry,
} from './recap-copy';

/** 话术里 『X』：完整名（记忆块用），话术里截断到 8 字。 */
const pointLabel = (name: string): string => clampToHan(name, RECAP_POINT_MAX_HAN);

/** 通用兜底入口，数据一条都没有时退到这里（PRD §5：无目标 → 通用入口）。 */
const GENERIC_ACTION_HREF = '/sky/learning/today';

/** 允许参与拼装的档位（'none' 是"今天已学"，没有回访话术）。 */
const BUILDABLE_STATES: RecapState[] = ['S-1', 'S-2', 'S-3', 'S-4'];

/** 简单模板填充：只替换本模块认识的变量，未知占位原样保留（便于单测发现拼错）。 */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (raw, key: string) => {
    const value = Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : raw;
    return value;
  });
}

/**
 * 距上次活跃的 gap（天）。
 * 取不到就返回 null —— 有状态的文案（S-2 里的"N 天"）宁可退化成无数字表述，
 * 也不用假数字。
 */
function resolveGap(ctx: RecapContext): number | null {
  const streak = ctx.streak;
  if (!streak || typeof streak.lastActiveDate !== 'string' || streak.lastActiveDate === '') return null;
  const today = ctx.today ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const gap = diffLocalDays(streak.lastActiveDate, today);
  return Number.isFinite(gap) ? gap : null;
}

/**
 * S-2 B1 的 gap 前缀。
 * gap === 1（或未知）一律用无数字表述，避免把"1 天"读成催促（PRD §6.2）。
 */
export function buildS2GapLabel(gap: number | null): string {
  return gap === null || gap <= 1 ? '昨天之后没再来，' : `${gap} 天没来，`;
}

/**
 * S-2 B2 的 gap 前缀：与 B1 同一口径（gap===1/未知 走无数字表述），
 * 差异只在于 gap>=2 时 B2 明确说"断了 N 天"。
 */
export function buildS2GapBreakLabel(gap: number | null): string {
  return gap === null || gap <= 1 ? '昨天之后没再来，' : `断了 ${gap} 天，`;
}

/**
 * 拼 A 那一行话术（PRD §4.2 A / §6.1）。
 *
 * @param ctx  真实数据
 * @param state 已判定的回访态
 * @returns 一行话术；`state === 'none'`（今天已学，非回访态）时返回 null
 */
export function buildRecapLine(ctx: RecapContext, state: RecapState): string | null {
  if (state === 'none') return null;
  if (BUILDABLE_STATES.indexOf(state) === -1) return null;

  const variant = ctx.recapCopyVariant ?? 'B1';
  const weakest = pickWeakest(ctx.weakPoints ?? []);
  const gap = resolveGap(ctx);
  const entry = getCopyEntry(state, variant);

  // 口径 b（PRD R-5 反模式保险）：记忆开关关掉时，A 退成通用句，
  // 但按钮 D 必须照常返回。'none' 已在第 80 行提前返回 null（今天已学，没话可说）。
  if (ctx.recapEnabled === false) {
    return RECAP_GENERIC_LINE;
  }

  switch (state) {
    case 'S-1': {
      // 没可渲染的知识点（weakPoints 有项但名字为空）→ 不编，退回通用句
      if (!weakest) return RECAP_GENERIC_LINE;
      const vars = { point: pointLabel(weakest.knowledgePoint) };
      // 已达巩固阈值：整句换陈述句，并填**真实** mastery（禁止写死 80/76）
      if (typeof weakest.mastery === 'number' && weakest.mastery >= RECONSOLIDATE_THRESHOLD) {
        const mastered = entry.masteredTemplate ?? entry.template;
        return fill(mastered, { ...vars, mastery: String(weakest.mastery) });
      }
      return fill(entry.template, vars);
    }
    case 'S-2': {
      if (variant === 'B2') {
        return fill(entry.template, { gapBreakLabel: buildS2GapBreakLabel(gap), gap: gap === null ? '' : String(gap) });
      }
      return fill(entry.template, { gapLabel: buildS2GapLabel(gap), gap: gap === null ? '' : String(gap) });
    }
    case 'S-3':
      return fill(entry.template, {});
    case 'S-4': {
      // 没有薄弱点就不外推知识点，只说**真实日期**（PRD §5：无 → 只说日期）
      if (!weakest) {
        return fill(RECAP_S4_DATE_LINE, { date: ctx.streak?.lastActiveDate ?? '' });
      }
      return fill(entry.template, { point: pointLabel(weakest.knowledgePoint) });
    }
    default:
      return RECAP_GENERIC_LINE;
  }
}

/**
 * 拼 C 那一行连续天数（PRD §4.2 C）。
 * S-4 用中性表述 `连续 N 天（峰值 M）`，**不强调断**；
 * streak 读不出来（null / 字段非数字）→ 整行不渲染，不造数。
 */
export function buildStreakLine(ctx: RecapContext, state: RecapState): string | null {
  const streak = ctx.streak;
  if (!streak) return null;
  const current = streak.currentStreak;
  const peak = streak.peakStreak;
  if (typeof current !== 'number' || !Number.isFinite(current) || current < 0) return null;
  const safePeak = typeof peak === 'number' && Number.isFinite(peak) ? peak : 0;

  if (state === 'S-4') {
    const base = `连续 ${current} 天`;
    return safePeak > current ? `${base}（峰值 ${safePeak}）` : base;
  }
  return `${current} 连续学习天`;
}

export interface RecapActionResult {
  action: RecapAction;
  /** 无补充小字时**不给这个 key**（PRD §4.2：禁止"有容器没内容"的占位） */
  actionHint?: string;
}

/**
 * 拼 D 主按钮（全首屏仅 1 个，PRD §4.2 D / §5）。
 *
 * 文案只由**真实到期复习条数**与最弱薄弱点决定，与档位无关：
 * - `due >= 1` → `复习这 N 道 →`（N 封顶 3，超出用 actionHint 说明）
 * - `due <= 0 或未知 且有知识点` → `再练一次『X』→`
 * - 都没有 → `开始 →`（首页通用入口）
 */
export function buildAction(ctx: RecapContext, state: RecapState): RecapActionResult {
  const weakest = pickWeakest(ctx.weakPoints ?? []);
  const href = weakest && typeof weakest.actionHref === 'string' && weakest.actionHref !== ''
    ? weakest.actionHref
    : GENERIC_ACTION_HREF;

  // 档位非法时退到通用入口（state 属于固定契约，这里只做防御）
  if (BUILDABLE_STATES.indexOf(state) === -1 && state !== 'none') {
    return { action: { label: '开始 →', href: GENERIC_ACTION_HREF } };
  }

  const due = ctx.dueMistakeCount;
  const dueCount = typeof due === 'number' && Number.isFinite(due) && due > 0 ? Math.floor(due) : 0;

  if (dueCount >= 1) {
    const shown = Math.min(3, dueCount);
    const hint = dueCount > 3 ? `还有 ${dueCount - 3} 道在错题本` : undefined;
    const result: RecapActionResult = { action: { label: `复习这 ${shown} 道 →`, href } };
    if (hint !== undefined) result.actionHint = hint;
    return result;
  }

  if (weakest) {
    return { action: { label: `再练一次『${pointLabel(weakest.knowledgePoint)}』→`, href } };
  }

  return { action: { label: '开始 →', href: GENERIC_ACTION_HREF } };
}
