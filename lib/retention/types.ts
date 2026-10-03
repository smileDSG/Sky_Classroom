/**
 * 留存模块共享类型（P0：T01）。
 *
 * 严格依据 docs/sky-retention-arch.md §3。所有"日"字段均为本地时区 YYYY-MM-DD。
 */

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
