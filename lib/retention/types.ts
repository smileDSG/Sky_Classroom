/**
 * 留存模块共享类型（P0：T01）。
 *
 * 严格依据 docs/sky-retention-arch.md §3。所有"日"字段均为本地时区 YYYY-MM-DD。
 */

import type { WeakPointSummary } from '@/lib/cloud-mind/types';

// ── 连续天数状态机（§3.1） ───────────────────────────────────────────

export type StreakStatus = 'inactive' | 'active' | 'broken' | 'at-risk' | 'peak';

export interface StreakState {
  /** 当前连续天数 */
  currentStreak: number;
  /** 历史峰值（中断保留） */
  peakStreak: number;
  /** 最近一次活跃日期 YYYY-MM-DD；从未活跃则为 '' */
  lastActiveDate: string;
  status: StreakStatus;
}

// ── 情感记忆（§3.2，向后兼容既有 5 类） ─────────────────────────────

export type EmotionLabel = 'frustrated' | 'excited' | 'confused' | 'confident';

export interface EmotionMemory {
  label: EmotionLabel;
  /** -1..1 效价 */
  valence: number;
  /** 0..1 唤醒度 */
  arousal: number;
  /** 关联知识点（用于"记得你"） */
  knowledgePoint?: string;
}

// ── 成长可见数据（§3.4） ─────────────────────────────────────────────

export interface GrowthSnapshot {
  /** YYYY-MM-DD */
  date: string;
  /** 来自 getMasterySummary(graph).overallMastery，0-100 */
  masteryPercent: number;
  /** mistakes.length（真实错题总数） */
  mistakeTotal: number;
  /** reviewed === true 的数量（已攻克） */
  reviewedCount: number;
  /** graph.weakPoints.length */
  weakCount: number;
}

export interface MistakeTrendPoint {
  date: string;
  total: number;
  resolved: number;
}

// ── 今日任务 + 悬念（§3.3，T05 复用，此处先定义） ───────────────────

export interface TodayMissionWithSuspense {
  title: string;
  detail: string;
  href: string;
  sourceLabel: string;
  durationLabel: string;
  reason: string;
  successCriteria: string[];
  state: 'ready' | 'completed' | 'buffer-day' | 'starter';
  /** 未掌握点小悬念，如"昨天那道函数题，今天换个角度试试？" */
  suspense?: string;
}

// ── 3D 难点标签（§3.5，P2 预留类型，不实现判定） ───────────────────

export interface DifficultyTag {
  chapterId: string;
  /** 标签文案，如『听不懂高发』 */
  label: string;
  reason: string;
}

// ── 召回决策（§3.3，T05 复用） ──────────────────────────────────────

/**
 * 召回原因。
 * - `due`：该回来接着学了（决定发提醒）
 * - 其余均为「不打扰」的原因，由 describeRecall 翻译成人话副文案
 */
export type RecallReason = 'active-today' | 'disabled' | 'sent-today' | 'auto-silenced' | 'due';

export interface RecallDecision {
  shouldSend: boolean;
  reason: RecallReason;
  nextSendAt?: number;
}

// ── 回访态首屏（§4，T06） ────────────────────────────────────────────

/**
 * 回访状态。
 * - `S-1` 昨日接续（昨天来过 + 有真实薄弱点）
 * - `S-2` 短期回落（空档 1~2 天，未被自动静默）
 * - `S-3` 首次 / 无历史（兜底）
 * - `S-4` 静默回流（空档 ≥3 天且已自动静默，只给一句最轻的"上次学到这"）
 * - `none` 今天已学 —— **非回访态**。此时 line 为 null（不能谎称"昨天你补上了"），
 *   但记忆块 / 连续天数 / 主按钮照常给真实数据。
 */
export type RecapState = 'S-1' | 'S-2' | 'S-3' | 'S-4' | 'none';

export type RecapCopyVariant = 'B1' | 'B2';

export interface RecapContext {
  streak: StreakState | null;
  weakPoints: WeakPointSummary[] | null;
  /** dueReviews 中 kind === 'mistake' 的真实到期条数；-1 或 null 表示未知 */
  dueMistakeCount?: number | null;
  /** 本地时区今天；缺省内部用 toLocalDateStr() */
  today?: string;
  /**
   * 记忆开关：false 时 A 退成通用句、B 整块不渲染。
   * ⚠️ **绝不能连带把按钮 D 也关掉**，那会踩 PRD R-5（减法减过头找不到入口）。
   */
  recapEnabled?: boolean;
  /** 话术灰度位，缺省 'B1' */
  recapCopyVariant?: RecapCopyVariant;
}

export interface RecapMemoryCard {
  /** 完整知识点名（不在话术里截断） */
  knowledgePoint: string;
  /** 该知识点自身的掌握度 0-100；不可读时为 null → 数字不渲染 */
  mastery: number | null;
  /** 近期错题计数；null 或 0 → 不输出这一段 */
  recentMistakeCount: number | null;
  actionHref: string;
}

export interface RecapAction {
  label: string;
  href: string;
}

export interface RecapView {
  state: RecapState;
  /** 字段缺失 / 读取失败 / 时区错配时为 true → 一律降级 S-3，不抛错、不报错误码 */
  degraded: boolean;
  /** 一行话术（A）；'none' 状态下为 null */
  line: string | null;
  /** 记忆块数据（B）；仅 S-1/S-2 且开启记忆时非 null */
  memoryCard: RecapMemoryCard | null;
  /** 连续天数一行（C）；读不出来为 null → 整行不渲染 */
  streakLine: string | null;
  /** 全首屏唯一主按钮（D）；永远不为 null（关掉记忆也要留入口） */
  action: RecapAction | null;
  /** 主按钮的补充小字，如"还有 2 道在错题本" */
  actionHint?: string;
}

