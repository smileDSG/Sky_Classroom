'use client';

import { useState, useEffect, useCallback } from 'react';
import { EBBINGHAUS_INTERVALS } from '@/lib/storage/dao/mistakes';
import {
  buildReviewSchedule,
  getMasteryProgress,
  getUrgentItems,
  type ReviewSchedule,
  type MasteryProgress,
} from '@/lib/schedule/review-scheduler';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';

const INTERVAL_COLORS: Record<number, string> = {
  1:  '#EF4444',
  2:  '#F97316',
  4:  '#F59E0B',
  7:  '#10B981',
  15: '#3B82F6',
  30: '#8B5CF6',
};

// SVG font styles (Tailwind classes don't work inside SVG)
const SVG_TEXT_SM = { fontSize: '9px', fontFamily: 'system-ui, sans-serif' };
const SVG_TEXT_XS = { fontSize: '8px', fontFamily: 'system-ui, sans-serif' };

type DataSource = 'api' | 'local';

export function ReviewPlan() {
  const { t } = useI18n();

  const CURVE_POINTS = EBBINGHAUS_INTERVALS.map((day) => {
    const retention = Math.round(100 * Math.exp(-0.35 * Math.log(day + 1)));
    return { day, retention, color: INTERVAL_COLORS[day], label: t('sky.learning.day', { n: day }) };
  });

  const [schedule, setSchedule] = useState<ReviewSchedule | null>(null);
  const [progress, setProgress] = useState<MasteryProgress | null>(null);
  const [urgentItems, setUrgentItems] = useState<MistakeBookEntry[]>([]);
  const [source, setSource] = useState<DataSource>('local');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    // Try API first
    try {
      const res = await fetch('/api/sky/review/due');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSchedule({
            today: json.data.dueToday?.length
              ? { date: new Date().toISOString().slice(0, 10), dayLabel: t('sky.learning.today'), items: json.data.dueToday, count: json.data.dueCount }
              : null,
            upcoming: json.data.upcoming ?? [],
            overdue: json.data.overdue ?? 0,
            completed: json.data.completed ?? 0,
            total: json.data.total ?? 0,
          });
          setProgress(json.data.progress ?? null);
          setUrgentItems(json.data.dueToday?.slice(0, 5) ?? []);
          setSource('api');
          setLoading(false);
          return;
        }
      }
    } catch { /* fall through */ }

    // Fallback: Zustand store
    try {
      const { useSkyClassroomStore } = await import('@/lib/store/use-sky-classroom-store');
      const mistakes = useSkyClassroomStore.getState().mistakes;
      if (mistakes.length === 0) {
        setLoading(false);
        return;
      }
      const now = Date.now();
      const entries = mistakes.map((m) => {
        const solvedTs = m.solvedAt instanceof Date ? m.solvedAt.getTime() : new Date(m.solvedAt).getTime();
        const intervalIdx = Math.min(m.reviewCount, EBBINGHAUS_INTERVALS.length - 1);
        const days = EBBINGHAUS_INTERVALS[intervalIdx];
        return {
          id: m.id,
          problemText: m.problem,
          userAnswer: m.userAnswer,
          correctAnswer: m.correctAnswer,
          errorType: causeToErrorType(m.cause),
          knowledgePoints: m.knowledgePoints,
          reviewCount: m.reviewCount,
          lastReview: m.reviewed ? now - days * 12 * 60 * 60 * 1000 : undefined,
          nextReview: m.reviewed
            ? now + EBBINGHAUS_INTERVALS[Math.min(m.reviewCount, EBBINGHAUS_INTERVALS.length - 1)] * 86400000
            : solvedTs + days * 86400000 + m.reviewCount * 86400000,
          masteryLevel: m.reviewed ? m.reviewCount : 0,
          reviewed: m.reviewed,
        } as MistakeBookEntry;
      });

      setSchedule(buildReviewSchedule(entries));
      setProgress(getMasteryProgress(entries));
      setUrgentItems(getUrgentItems(entries, 5));
      setSource('local');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('sky.learning.loadFailed'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── States ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-52 rounded-xl bg-gray-100" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100" />)}
        </div>
      </div>
    );
  }

  if (errorMsg && !schedule) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-red-50 py-16">
        <p className="text-sm text-red-500">{errorMsg}</p>
        <button onClick={loadData} className="mt-3 text-xs text-blue-500 hover:underline">{t('sky.learning.retry')}</button>
      </div>
    );
  }

  const hasData = schedule && (schedule.today || schedule.upcoming.length > 0 || progress);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-white py-16 shadow-sm">
        <div className="text-5xl">🧠</div>
        <h3 className="mt-4 text-base font-semibold text-gray-700">{t('sky.learning.noReviewData')}</h3>
        <p className="mt-2 text-sm text-gray-400">{t('sky.learning.noReviewDataHint')}</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── 1. Forgetting Curve ── */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">{t('sky.learning.forgettingCurve')}</h3>
        <p className="mb-3 text-[11px] text-gray-400">
          {t('sky.learning.forgettingCurveDesc', { intervals: EBBINGHAUS_INTERVALS.map((d) => `${d}d`).join(' → ') })}
        </p>

        <svg viewBox="0 0 360 230" className="w-full" style={{ maxHeight: 240 }}>
          {/* ── Y-axis: grid + labels ── */}
          {[0, 20, 40, 60, 80, 100].map((pct) => {
            const y = 188 - (pct / 100) * 176;
            return (
              <g key={`y-${pct}`}>
                <line x1={46} y1={y} x2={346} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                <text x={40} y={y + 4} textAnchor="end" {...SVG_TEXT_XS} fill="#9ca3af">{pct}%</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={46} y1={12} x2={46} y2={188} stroke="#d1d5db" strokeWidth="1" />
          <line x1={46} y1={188} x2={346} y2={188} stroke="#d1d5db" strokeWidth="1" />

          {/* X-axis labels */}
          {CURVE_POINTS.map((p, i) => {
            const x = 46 + (i / 5) * 300;
            return <text key={`x-${p.day}`} x={x} y={208} textAnchor="middle" {...SVG_TEXT_XS} fill="#6b7280">{p.label}</text>;
          })}

          {/* Curve */}
          <polyline
            fill="none" stroke="#4A90D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            points={CURVE_POINTS.map((p, i) => `${46 + (i / 5) * 300},${188 - (p.retention / 100) * 176}`).join(' ')}
          />
          {/* Dashed tail */}
          <line
            x1={346} y1={188 - (CURVE_POINTS[5].retention / 100) * 176} x2={346} y2={188 - (CURVE_POINTS[5].retention / 100) * 176}
            stroke="#4A90D9" strokeWidth="1" strokeDasharray="4 3" opacity="0.3"
          />

          {/* Data points */}
          {CURVE_POINTS.map((p, i) => {
            const cx = 46 + (i / 5) * 300;
            const cy = 188 - (p.retention / 100) * 176;
            return (
              <g key={`pt-${p.day}`}>
                <circle cx={cx} cy={cy} r="5" fill={p.color} stroke="#fff" strokeWidth="2" />
                <text x={cx} y={cy - 11} textAnchor="middle" {...SVG_TEXT_SM} fontWeight="600" fill={p.color}>{p.retention}%</text>
              </g>
            );
          })}

          {/* Axis titles */}
          <text x={14} y={100} textAnchor="middle" {...SVG_TEXT_XS} fill="#9ca3af" transform="rotate(-90, 14, 100)">{t('sky.learning.retentionRate')}</text>
          <text x={196} y={226} textAnchor="middle" {...SVG_TEXT_XS} fill="#9ca3af">{t('sky.learning.reviewInterval')}</text>
        </svg>
      </div>

      {/* ── 2. Stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label={t('sky.learning.masteryProgress')} value={`${progress?.percentComplete ?? 0}%`} color="#4A90D9"
          footer={<>{t('sky.learning.mastered', { mastered: progress?.masteredCount ?? 0, total: progress?.totalCount ?? 0 })}</>}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#4A90D9] to-[#10B981] transition-all duration-700"
              style={{ width: `${progress?.percentComplete ?? 0}%` }} />
          </div>
        </StatCard>
        <StatCard label={t('sky.learning.todayReview')} value={schedule?.today?.count ?? 0} color="#F59E0B" suffix={t('sky.learning.items')}>
          {schedule && schedule.overdue > 0 && (
            <div className="mt-2 text-[11px] text-red-400">{t('sky.learning.overdueWarning', { n: schedule.overdue })}</div>
          )}
        </StatCard>
        <StatCard
          label={t('sky.learning.weekPlan')}
          value={schedule?.upcoming?.reduce((s, d) => s + d.count, 0) ?? 0}
          color="#10B981" suffix={t('sky.learning.items')}
          footer={<>{t('sky.learning.reviewDays', { n: schedule?.upcoming?.length ?? 0 })}</>}
        />
      </div>

      {/* ── 3. Today's review list ── */}
      {urgentItems.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
            {t('sky.learning.todayReviewList')}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{urgentItems.length} {t('sky.learning.items')}</span>
          </h3>
          <div className="space-y-2">
            {urgentItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 line-clamp-1">{item.problemText}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {t('sky.learning.reviewTimes', { n: item.reviewCount })} · {'⭐'.repeat(Math.min(item.masteryLevel, 6)) || '—'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">{t('sky.learning.nthReview', { n: item.reviewCount + 1 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Upcoming schedule ── */}
      {schedule?.upcoming && schedule.upcoming.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('sky.learning.upcomingReviewPlan')}</h3>
          <div className="divide-y divide-gray-50">
            {schedule.upcoming.map((day) => (
              <div key={day.date} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 w-12">{day.dayLabel}</span>
                  <span className="text-[11px] text-gray-400">{day.date}</span>
                </div>
                <span className="rounded-full bg-[#E8F4FD] px-2.5 py-0.5 text-[11px] font-medium text-[#4A90D9]">{day.count} {t('sky.learning.items')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Interval guide ── */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('sky.learning.reviewIntervalGuide')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {EBBINGHAUS_INTERVALS.map((day, i) => (
            <div key={day} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: INTERVAL_COLORS[day] }}>
                {i + 1}
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700">{t('sky.learning.nthReview', { n: i + 1 })}</div>
                <div className="text-[11px] text-gray-400">{t('sky.learning.day', { n: day })}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
          {t('sky.learning.reviewIntervalDesc')}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{t('sky.learning.dataSource', { source: source === 'api' ? t('sky.learning.dataSourceCloud') : t('sky.learning.dataSourceLocal') })}</span>
        <button onClick={loadData} className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-500 hover:bg-gray-200 transition-colors">{t('sky.learning.refresh')}</button>
      </div>
    </div>
  );
}

// ── Stat card helper ──────────────────────────────────────────────────

function StatCard({ label, value, color, suffix, footer, children }: {
  label: string; value: string | number; color: string; suffix?: string;
  footer?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </div>
      {children}
      {footer && <div className="mt-1 text-[10px] text-gray-400">{footer}</div>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function causeToErrorType(cause: string): import('@/lib/storage/dao/mistakes').ErrorType {
  const map: Record<string, import('@/lib/storage/dao/mistakes').ErrorType> = {
    'calculation-error': 'calculation',
    'concept-unclear': 'concept',
    'method-wrong': 'reasoning',
    'misreading': 'reading',
    'careless': 'careless',
  };
  return map[cause] ?? 'calculation';
}
