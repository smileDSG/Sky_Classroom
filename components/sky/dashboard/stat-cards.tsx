'use client';

import Link from 'next/link';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useI18n } from '@/lib/hooks/use-i18n';

// ── Relative time helper ────────────────────────────────────────────

function formatRelativeTime(date: Date, t: (key: string, params?: Record<string, number>) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHour = Math.floor(diffMs / 1000 / 60 / 60);
  const diffDay = Math.floor(diffMs / 1000 / 60 / 60 / 24);

  if (diffMin < 1) return t('sky.dashboard.justNow');
  if (diffMin < 60) return t('sky.dashboard.minutesAgo', { n: diffMin });
  if (diffHour < 24) return t('sky.dashboard.hoursAgo', { n: diffHour });
  if (diffDay < 30) return t('sky.dashboard.daysAgo', { n: diffDay });
  return t('sky.dashboard.monthsAgo', { n: Math.floor(diffDay / 30) });
}

// ── Helper: is today ────────────────────────────────────────────────

function isToday(date: Date): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

// ── StatCards ───────────────────────────────────────────────────────

interface StatCardsProps {
  mistakes: MistakeRecord[];
}

export function StatCards({ mistakes }: StatCardsProps) {
  const { t } = useI18n();
  const _store = useSkyClassroomStore();

  const todayCount = mistakes.filter((m) => isToday(m.solvedAt)).length;
  const toReviewCount = mistakes.filter((m) => !m.reviewed).length;
  const reviewedCount = mistakes.filter((m) => m.reviewed).length;
  const masteryPercent =
    mistakes.length > 0
      ? Math.round((reviewedCount / mistakes.length) * 100)
      : 0;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-[#4A90D9]">{todayCount}</div>
        <div className="text-sm text-gray-500">{t('sky.dashboard.totalMistakes')}</div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-[#F59E0B]">{toReviewCount}</div>
        <div className="text-sm text-gray-500">{t('sky.dashboard.reviewedRate')}</div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-[#10B981]">{masteryPercent}%</div>
        <div className="text-sm text-gray-500">{t('sky.dashboard.reviewProgress')}</div>
      </div>
    </div>
  );
}

// ── QuickActions ────────────────────────────────────────────────────

interface QuickAction {
  icon: string;
  label: string;
  href: string;
}

export function QuickActions() {
  const { t } = useI18n();

  const actions: QuickAction[] = [
    { icon: '📷', label: t('sky.dashboard.photoSolve'), href: '/sky/solve' },
    { icon: '📖', label: t('sky.dashboard.slideLecture'), href: '/sky/slides' },
    { icon: '📊', label: t('sky.dashboard.learningData'), href: '/sky/learning' },
    { icon: '💡', label: t('sky.dashboard.aiAssistant'), href: '/sky/assistant' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="rounded-lg border-2 border-transparent bg-white p-4 shadow-sm transition-colors hover:border-[#4A90D9]"
        >
          <div className="text-center">
            <div className="text-2xl">{action.icon}</div>
            <div className="mt-1 text-sm font-medium text-gray-700">
              {action.label}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── ActivityTimeline ────────────────────────────────────────────────

interface ActivityTimelineProps {
  mistakes: MistakeRecord[];
}

export function ActivityTimeline({ mistakes }: ActivityTimelineProps) {
  const { t } = useI18n();
  const recentMistakes = [...mistakes]
    .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime())
    .slice(0, 5);

  if (recentMistakes.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm text-center">
        <p className="text-gray-400">
          还没有学习活动，去搜题页开始练习吧！
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">最近活动</h3>
      <ul className="space-y-3">
        {recentMistakes.map((m) => (
          <li key={m.id} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 shrink-0 text-gray-400">
              {formatRelativeTime(m.solvedAt, t)}
            </span>
            <span className="flex-1 truncate text-gray-700">
              {m.problem.length > 60
                ? m.problem.slice(0, 60) + '...'
                : m.problem}
            </span>
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {t(`sky.errorCause.${m.cause}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
