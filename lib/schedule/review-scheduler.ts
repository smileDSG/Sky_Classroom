/**
 * O-006 — Ebbinghaus review scheduler.
 *
 * Builds personalised review plans from MistakeBookEntry[] data.
 * Pure functions — callers provide data, no I/O.
 */
import { EBBINGHAUS_INTERVALS, type MistakeBookEntry } from '@/lib/storage/dao/mistakes';

export interface DailyReviewPlan {
  date: string;
  dayLabel: string;
  items: MistakeBookEntry[];
  count: number;
}

export interface ReviewSchedule {
  today: DailyReviewPlan | null;
  upcoming: DailyReviewPlan[];
  overdue: number;
  completed: number;
  total: number;
}

/** Build a full review schedule from mistake entries */
export function buildReviewSchedule(mistakes: MistakeBookEntry[]): ReviewSchedule {
  const now = Date.now();
  const dueItems = mistakes.filter(
    (m) => !m.reviewed && m.nextReview !== undefined && m.nextReview <= now,
  );
  const overdue = dueItems.filter((m) => {
    const nr = m.nextReview ?? 0;
    // New mistakes (nextReview=0) are due now but not overdue
    return nr > 0 && nr < now - 24 * 60 * 60 * 1000;
  }).length;

  const upcomingMap = new Map<string, MistakeBookEntry[]>();

  for (const m of mistakes) {
    if (m.reviewed || !m.nextReview || m.nextReview <= now) continue;
    const date = new Date(m.nextReview).toISOString().slice(0, 10);
    if (!upcomingMap.has(date)) upcomingMap.set(date, []);
    upcomingMap.get(date)!.push(m);
  }

  const upcoming: DailyReviewPlan[] = [...upcomingMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)
    .map(([date, items]) => ({
      date,
      dayLabel: formatDayLabel(date),
      items,
      count: items.length,
    }));

  const today: DailyReviewPlan | null = dueItems.length > 0
    ? { date: new Date().toISOString().slice(0, 10), dayLabel: '今天', items: dueItems, count: dueItems.length }
    : null;

  const completed = mistakes.filter((m) => m.reviewed).length;

  return { today, upcoming, overdue, completed, total: mistakes.length };
}

/** Get items due for review today */
export function getTodayMistakes(mistakes: MistakeBookEntry[]): MistakeBookEntry[] {
  const now = Date.now();
  return mistakes
    .filter((m) => !m.reviewed && m.nextReview !== undefined && m.nextReview <= now)
    .sort((a, b) => (a.nextReview ?? 0) - (b.nextReview ?? 0));
}

/** Range of days until next review for each item */
export function getDaysUntilReview(mistake: MistakeBookEntry): number | null {
  if (mistake.reviewed || !mistake.nextReview) return null;
  const now = Date.now();
  return Math.max(0, Math.ceil((mistake.nextReview - now) / (24 * 60 * 60 * 1000)));
}

/** Mastery progress summary */
export interface MasteryProgress {
  level: number;
  label: string;
  reviewedCount: number;
  masteredCount: number;
  totalCount: number;
  percentComplete: number;
  /** Total rounds completed across all items (each capped at EBBINGHAUS_INTERVALS.length) */
  completedRounds: number;
  /** Total rounds needed for all items to be fully mastered */
  totalRounds: number;
}

export function getMasteryProgress(mistakes: MistakeBookEntry[]): MasteryProgress {
  const totalCount = mistakes.length;
  const masteredCount = mistakes.filter((m) => m.reviewed).length;
  const reviewedCount = mistakes.filter((m) => m.reviewCount > 0).length;
  const maxRounds = EBBINGHAUS_INTERVALS.length;

  // Sum up completed rounds per item (capped at maxRounds)
  const completedRounds = mistakes.reduce(
    (sum, m) => sum + Math.min(m.reviewCount, maxRounds),
    0,
  );
  const totalRounds = totalCount * maxRounds;
  const percentComplete = totalRounds > 0 ? Math.round((completedRounds / totalRounds) * 100) : 100;

  let label: string;
  if (totalCount === 0) label = '还没有错题记录。';
  else if (percentComplete >= 80) label = '掌握良好，继续保持！';
  else if (percentComplete >= 50) label = '稳步推进中，还需坚持复习。';
  else label = '刚开始复习，加油！';

  return {
    level: masteredCount,
    label,
    reviewedCount,
    masteredCount,
    totalCount,
    percentComplete,
    completedRounds,
    totalRounds,
  };
}

/** Get the most urgent N items due for review */
export function getUrgentItems(mistakes: MistakeBookEntry[], limit = 5): MistakeBookEntry[] {
  return getTodayMistakes(mistakes).slice(0, limit);
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return '今天';
  if (dateStr === tomorrow) return '明天';
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const d = new Date(dateStr);
  return dayNames[d.getDay()];
}
