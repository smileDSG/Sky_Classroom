/**
 * Daily Review Path
 *
 * Builds a structured day-by-day review plan from mistake entries,
 * using priority scoring, daily caps, and weak-point awareness.
 */

import { EBBINGHAUS_INTERVALS } from '@/lib/storage/dao/mistakes';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { StudentProfile } from '@/lib/student/profile-types';

// ── Config ──────────────────────────────────────────────────────────

export interface DailyReviewPathConfig {
  /** Max reviews per day (default: 15) */
  maxDailyReviews: number;
  /** Overdue surcharge per day overdue (default: 10) */
  overdueWeight: number;
  /** Weak point bonus (default: 30) */
  weakPointWeight: number;
  /** Low-mastery bonus — applied to items with masteryLevel <= this (default: 2) */
  masteryThreshold: number;
  /** Extra score for items below masteryThreshold (default: 20) */
  masteryWeight: number;
  /** Frequent error pattern bonus (default: 10) */
  errorPatternWeight: number;
  /** Recent-review penalty applied if lastReview < 24h ago (default: -5) */
  recencyPenalty: number;
  /** Number of days to project forward (default: 7) */
  projectionDays: number;
}

const DEFAULT_CONFIG: DailyReviewPathConfig = {
  maxDailyReviews: 15,
  overdueWeight: 10,
  weakPointWeight: 30,
  masteryThreshold: 2,
  masteryWeight: 20,
  errorPatternWeight: 10,
  recencyPenalty: -5,
  projectionDays: 7,
};

// ── Types ───────────────────────────────────────────────────────────

export interface ReviewPathItem {
  mistakeId: string;
  problem: string;
  knowledgePoints: string[];
  priorityScore: number;
  /** Positive = overdue, zero = due today, negative = upcoming */
  dueDays: number;
  /** Current Ebbinghaus round (1-based, 6 = mastered) */
  reviewRound: number;
  masteryLevel: number;
  weakPoint: boolean;
}

export interface DailyPathDay {
  date: string;
  dayLabel: string;
  items: ReviewPathItem[];
  count: number;
  estimatedMinutes: number;
}

export interface DailyReviewPath {
  today: DailyPathDay;
  upcoming: DailyPathDay[];
  summary: {
    totalDue: number;
    totalScheduled: number;
    estimatedMinutes: number;
    overdueCount: number;
    weakPointItems: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayLabel(dateStr: string, now: Date): string {
  const today = formatDate(now.getTime());
  if (dateStr === today) return '今天';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === formatDate(tomorrow.getTime())) return '明天';
  const d = new Date(dateStr);
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return dayNames[d.getDay()];
}

function daysUntil(targetTs: number, now: number): number {
  const target = new Date(targetTs);
  target.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// ── Scoring ─────────────────────────────────────────────────────────

function scoreItem(
  entry: MistakeBookEntry,
  weakPoints: Set<string>,
  errorPatternKps: Set<string>,
  now: number,
  config: DailyReviewPathConfig,
): number {
  let score = 0;

  // 1. Overdue severity
  const due = daysUntil(entry.nextReview ?? now, now);
  if (due < 0) {
    score += Math.min(Math.abs(due) * config.overdueWeight, 50);
  }

  // 2. Weak point relevance
  const isWeak = entry.knowledgePoints.some((kp) => weakPoints.has(kp));
  if (isWeak) score += config.weakPointWeight;

  // 3. Low mastery
  if (entry.masteryLevel <= config.masteryThreshold) {
    score += config.masteryWeight;
  }

  // 4. Frequent error pattern
  if (entry.knowledgePoints.some((kp) => errorPatternKps.has(kp))) {
    score += config.errorPatternWeight;
  }

  // 5. Recency penalty — avoid cramming
  if (entry.lastReview && now - entry.lastReview < 86400000) {
    score += config.recencyPenalty;
  }

  return Math.max(score, 0);
}

function toReviewPathItem(
  entry: MistakeBookEntry,
  score: number,
  weakPoints: Set<string>,
  now: number,
): ReviewPathItem {
  const due = daysUntil(entry.nextReview ?? now, now);
  return {
    mistakeId: entry.id,
    problem: entry.problemText,
    knowledgePoints: entry.knowledgePoints,
    priorityScore: score,
    dueDays: due,
    reviewRound: Math.min(entry.reviewCount + 1, EBBINGHAUS_INTERVALS.length),
    masteryLevel: entry.masteryLevel,
    weakPoint: entry.knowledgePoints.some((kp) => weakPoints.has(kp)),
  };
}

// ── Main builder ────────────────────────────────────────────────────

export function buildDailyReviewPath(
  entries: MistakeBookEntry[],
  profile?: StudentProfile | null,
  config?: Partial<DailyReviewPathConfig>,
): DailyReviewPath {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  // Build weak-point and error-pattern sets
  const weakPoints = new Set(profile?.weakPoints ?? []);
  const errorPatternKps = new Set(
    (profile?.errorPatterns ?? []).filter((ep) => ep.frequency >= 2).map((ep) => ep.knowledgePoint),
  );

  // Filter not-reviewed items with a nextReview set
  const dueItems = entries.filter((e) => !e.reviewed && e.nextReview != null);

  // Score & sort
  const scored = dueItems.map((entry) => ({
    entry,
    score: scoreItem(entry, weakPoints, errorPatternKps, now, cfg),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Group by date bucket
  const todayStr = formatDate(now);
  const buckets = new Map<string, ReviewPathItem[]>();

  for (const { entry, score } of scored) {
    const item = toReviewPathItem(entry, score, weakPoints, now);
    const due = daysUntil(entry.nextReview ?? now, now);

    let bucketDate: string;
    if (due <= 0) {
      bucketDate = todayStr;
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() + due);
      bucketDate = formatDate(d.getTime());
    }

    const existing = buckets.get(bucketDate) ?? [];
    existing.push(item);
    buckets.set(bucketDate, existing);
  }

  // Sort items within each bucket by score descending
  for (const [, items] of buckets) {
    items.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // Build today (capped)
  const todayItems = (buckets.get(todayStr) ?? []).slice(0, cfg.maxDailyReviews);

  // Build upcoming days
  const upcoming: DailyPathDay[] = [];
  let overflow: ReviewPathItem[] = [];

  // If today had more items than the cap, overflow them
  const allToday = buckets.get(todayStr) ?? [];
  if (allToday.length > cfg.maxDailyReviews) {
    overflow = allToday.slice(cfg.maxDailyReviews);
  }

  for (let i = 1; i <= cfg.projectionDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d.getTime());

    const dayItems = buckets.get(dateStr) ?? [];
    const cap = cfg.maxDailyReviews;

    // Merge overflow into this day first
    const merged = [...overflow, ...dayItems];
    merged.sort((a, b) => b.priorityScore - a.priorityScore);

    const taken = merged.slice(0, cap);
    overflow = merged.slice(cap);

    upcoming.push({
      date: dateStr,
      dayLabel: dayLabel(dateStr, new Date(now)),
      items: taken,
      count: taken.length,
      estimatedMinutes: taken.length * 3,
    });
  }

  // Summary
  const totalDue = dueItems.filter((e) => daysUntil(e.nextReview!, now) <= 0).length;
  const totalScheduled = todayItems.length;
  const weakPointItems = todayItems.filter((i) => i.weakPoint).length;
  const overdueCount = dueItems.filter((e) => daysUntil(e.nextReview!, now) < 0).length;

  return {
    today: {
      date: todayStr,
      dayLabel: '今天',
      items: todayItems,
      count: todayItems.length,
      estimatedMinutes: todayItems.length * 3,
    },
    upcoming,
    summary: {
      totalDue,
      totalScheduled,
      estimatedMinutes: todayItems.length * 3,
      overdueCount,
      weakPointItems,
    },
  };
}
