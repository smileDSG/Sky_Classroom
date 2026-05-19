'use client';

import Link from 'next/link';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

// ── Cause label map ─────────────────────────────────────────────────

const causeLabels: Record<string, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  'misreading': '审题错误',
  'method-wrong': '方法错误',
  'careless': '粗心',
  'format-error': '格式错误',
};

// ── Relative time helper ────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHour = Math.floor(diffMs / 1000 / 60 / 60);
  const diffDay = Math.floor(diffMs / 1000 / 60 / 60 / 24);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return `${Math.floor(diffDay / 30)}个月前`;
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
  // Also access the store for additional assistant/context data if needed
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
        <div className="text-sm text-gray-500">今日搜题</div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-[#F59E0B]">{toReviewCount}</div>
        <div className="text-sm text-gray-500">错题待复习</div>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="text-2xl font-bold text-[#10B981]">{masteryPercent}%</div>
        <div className="text-sm text-gray-500">知识掌握度</div>
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

const actions: QuickAction[] = [
  { icon: '📷', label: '拍照搜题', href: '/sky/solve' },
  { icon: '📖', label: '幻灯片讲解', href: '/sky/slides' },
  { icon: '📊', label: '学习数据', href: '/sky/learning' },
  { icon: '💡', label: 'AI 助手', href: '/sky/assistant' },
];

export function QuickActions() {
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
              {formatRelativeTime(m.solvedAt)}
            </span>
            <span className="flex-1 truncate text-gray-700">
              {m.problem.length > 60
                ? m.problem.slice(0, 60) + '...'
                : m.problem}
            </span>
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {causeLabels[m.cause] ?? m.cause}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
